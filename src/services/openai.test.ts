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

  it('uses primary chat source successfully', async () => {
    config.chatSource = 'openai';
    config.chatModel = 'gpt-5-nano';
    proxyChatMock.mockResolvedValue('ok from openai');

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('ok from openai');
    expect(proxyChatMock).toHaveBeenCalledTimes(1);
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'openai',
      model: 'gpt-5-nano',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('falls back on chat when primary fails', async () => {
    config.chatSource = 'openai';
    config.chatModel = 'gpt-primary';
    config.chatFallbackSource = 'openai';
    config.chatFallbackModel = 'gpt-fallback';

    proxyChatMock
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce('fallback ok');

    const result = await chatCompletion('sys', 'hi');

    expect(result).toBe('fallback ok');
    expect(proxyChatMock).toHaveBeenCalledTimes(2);
  });

  it('falls back in TTS', async () => {
    config.ttsSource = 'openai';
    config.ttsModel = 'tts-primary';
    config.ttsFallbackSource = 'openai';
    config.ttsFallbackModel = 'tts-fallback';
    config.ttsVoice = 'nova';

    proxyTTSMock
      .mockRejectedValueOnce(new Error('primary failed'))
      .mockResolvedValueOnce('audio-base64');

    const base64 = await textToSpeech('short text');

    expect(base64).toBe('audio-base64');
    expect(proxyTTSMock).toHaveBeenCalledTimes(2);
  });

  it('normalizes invalid OpenAI TTS voices before calling the proxy', async () => {
    config.ttsSource = 'openai';
    config.ttsModel = 'tts-1';
    config.ttsVoice = 'ballad';
    proxyTTSMock.mockResolvedValue('audio-base64');

    await textToSpeech('short text');

    expect(proxyTTSMock).toHaveBeenCalledWith({
      source: 'openai',
      model: 'tts-1',
      voice: 'alloy',
      text: 'short text',
    });
  });

  it('generates image through proxy', async () => {
    config.imageSource = 'openai';
    config.imageModel = 'gpt-image-1-mini';
    proxyImageMock.mockResolvedValue('data:image/png;base64,abc123');

    const image = await generateImage('a cat');
    expect(image).toBe('data:image/png;base64,abc123');
    expect(proxyImageMock).toHaveBeenCalledWith({
      source: 'openai',
      model: 'gpt-image-1-mini',
      prompt: 'a cat',
    });
  });

  it('falls back in speech-to-text', async () => {
    config.sttSource = 'openai';
    config.sttModel = 'whisper-1';
    config.sttFallbackSource = 'groq';
    config.sttFallbackModel = 'whisper-large-v3-turbo';

    proxySTTMock
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce('fallback transcript');

    const transcript = await speechToText(new Blob(['fake audio'], { type: 'audio/webm' }));

    expect(transcript).toBe('fallback transcript');
    expect(proxySTTMock).toHaveBeenCalledTimes(2);
  });

  it('throws when proxy fails with no fallback configured', async () => {
    config.chatSource = 'openai';
    config.chatModel = 'gpt-5-nano';
    // No fallback configured
    proxyChatMock.mockRejectedValue(new Error('Not authenticated'));

    await expect(chatCompletion('sys', 'hi')).rejects.toThrow('Not authenticated');
    expect(proxyChatMock).toHaveBeenCalledTimes(1);
  });

  it('uses resolveSource for gemini model overrides in chatCompletion', async () => {
    proxyChatMock.mockResolvedValue('gemini response');

    const result = await chatCompletion('sys', 'hi', 'gemini-2.5-flash');

    expect(result).toBe('gemini response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'genai',
      model: 'gemini-2.5-flash',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('uses resolveSource for OpenRouter model overrides (IDs with /)', async () => {
    proxyChatMock.mockResolvedValue('openrouter response');

    const result = await chatCompletion('sys', 'hi', 'anthropic/claude-sonnet-4');

    expect(result).toBe('openrouter response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'openrouter',
      model: 'anthropic/claude-sonnet-4',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('uses resolveSource for Groq model overrides with slash-based IDs', async () => {
    proxyChatMock.mockResolvedValue('groq response');

    const result = await chatCompletion('sys', 'hi', 'meta-llama/llama-4-maverick-17b-128e-instruct');

    expect(result).toBe('groq response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'groq',
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('uses resolveSource from catalog for known model override', async () => {
    proxyChatMock.mockResolvedValue('openai response');

    const result = await chatCompletion('sys', 'hi', 'gpt-5.4');

    expect(result).toBe('openai response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'openai',
      model: 'gpt-5.4',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });

  it('falls back to heuristic for unknown model override', async () => {
    proxyChatMock.mockResolvedValue('heuristic response');

    const result = await chatCompletion('sys', 'hi', 'my-custom-fine-tuned-model');

    expect(result).toBe('heuristic response');
    expect(proxyChatMock).toHaveBeenCalledWith({
      source: 'openai',
      model: 'my-custom-fine-tuned-model',
      systemPrompt: 'sys',
      userMessage: 'hi',
    });
  });
});
