import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '../types/settings';

const {
  getModelConfigMock,
  getOpenAIKeyMock,
  getGeminiKeyMock,
  getGroqKeyMock,
  getCachedAudioMock,
  setCachedAudioMock,
  generateContentMock,
} = vi.hoisted(() => ({
  getModelConfigMock: vi.fn(),
  getOpenAIKeyMock: vi.fn(),
  getGeminiKeyMock: vi.fn(),
  getGroqKeyMock: vi.fn(),
  getCachedAudioMock: vi.fn(),
  setCachedAudioMock: vi.fn(),
  generateContentMock: vi.fn(),
}));

vi.mock('./storage', () => ({
  getModelConfig: getModelConfigMock,
  getOpenAIKey: getOpenAIKeyMock,
  getGeminiKey: getGeminiKeyMock,
  getGroqKey: getGroqKeyMock,
  getCachedAudio: getCachedAudioMock,
  setCachedAudio: setCachedAudioMock,
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
  Modality: { AUDIO: 'AUDIO' },
}));

import {
  chatCompletion,
  generateImage,
  speechToText,
  textToSpeech,
} from './openai';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status: number): Response {
  return new Response(text, { status });
}

describe('openai service dispatch', () => {
  let config: ModelConfig;

  beforeEach(() => {
    config = { ...DEFAULT_MODEL_CONFIG };
    getModelConfigMock.mockImplementation(() => config);
    getOpenAIKeyMock.mockReturnValue('sk-test-openai');
    getGeminiKeyMock.mockReturnValue('gm-test');
    getGroqKeyMock.mockReturnValue('gsk-test');
    getCachedAudioMock.mockReturnValue(null);
    generateContentMock.mockReset();
    (globalThis.fetch as unknown) = vi.fn();
    (globalThis as unknown as { FileReader: unknown }).FileReader = class {
      result: string | ArrayBuffer | null = null;
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(blob: Blob): void {
        void blob;
        this.result = 'data:audio/mp3;base64,ZmFrZS1hdWRpbw==';
        this.onloadend?.();
      }
    };
  });

  it('uses primary chat provider successfully', async () => {
    config.chatProvider = 'openai';
    config.chatModel = 'gpt-4o-mini';

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: 'ok from openai' } }] })
    );

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('ok from openai');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back on chat when primary fails', async () => {
    config.chatProvider = 'openai';
    config.chatModel = 'gpt-primary';
    config.chatFallbackProvider = 'openai';
    config.chatFallbackModel = 'gpt-fallback';

    vi.mocked(fetch)
      .mockResolvedValueOnce(textResponse('boom', 500))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: 'fallback ok' } }] }));

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('fallback ok');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns cached TTS audio when available', async () => {
    getCachedAudioMock.mockReturnValue('cached-audio');

    const result = await textToSpeech('hello world');

    expect(result).toBe('cached-audio');
    expect(fetch).not.toHaveBeenCalled();
    expect(setCachedAudioMock).not.toHaveBeenCalled();
  });

  it('falls back in TTS and caches generated audio', async () => {
    config.ttsProvider = 'openai';
    config.ttsModel = 'tts-primary';
    config.ttsFallbackProvider = 'openai';
    config.ttsFallbackModel = 'tts-fallback';
    config.ttsVoice = 'nova';

    vi.mocked(fetch)
      .mockResolvedValueOnce(textResponse('unavailable', 500))
      .mockResolvedValueOnce(new Response('audio-bytes', { status: 200 }));

    const base64 = await textToSpeech('short text');

    expect(base64.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(setCachedAudioMock).toHaveBeenCalledTimes(1);
  });

  it('generates image with OpenAI and returns data URL', async () => {
    config.imageProvider = 'openai';
    config.imageModel = 'gpt-image-1-mini';

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ data: [{ b64_json: 'abc123' }] })
    );

    const image = await generateImage('a cat');
    expect(image).toBe('data:image/png;base64,abc123');
  });

  it('generates image with Gemini Imagen endpoint', async () => {
    config.imageProvider = 'gemini';
    config.imageModel = 'imagen-4.0-fast-generate-001';

    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ predictions: [{ bytesBase64: 'gemimg' }] })
    );

    const image = await generateImage('a robot');
    expect(image).toBe('data:image/png;base64,gemimg');
  });

  it('falls back in speech-to-text', async () => {
    config.sttProvider = 'openai';
    config.sttModel = 'whisper-1';
    config.sttFallbackProvider = 'groq';
    config.sttFallbackModel = 'whisper-large-v3-turbo';

    vi.mocked(fetch)
      .mockResolvedValueOnce(textResponse('rate limit', 429))
      .mockResolvedValueOnce(jsonResponse({ text: 'fallback transcript' }));

    const transcript = await speechToText(new Blob(['fake audio'], { type: 'audio/webm' }));

    expect(transcript).toBe('fallback transcript');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('throws fast when OpenAI key is missing', async () => {
    config.chatProvider = 'openai';
    getOpenAIKeyMock.mockReturnValue('');

    await expect(chatCompletion('sys', 'hi')).rejects.toThrow('OpenAI API key not configured');
    expect(fetch).not.toHaveBeenCalled();
  });
});
