// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  getAuthHeaders,
  getBaseUrl,
  getPaidSmokeEnabled,
  getProviderKeys,
  loadLocalEnvFiles,
  makeSilentWavBuffer,
} from '../test/smoke/smokeTestUtils';

loadLocalEnvFiles();

const paidDescribe = getPaidSmokeEnabled() ? describe : describe.skip;
const keys = getProviderKeys();
const wavBase64 = makeSilentWavBuffer(0.5, 8000).toString('base64');

const CHAT_TESTS = [
  { model: 'gemini-3.1-pro-preview', source: 'genai' },
  { model: 'gemini-3-flash-preview', source: 'genai' },
  { model: 'gemini-3.1-flash-lite-preview', source: 'genai' },
  { model: 'gemini-2.5-pro', source: 'genai' },
  { model: 'gemini-2.5-flash', source: 'genai' },
  { model: 'gemini-2.5-flash-lite', source: 'genai' },
  { model: 'gpt-4.1', source: 'openai' },
  { model: 'gpt-4.1-mini', source: 'openai' },
  { model: 'gpt-4.1-nano', source: 'openai' },
  { model: 'llama-3.3-70b-versatile', source: 'groq' },
  { model: 'llama-3.1-8b-instant', source: 'groq' },
  { model: 'meta-llama/llama-4-scout-17b-16e-instruct', source: 'groq' },
  { model: 'qwen/qwen3-32b', source: 'groq' },
  { model: 'moonshotai/kimi-k2-instruct-0905', source: 'groq' },
  { model: 'openai/gpt-oss-120b', source: 'groq' },
  { model: 'openai/gpt-oss-20b', source: 'groq' },
  { model: 'google/gemini-3.1-flash-lite-preview', source: 'openrouter' },
  { model: 'google/gemma-3-27b-it', source: 'openrouter' },
  { model: 'openai/gpt-4.1', source: 'openrouter' },
  { model: 'openai/gpt-4.1-mini', source: 'openrouter' },
  { model: 'openai/gpt-4.1-nano', source: 'openrouter' },
] as const;

const STT_TESTS = [
  { model: 'gemini-3.1-pro-preview', source: 'genai' },
  { model: 'gemini-3-flash-preview', source: 'genai' },
  { model: 'gemini-3.1-flash-lite-preview', source: 'genai' },
  { model: 'gemini-2.5-pro', source: 'genai' },
  { model: 'gemini-2.5-flash', source: 'genai' },
  { model: 'gemini-2.5-flash-lite', source: 'genai' },
  { model: 'whisper-1', source: 'openai' },
  { model: 'gpt-4o-mini-transcribe', source: 'openai' },
  { model: 'whisper-large-v3', source: 'groq' },
  { model: 'whisper-large-v3-turbo', source: 'groq' },
  { model: 'openai/gpt-audio', source: 'openrouter' },
] as const;

const TTS_TESTS = [
  { model: 'gemini-2.5-flash-preview-tts', source: 'genai', voice: 'Kore' },
  { model: 'tts-1', source: 'openai', voice: 'alloy' },
  { model: 'gpt-4o-mini-tts', source: 'openai', voice: 'alloy' },
  { model: 'canopylabs/orpheus-v1-english', source: 'groq', voice: 'troy' },
] as const;

const IMAGE_TESTS = [
  { model: 'gemini-3.1-flash-image-preview', source: 'genai' },
  { model: 'gemini-3-pro-image-preview', source: 'genai' },
  { model: 'gemini-2.5-flash-image', source: 'genai' },
  { model: 'gpt-image-1-mini', source: 'openai' },
  { model: 'gpt-image-1', source: 'openai' },
  { model: 'google/gemini-3.1-flash-image-preview', source: 'openrouter' },
  { model: 'bytedance-seed/seedream-4.5', source: 'openrouter' },
] as const;

function providerTest(source: keyof typeof keys) {
  return keys[source] ? it : it.skip;
}

