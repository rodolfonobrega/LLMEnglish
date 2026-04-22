import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveServerMessage } from '@google/genai';
import { getGeminiKey, getModelConfig } from './storage';
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
 * Helper: decode base64 string to Uint8Array.
 */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper: decode raw PCM16 audio data into an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

/**
 * Gemini Live API session using the official @google/genai SDK.
 * Supports bidirectional audio conversation with transcription.
 */
export class GeminiLiveSession implements ILiveSession {
  private callbacks: LiveSessionCallbacks;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private session: any = null;
  private mediaStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isStreaming = false;

  // Scheduled audio playback
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  // Transcript accumulators
  private currentOutputText = '';
  private currentInputText = '';

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(systemInstruction: string, voiceOverride?: string): Promise<void> {
    const key = getGeminiKey();
    if (!key) {
      this.callbacks.onError('Gemini API key not configured. Go to Settings to add it.');
      return;
    }

    const config = getModelConfig();
    const model = config.liveModel;
    const voice = voiceOverride || config.liveVoice;

    try {
      const ai = new GoogleGenAI({ apiKey: key });

      const sessionPromise = ai.live.connect({
        model: `models/${model}`,
        callbacks: {
          onopen: () => {
            this.callbacks.onConnectionChange(true);
          },
          onmessage: (message: LiveServerMessage) => {
            this.handleMessage(message);
          },
          onerror: (e: ErrorEvent) => {
            this.callbacks.onError(`Gemini Live error: ${e.message || 'Unknown error'}`);
          },
          onclose: () => {
            this.isStreaming = false;
            this.stopMicrophone();
            this.stopAllAudio();
            this.session = null;
            this.callbacks.onConnectionChange(false);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
          systemInstruction,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        },
      });

      this.session = await sessionPromise;
    } catch (err) {
      this.callbacks.onError(`Failed to connect to Gemini Live: ${err}`);
    }
  }

  private handleMessage(message: LiveServerMessage): void {
    const sc = message.serverContent;
    if (!sc) return;

    // AI output transcription (streamed text of what the AI is saying)
    if (sc.outputTranscription) {
      const text = sc.outputTranscription.text;
      if (text) {
        this.currentOutputText += text;
        this.callbacks.onTextResponse(text);
      }
    }

    // User input transcription (what the user said)
    if (sc.inputTranscription) {
      const text = sc.inputTranscription.text;
      if (text) {
        this.currentInputText += text;
      }
    }

    // Turn complete: finalize accumulated transcripts
    if (sc.turnComplete) {
      // Emit user transcript if we accumulated one
      if (this.currentInputText.trim() && this.callbacks.onUserTranscription) {
        this.callbacks.onUserTranscription(this.currentInputText.trim());
      }

      // Emit AI turn complete
      if (this.currentOutputText.trim()) {
        this.callbacks.onTurnComplete();
      }

      // Reset accumulators
      this.currentInputText = '';
      this.currentOutputText = '';
    }

    // Audio data from the model
    const parts = sc.modelTurn?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          this.scheduleAudioPlayback(part.inlineData.data);
        }
      }
    }

    // Interruption: user started speaking while AI was talking
    if (sc.interrupted) {
      this.stopAllAudio();
      this.callbacks.onInterrupted?.();
    }
  }

  private async scheduleAudioPlayback(audioBase64: string): Promise<void> {
    try {
      this.callbacks.onAudioResponse(audioBase64);

      if (!this.outputAudioCtx) {
        this.outputAudioCtx = new AudioContext({ sampleRate: 24000 });
      }

      const ctx = this.outputAudioCtx;
      this.nextStartTime = Math.max(this.nextStartTime, ctx.currentTime);

      const audioBuffer = await decodeAudioData(decodeBase64(audioBase64), ctx, 24000);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        this.activeSources.delete(source);
      };

      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeSources.add(source);
    } catch (err) {
      console.error('Gemini audio playback error:', err);
    }
  }

  private stopAllAudio(): void {
    this.activeSources.forEach(source => {
      try { source.stop(); } catch { /* ignore */ }
    });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }

  async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      this.inputAudioCtx = new AudioContext({ sampleRate: 16000 });
      await this.inputAudioCtx.resume();

      this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);

      await this.inputAudioCtx.audioWorklet.addModule('worklets/pcm-processor.js');
      this.workletNode = new AudioWorkletNode(this.inputAudioCtx, 'pcm-processor', {
        parameterData: { bufferSize: 4096 },
      });

      this.workletNode.port.onmessage = (event) => {
        if (!this.isStreaming || !this.session) return;

        const pcm16 = new Int16Array(event.data.audio);
        const base64 = encodeBase64(new Uint8Array(pcm16.buffer));
        try {
          this.session.sendRealtimeInput({
            media: { data: base64, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch {
          this.isStreaming = false;
        }
      };

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.inputAudioCtx.destination);
      this.isStreaming = true;
    } catch (err) {
      this.callbacks.onError(`Microphone access error: ${err}`);
    }
  }

  stopMicrophone(): void {
    this.isStreaming = false;
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close();
      this.inputAudioCtx = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  sendTextMessage(text: string): void {
    if (this.session) {
      this.session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
    }
  }

  disconnect(): void {
    this.stopMicrophone();
    this.stopAllAudio();
    if (this.outputAudioCtx) {
      this.outputAudioCtx.close();
      this.outputAudioCtx = null;
    }
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.currentInputText = '';
    this.currentOutputText = '';
  }
}
