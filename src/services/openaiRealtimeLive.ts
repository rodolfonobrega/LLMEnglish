import { getOpenAIKey, getModelConfig } from './storage';
import type { LiveSessionCallbacks, ILiveSession } from './liveSession';

/**
 * Helper: encode Uint8Array to base64 string.
 */
function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * OpenAI Realtime API via WebSocket for bidirectional audio conversation.
 * Used as an alternative to Gemini Live for the Live Roleplay mode.
 *
 * Uses an AudioWorklet (shared with Gemini) for microphone capture to avoid
 * the deprecated ScriptProcessorNode and eliminate main-thread audio dropouts.
 * On user speech start (server-side VAD), the queued playback buffers are
 * flushed so the user can interrupt mid-response.
 */
export class OpenAIRealtimeLiveSession implements ILiveSession {
  private ws: WebSocket | null = null;
  private callbacks: LiveSessionCallbacks;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isStreaming = false;

  // Scheduled audio playback (mirrors Gemini pattern)
  private playbackContext: AudioContext | null = null;
  private playbackQueue: string[] = [];
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private isPlayingAudio = false;

  private currentTranscript = '';

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(systemInstruction: string, _voiceOverride?: string): Promise<void> {
    void _voiceOverride;
    const key = getOpenAIKey();
    if (!key) {
      this.callbacks.onError('OpenAI API key not configured. Go to Settings to add it.');
      return;
    }

    const config = getModelConfig();
    const model = config.liveModel;
    const voice = config.liveVoice;

    const url = `wss://api.openai.com/v1/realtime?model=${model}`;

    try {
      this.ws = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${key}`,
        'openai-beta.realtime-v1',
      ]);

      this.ws.onopen = () => {
        this.callbacks.onConnectionChange(true);
        // Configure session for audio conversation
        this.sendJSON({
          type: 'session.update',
          session: {
            instructions: systemInstruction,
            // We render the model's audio transcript from output_audio_transcript events,
            // so requesting a separate text response is redundant and can increase cost.
            output_modalities: ['audio'],
            audio: {
              input: {
                format: { type: 'audio/pcm', rate: 24000 },
                turn_detection: { type: 'semantic_vad' },
              },
              output: {
                format: { type: 'audio/pcm' },
                voice,
              },
            },
            input_audio_transcription: {
              model: config.sttModel,
            },
          },
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(typeof event.data === 'string' ? event.data : '');
          this.handleServerEvent(data);
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onerror = () => {
        this.callbacks.onError('OpenAI Realtime WebSocket connection error');
        this.callbacks.onConnectionChange(false);
      };

      this.ws.onclose = () => {
        this.callbacks.onConnectionChange(false);
      };
    } catch (err) {
      this.callbacks.onError(`Failed to connect to OpenAI Realtime: ${err}`);
    }
  }

  private handleServerEvent(event: Record<string, unknown>): void {
    switch (event.type) {
      // Audio output from the model
      case 'response.output_audio.delta': {
        const delta = event.delta as string;
        if (delta) {
          this.playbackQueue.push(delta);
          this.playNextAudio();
        }
        break;
      }

      // Text transcript of model's audio output
      case 'response.output_audio_transcript.delta': {
        const delta = event.delta as string;
        if (delta) {
          this.currentTranscript += delta;
          this.callbacks.onTextResponse(delta);
        }
        break;
      }

      case 'response.output_audio_transcript.done': {
        // Turn complete with full transcript
        if (this.currentTranscript.trim()) {
          this.callbacks.onTurnComplete();
        }
        this.currentTranscript = '';
        break;
      }

      // User started speaking (server-side VAD) — interrupt any queued/playing audio
      case 'input_audio_buffer.speech_started': {
        this.flushPlayback();
        this.callbacks.onInterrupted?.();
        break;
      }

      // User's speech transcription (input)
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = event.transcript as string;
        if (transcript?.trim()) {
          // Emit as a user turn via a custom mechanism
          // The LiveSession component handles user turns from transcription
          this.callbacks.onUserTranscription?.(transcript.trim());
        }
        break;
      }

      case 'error': {
        const errorData = event.error as Record<string, string> | undefined;
        this.callbacks.onError(errorData?.message || 'Unknown realtime error');
        break;
      }

      case 'session.created':
      case 'session.updated':
        // Session ready
        break;
    }
  }

  private async playNextAudio(): Promise<void> {
    if (this.isPlayingAudio || this.playbackQueue.length === 0) return;

    this.isPlayingAudio = true;
    const audioBase64 = this.playbackQueue.shift()!;

    try {
      this.callbacks.onAudioResponse(audioBase64);

      if (!this.playbackContext) {
        this.playbackContext = new AudioContext({ sampleRate: 24000 });
      }

      const ctx = this.playbackContext;
      this.nextStartTime = Math.max(this.nextStartTime, ctx.currentTime);

      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        this.activeSources.delete(source);
        this.isPlayingAudio = false;
        this.playNextAudio();
      };

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.add(source);
    } catch (err) {
      console.error('Audio playback error:', err);
      this.isPlayingAudio = false;
      this.playNextAudio();
    }
  }

  /**
   * Flush any pending or in-flight playback. Called when the server reports
   * the user started speaking (so the AI audio does not talk over the user).
   */
  private flushPlayback(): void {
    this.playbackQueue = [];
    this.activeSources.forEach((src) => {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // already stopped
      }
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
    this.isPlayingAudio = false;
  }

  async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 },
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      await this.audioContext.resume();

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      await this.audioContext.audioWorklet.addModule('worklets/pcm-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor', {
        parameterData: { bufferSize: 4096 },
      });

      this.workletNode.port.onmessage = (event: MessageEvent) => {
        if (!this.isStreaming) return;

        const payload = event.data as { audio?: ArrayBuffer } | ArrayBuffer | undefined;
        const buffer =
          payload instanceof ArrayBuffer
            ? payload
            : payload && 'audio' in payload
              ? payload.audio
              : undefined;
        if (!buffer) return;

        const base64 = encodeBase64(new Uint8Array(buffer));
        this.sendJSON({
          type: 'input_audio_buffer.append',
          audio: base64,
        });
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
      this.isStreaming = true;
    } catch (err) {
      this.callbacks.onError(`Microphone access error: ${err}`);
    }
  }

  stopMicrophone(): void {
    this.isStreaming = false;
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      try {
        this.workletNode.port.close();
      } catch {
        // ignore
      }
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  sendTextMessage(text: string): void {
    this.sendJSON({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this.sendJSON({ type: 'response.create' });
  }

  private sendJSON(data: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.stopMicrophone();
    this.flushPlayback();
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentTranscript = '';
  }
}
