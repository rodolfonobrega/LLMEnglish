import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_MODEL_CONFIG, type ModelConfig } from '../types/settings';

const {
  getModelConfigMock,
  proxyChatMock,
  proxyChatWithImageMock,
  proxyTTSMock,
  proxySTTMock,
  proxyImageMock,
} = vi.hoisted(() => ({
  getModelConfigMock: vi.fn(),
  proxyChatMock: vi.fn(),
  proxyChatWithImageMock: vi.fn(),
  proxyTTSMock: vi.fn(),
  proxySTTMock: vi.fn(),
  proxyImageMock: vi.fn(),
}));

vi.mock('./supabase/aiProxy', () => ({
  chatCompletion: proxyChatMock,
  chatCompletionWithImage: proxyChatWithImageMock,
  textToSpeech: proxyTTSMock,
  speechToText: proxySTTMock,
  generateImage: proxyImageMock,
}));

vi.mock('./runtimeState', () => ({
  getRuntimeModelConfig: getModelConfigMock,
}));

import {
  chatCompletion,
  generateImage,
  speechToText,
  textToSpeech,
} from './openai';

describe('openai service proxy dispatch', () => {
  let config: ModelConfig;

  beforeEach(() => {
    config = { ...DEFAULT_MODEL_CONFIG };
    getModelConfigMock.mockImplementation(() => config);
    proxyChatMock.mockReset();
    proxyChatWithImageMock.mockReset();
    proxyTTSMock.mockReset();
    proxySTTMock.mockReset();
    proxyImageMock.mockReset();
  });

  it('uses primary chat provider successfully', async () => {
    config.chatProvider = 'openai';
    config.chatModel = 'gpt-4o-mini';
    proxyChatMock.mockResolvedValue('ok from openai');

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('ok from openai');
    expect(proxyChatMock).toHaveBeenCalledTimes(1);
    expect(proxyChatMock).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt-4o-mini',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('falls back on chat when primary fails', async () => {
    config.chatProvider = 'openai';
    config.chatModel = 'gpt-primary';
    config.chatFallbackProvider = 'openai';
    config.chatFallbackModel = 'gpt-fallback';

    proxyChatMock
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce('fallback ok');

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('fallback ok');
    expect(proxyChatMock).toHaveBeenCalledTimes(2);
  });

  it('falls back in TTS', async () => {
    config.ttsProvider = 'openai';
    config.ttsModel = 'tts-primary';
    config.ttsFallbackProvider = 'openai';
    config.ttsFallbackModel = 'tts-fallback';
    config.ttsVoice = 'nova';

    proxyTTSMock
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce('audio-base64');

    const base64 = await textToSpeech('short text');

    expect(base64).toBe('audio-base64');
    expect(proxyTTSMock).toHaveBeenCalledTimes(2);
  });

  it('generates image through proxy', async () => {
    config.imageProvider = 'openai';
    config.imageModel = 'gpt-image-1-mini';
    proxyImageMock.mockResolvedValue('data:image/png;base64,abc123');

    const image = await generateImage('a cat');
    expect(image).toBe('data:image/png;base64,abc123');
    expect(proxyImageMock).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt-image-1-mini',
      prompt: 'a cat',
    });
  });

  it('falls back in speech-to-text', async () => {
    config.sttProvider = 'openai';
    config.sttModel = 'whisper-1';
    config.sttFallbackProvider = 'groq';
    config.sttFallbackModel = 'whisper-large-v3-turbo';

    proxySTTMock
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce('fallback transcript');

    const transcript = await speechToText(new Blob(['fake audio'], { type: 'audio/webm' }));

    expect(transcript).toBe('fallback transcript');
    expect(proxySTTMock).toHaveBeenCalledTimes(2);
  });

  it('throws when proxy fails with no fallback configured', async () => {
    config.chatProvider = 'openai';
    config.chatModel = 'gpt-4o-mini';
    // No fallback configured
    proxyChatMock.mockRejectedValue(new Error('Not authenticated'));

    await expect(chatCompletion('sys', 'hi')).rejects.toThrow('Not authenticated');
    expect(proxyChatMock).toHaveBeenCalledTimes(1);
  });

  it('uses detectProvider for model overrides in chatCompletion', async () => {
    proxyChatMock.mockResolvedValue('gemini response');

    const result = await chatCompletion('sys', 'hi', 'gemini-2.5-flash');

    expect(result).toBe('gemini response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });
});