paidDescribe('paid model catalog smoke tests', () => {
  describe('chat', () => {
    for (const { model, source } of CHAT_TESTS) {
      providerTest(source)(`${source}:${model}`, async () => {
        if (source === 'genai') {
          const resp = await fetch(
            `${getBaseUrl('genai')}/models/${model}:generateContent?key=${keys.genai!}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say hi in exactly 3 words' }] }],
                generationConfig: { maxOutputTokens: 20, temperature: 0 },
              }),
            },
          );
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          expect(data?.candidates?.[0]?.content?.parts?.[0]?.text).toBeTruthy();
          return;
        }

        const resp = await fetch(`${getBaseUrl(source)}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(source, 'SpeakLab Model Catalog Smoke Test'),
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'Reply in exactly 3 words.' },
              { role: 'user', content: 'Say hi' },
            ],
            max_tokens: 20,
            temperature: 0,
          }),
        });
        expect(resp.ok).toBe(true);
        const data = await resp.json();
        expect(data?.choices?.[0]?.message?.content).toBeTruthy();
      }, 90_000);
    }
  });

  describe('stt', () => {
    for (const { model, source } of STT_TESTS) {
      providerTest(source)(`${source}:${model}`, async () => {
        if (source === 'genai') {
          const resp = await fetch(
            `${getBaseUrl('genai')}/models/${model}:generateContent?key=${keys.genai!}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { inlineData: { mimeType: 'audio/wav', data: wavBase64 } },
                      { text: 'Transcribe this audio' },
                    ],
                  },
                ],
              }),
            },
          );
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          expect(typeof data?.candidates?.[0]?.content?.parts?.[0]?.text).toBe('string');
          return;
        }

        if (source === 'openrouter') {
          const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders('openrouter', 'SpeakLab Model Catalog Smoke Test'),
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: 'What is in this audio?' },
                    { type: 'input_audio', input_audio: { data: wavBase64, format: 'wav' } },
                  ],
                },
              ],
            }),
          });
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          expect(data?.choices?.[0]?.message?.content).toBeTruthy();
          return;
        }

        const formData = new FormData();
        formData.append('file', new Blob([Buffer.from(wavBase64, 'base64')], { type: 'audio/wav' }), 'test.wav');
        formData.append('model', model);
        formData.append('language', 'en');

        const resp = await fetch(`${getBaseUrl(source)}/audio/transcriptions`, {
          method: 'POST',
          headers: getAuthHeaders(source, 'SpeakLab Model Catalog Smoke Test'),
          body: formData,
        });
        expect(resp.ok).toBe(true);
        const data = await resp.json();
        expect(typeof data?.text).toBe('string');
      }, 90_000);
    }
  });

  describe('tts', () => {
    for (const { model, source, voice } of TTS_TESTS) {
      providerTest(source)(`${source}:${model}`, async () => {
        if (source === 'genai') {
          const resp = await fetch(
            `${getBaseUrl('genai')}/models/${model}:generateContent?key=${keys.genai!}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Say: Hello there!' }] }],
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
                  },
                },
              }),
            },
          );
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          expect(data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data).toBeTruthy();
          return;
        }

        const responseFormat = source === 'groq' ? 'wav' : 'mp3';
        const resp = await fetch(`${getBaseUrl(source)}/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(source, 'SpeakLab Model Catalog Smoke Test'),
          },
          body: JSON.stringify({
            model,
            voice,
            input: 'Hi there!',
            response_format: responseFormat,
          }),
        });
        expect(resp.ok).toBe(true);
        expect((await resp.arrayBuffer()).byteLength).toBeGreaterThan(0);
      }, 90_000);
    }
  });

  describe('image', () => {
    for (const { model, source } of IMAGE_TESTS) {
      providerTest(source)(`${source}:${model}`, async () => {
        if (source === 'genai') {
          const resp = await fetch(
            `${getBaseUrl('genai')}/models/${model}:generateContent?key=${keys.genai!}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Generate an image of a simple red circle on white background' }] }],
                generationConfig: { responseModalities: ['IMAGE'] },
              }),
            },
          );
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          const imagePart = data?.candidates?.[0]?.content?.parts?.find(
            (part: { inlineData?: unknown }) => Boolean(part.inlineData),
          );
          expect(Boolean(imagePart)).toBe(true);
          return;
        }

        if (source === 'openrouter') {
          const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders('openrouter', 'SpeakLab Model Catalog Smoke Test'),
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Generate a simple red circle on white background' }],
              modalities: ['image'],
            }),
          });
          expect(resp.ok).toBe(true);
          const data = await resp.json();
          const message = data?.choices?.[0]?.message;
          expect(Boolean(message?.images?.length || message?.content)).toBe(true);
          return;
        }

        const resp = await fetch(`${getBaseUrl(source)}/images/generations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(source, 'SpeakLab Model Catalog Smoke Test'),
          },
          body: JSON.stringify({
            model,
            prompt: 'A simple red circle on white background',
            n: 1,
            size: '1024x1024',
            quality: 'low',
          }),
        });
        expect(resp.ok).toBe(true);
        const data = await resp.json();
        expect(Boolean(data?.data?.[0]?.url || data?.data?.[0]?.b64_json)).toBe(true);
      }, 90_000);
    }
  });
});
