import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOpenAIKeyMock, getModelConfigMock } = vi.hoisted(() => ({
  getOpenAIKeyMock: vi.fn(),
  getModelConfigMock: vi.fn(),
}));

vi.mock('./storage', () => ({
  getOpenAIKey: getOpenAIKeyMock,
  getModelConfig: getModelConfigMock,
}));

import { OpenAIRealtimeLiveSession } from './openaiRealtimeLive';

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;

  constructor(url: string, protocols?: string[]) {
    void url;
    void protocols;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.(new Event('close'));
  }
}

class FakeAudioContext {
  destination = {};

  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  createScriptProcessor() {
    return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as ((event: unknown) => void) | null };
  }

  createBuffer(channels: number, frameCount: number, sampleRate: number) {
    void channels;
    void sampleRate;
    return {
      getChannelData: () => new Float32Array(frameCount),
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      onended: null as (() => void) | null,
    };
  }

  close() {
    return Promise.resolve();
  }
}

describe('OpenAIRealtimeLiveSession', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    getOpenAIKeyMock.mockReturnValue('sk-test');
    getModelConfigMock.mockReturnValue({
      liveModel: 'gpt-4o-mini-realtime-preview',
      liveVoice: 'marin',
      sttModel: 'gpt-4o-mini-transcribe',
    });

    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket as unknown;
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext as unknown;

    const trackStop = vi.fn();
    const mediaStream = { getTracks: () => [{ stop: trackStop }] };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mediaStream),
        },
      },
      writable: true,
      configurable: true,
    });
  });

  it('emits error when key is missing', async () => {
    getOpenAIKeyMock.mockReturnValue('');
    const onError = vi.fn();

    const session = new OpenAIRealtimeLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse: vi.fn(),
      onTurnComplete: vi.fn(),
      onError,
      onConnectionChange: vi.fn(),
    });

    await session.connect('system');

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('OpenAI API key not configured'));
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('connects, processes transcript events, and sends session config', async () => {
    const onTextResponse = vi.fn();
    const onTurnComplete = vi.fn();
    const onUserTranscription = vi.fn();
    const onConnectionChange = vi.fn();

    const session = new OpenAIRealtimeLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse,
      onTurnComplete,
      onError: vi.fn(),
      onConnectionChange,
      onUserTranscription,
    });

    await session.connect('be concise');

    const ws = FakeWebSocket.instances[0];
    ws.onopen?.(new Event('open'));

    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(ws.sent.some(msg => msg.includes('session.update'))).toBe(true);
    expect(ws.sent.some(msg => msg.includes('"output_modalities":["audio"]'))).toBe(true);

    ws.onmessage?.({
      data: JSON.stringify({ type: 'response.output_audio_transcript.delta', delta: 'Hello' }),
    } as MessageEvent);

    ws.onmessage?.({
      data: JSON.stringify({ type: 'response.output_audio_transcript.done' }),
    } as MessageEvent);

    ws.onmessage?.({
      data: JSON.stringify({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'my turn' }),
    } as MessageEvent);

    expect(onTextResponse).toHaveBeenCalledWith('Hello');
    expect(onTurnComplete).toHaveBeenCalled();
    expect(onUserTranscription).toHaveBeenCalledWith('my turn');
  });

  it('streams microphone audio and sends append events', async () => {
    const session = new OpenAIRealtimeLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse: vi.fn(),
      onTurnComplete: vi.fn(),
      onError: vi.fn(),
      onConnectionChange: vi.fn(),
    });

    await session.connect('system');
    const ws = FakeWebSocket.instances[0];
    ws.onopen?.(new Event('open'));

    await session.startMicrophone();

    const processor = (session as unknown as { processor: { onaudioprocess: (event: unknown) => void } }).processor;
    processor.onaudioprocess({
      inputBuffer: {
        getChannelData: () => new Float32Array([0, 0.25, -0.25]),
      },
    });

    expect(ws.sent.some(msg => msg.includes('input_audio_buffer.append'))).toBe(true);

    session.disconnect();
    expect(ws.readyState).toBe(3);
  });
});
