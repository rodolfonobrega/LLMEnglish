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

/**
 * Fake AudioWorkletNode with a message port for testing.
 */
class FakeAudioWorkletNode {
  port = { onmessage: null as ((event: unknown) => void) | null, postMessage: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

/**
 * Fake AudioContext that supports AudioWorkletNode (not ScriptProcessorNode).
 */
class FakeAudioContext {
  currentTime = 0;
  destination = {};

  audioWorklet = {
    addModule: vi.fn().mockResolvedValue(undefined),
  };

  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
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
  let lastCreatedWorkletNode: FakeAudioWorkletNode;

  beforeEach(() => {
    getGeminiKeyMock.mockReturnValue('gm-test');
    getModelConfigMock.mockReturnValue({
      liveModel: 'gemini-2.5-flash-native-audio-preview-12-2025',
      liveVoice: 'Puck',
    });

    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext as unknown;

    // Mock global AudioWorkletNode constructor so production `new AudioWorkletNode(...)` works.
    // Must use a function (not arrow) so it's callable as a constructor with `new`.
    lastCreatedWorkletNode = new FakeAudioWorkletNode();
    (globalThis as unknown as { AudioWorkletNode: unknown }).AudioWorkletNode = class {
      constructor() {
        return lastCreatedWorkletNode;
      }
    };

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

  it('uses AudioWorkletNode (not ScriptProcessorNode) for microphone input', async () => {
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

    // Verify audioWorklet.addModule was called with the pcm-processor worklet
    const audioCtx = (session as unknown as { inputAudioCtx: FakeAudioContext }).inputAudioCtx;
    expect(audioCtx.audioWorklet.addModule).toHaveBeenCalledWith('worklets/pcm-processor.js');

    // Verify the private field is workletNode (not processor)
    const workletNode = (session as unknown as { workletNode: FakeAudioWorkletNode }).workletNode;
    expect(workletNode).toBeTruthy();
    expect(workletNode.port.onmessage).toBeTypeOf('function');
  });

  it('streams microphone audio from worklet port messages to Gemini session', async () => {
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

    // Simulate the worklet posting a PCM16 audio buffer
    const workletNode = (session as unknown as { workletNode: FakeAudioWorkletNode }).workletNode;
    const pcmSamples = new Int16Array([0, 3276, -3276]);
    workletNode.port.onmessage!({ data: { audio: pcmSamples.buffer } });

    expect(fakeSdkSession.sendRealtimeInput).toHaveBeenCalledWith({
      media: { data: expect.any(String), mimeType: 'audio/pcm;rate=16000' },
    });
  });

  it('stopMicrophone clears worklet port.onmessage and disconnects node', async () => {
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

    const workletNode = (session as unknown as { workletNode: FakeAudioWorkletNode }).workletNode;
    expect(workletNode.port.onmessage).toBeTypeOf('function');

    session.stopMicrophone();

    // port.onmessage should be cleared
    expect(workletNode.port.onmessage).toBeNull();
    // disconnect should have been called
    expect(workletNode.disconnect).toHaveBeenCalled();
    // workletNode field should be null after stop
    expect((session as unknown as { workletNode: null }).workletNode).toBeNull();
  });
});
