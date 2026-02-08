import { getOpenAIKey, getModelConfig } from './storage';
import type { LiveSessionCallbacks, ILiveSession } from './liveSession';

/**
 * OpenAI Realtime API via WebSocket for bidirectional audio conversation.
 * Used as an alternative to Gemini Live for the Live Roleplay mode.
 */
export class OpenAIRealtimeLiveSession implements ILiveSession {
  private ws: WebSocket | null = null;
  private callbacks: LiveSessionCallbacks;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isStreaming = false;
  private audioQueue: string[] = [];
  private isPlayingAudio = false;
  private playbackContext: AudioContext | null = null;
  private currentTranscript = '';

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(systemInstruction: string): Promise<void> {
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
            output_modalities: ['audio', 'text'],
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
          this.audioQueue.push(delta);
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
    if (this.isPlayingAudio || this.audioQueue.length === 0) return;

    this.isPlayingAudio = true;
    const audioBase64 = this.audioQueue.shift()!;

    try {
      this.callbacks.onAudioResponse(audioBase64);

      if (!this.playbackContext) {
        this.playbackContext = new AudioContext({ sampleRate: 24000 });
      }

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

      const audioBuffer = this.playbackContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);

      source.onended = () => {
        this.isPlayingAudio = false;
        this.playNextAudio();
      };

      source.start();
    } catch (err) {
      console.error('Audio playback error:', err);
      this.isPlayingAudio = false;
      this.playNextAudio();
    }
  }

  async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1 },
      });

      this.audioContext = new AudioContext({ sampleRate: 24000 });
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (event) => {
        if (!this.isStreaming) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const bytes = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        this.sendJSON({
          type: 'input_audio_buffer.append',
          audio: base64,
        });
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isStreaming = true;
    } catch (err) {
      this.callbacks.onError(`Microphone access error: ${err}`);
    }
  }

  stopMicrophone(): void {
    this.isStreaming = false;
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
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
    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.currentTranscript = '';
  }
}
