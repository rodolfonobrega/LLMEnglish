import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGeminiKeyMock, getModelConfigMock, liveConnectMock } = vi.hoisted(() => ({
  getGeminiKeyMock: vi.fn(),
  getModelConfigMock: vi.fn(),
  liveConnectMock: vi.fn(),
}));

vi.mock('./storage', () => ({
  getGeminiKey: getGeminiKeyMock,
  getModelConfig: getModelConfigMock,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    live = {
      connect: liveConnectMock,
    };
  },
  Modality: { AUDIO: 'AUDIO' },
}));

import { GeminiLiveSession } from './geminiLive';

class FakeAudioContext {
  currentTime = 0;
  destination = {};

  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }

  createScriptProcessor() {
    return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null as ((event: unknown) => void) | null };
  }

  createBuffer(_channels: number, frameCount: number, sampleRate: number) {
    const channelData = new Float32Array(frameCount);
    return {
      duration: frameCount / sampleRate,
      getChannelData: () => channelData,
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
  }

  close() {
    return Promise.resolve();
  }

  resume() {
    return Promise.resolve();
  }
}

describe('GeminiLiveSession', () => {
  beforeEach(() => {
    getGeminiKeyMock.mockReturnValue('gm-test');
    getModelConfigMock.mockReturnValue({
      liveModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
      liveVoice: 'Puck',
    });

    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext as unknown;

    const mediaStream = { getTracks: () => [{ stop: vi.fn() }] };
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mediaStream),
        },
      },
      writable: true,
      configurable: true,
    });

    liveConnectMock.mockReset();
  });

  it('emits error when Gemini key is missing', async () => {
    getGeminiKeyMock.mockReturnValue('');
    const onError = vi.fn();

    const session = new GeminiLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse: vi.fn(),
      onTurnComplete: vi.fn(),
      onError,
      onConnectionChange: vi.fn(),
    });

    await session.connect('system');

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Gemini API key not configured'));
    expect(liveConnectMock).not.toHaveBeenCalled();
  });

  it('connects and maps message callbacks', async () => {
    const fakeSdkSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn(),
    };
    liveConnectMock.mockResolvedValue(fakeSdkSession);

    const onTextResponse = vi.fn();
    const onUserTranscription = vi.fn();
    const onTurnComplete = vi.fn();
    const onConnectionChange = vi.fn();

    const session = new GeminiLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse,
      onTurnComplete,
      onError: vi.fn(),
      onConnectionChange,
      onUserTranscription,
    });

    await session.connect('be helpful', 'Kore');

    const connectArgs = liveConnectMock.mock.calls[0][0];
    connectArgs.callbacks.onopen();
    expect(onConnectionChange).toHaveBeenCalledWith(true);

    connectArgs.callbacks.onmessage({
      serverContent: {
        outputTranscription: { text: 'AI says hi' },
        inputTranscription: { text: 'user said hi' },
        turnComplete: true,
      },
    });

    expect(onTextResponse).toHaveBeenCalledWith('AI says hi');
    expect(onUserTranscription).toHaveBeenCalledWith('user said hi');
    expect(onTurnComplete).toHaveBeenCalled();

    session.sendTextMessage('next turn');
    expect(fakeSdkSession.sendClientContent).toHaveBeenCalled();

    session.disconnect();
    expect(fakeSdkSession.close).toHaveBeenCalled();
  });

  it('streams microphone audio to Gemini session', async () => {
    const fakeSdkSession = {
      sendRealtimeInput: vi.fn(),
      sendClientContent: vi.fn(),
      close: vi.fn(),
    };
    liveConnectMock.mockResolvedValue(fakeSdkSession);

    const session = new GeminiLiveSession({
      onAudioResponse: vi.fn(),
      onTextResponse: vi.fn(),
      onTurnComplete: vi.fn(),
      onError: vi.fn(),
      onConnectionChange: vi.fn(),
    });

    await session.connect('system');
    await session.startMicrophone();

    const processor = (session as unknown as { processor: { onaudioprocess: (event: unknown) => void } }).processor;
    processor.onaudioprocess({
      inputBuffer: {
        getChannelData: () => new Float32Array([0, 0.1, -0.1]),
      },
    });

    expect(fakeSdkSession.sendRealtimeInput).toHaveBeenCalled();
  });
});
