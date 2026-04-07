// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  assertOk,
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

paidDescribe('paid provider capability smoke tests', () => {
  const openAiIt = keys.openai ? it : it.skip;
  const geminiIt = keys.genai ? it : it.skip;
  const groqIt = keys.groq ? it : it.skip;

  openAiIt('checks OpenAI chat, TTS, image and STT', async () => {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders('openai'),
    };

    const chatModel = process.env.SMOKE_OPENAI_CHAT_MODEL || 'gpt-4o-mini';
    const chatResp = await fetch(`${getBaseUrl('openai')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'user', content: 'Say only: ok' }],
        temperature: 0,
      }),
    });
    assertOk(chatResp, 'OpenAI chat');
    const chatData = await chatResp.json();
    expect(chatData?.choices?.[0]?.message?.content).toBeTruthy();

    const ttsModel = process.env.SMOKE_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
    const ttsResp = await fetch(`${getBaseUrl('openai')}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ttsModel,
        voice: 'nova',
        input: 'Hello from smoke test.',
        response_format: 'mp3',
      }),
    });
    assertOk(ttsResp, 'OpenAI TTS');
    expect((await ttsResp.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const imageModel = process.env.SMOKE_OPENAI_IMAGE_MODEL || 'gpt-image-1-mini';
    const imageResp = await fetch(`${getBaseUrl('openai')}/images/generations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: imageModel,
        prompt: 'A simple blue square icon',
        n: 1,
      }),
    });
    assertOk(imageResp, 'OpenAI image');
    const imageData = await imageResp.json();
    expect(Boolean(imageData?.data?.[0]?.url || imageData?.data?.[0]?.b64_json)).toBe(true);

    const sttModel = process.env.SMOKE_OPENAI_STT_MODEL || 'whisper-1';
    const sttForm = new FormData();
    sttForm.append(
      'file',
      new Blob([makeSilentWavBuffer()], { type: 'audio/wav' }),
      'sample.wav',
    );
    sttForm.append('model', sttModel);
    sttForm.append('language', 'en');

    const sttResp = await fetch(`${getBaseUrl('openai')}/audio/transcriptions`, {
      method: 'POST',
      headers: getAuthHeaders('openai'),
      body: sttForm,
    });
    assertOk(sttResp, 'OpenAI STT');
    const sttData = await sttResp.json();
    expect(typeof sttData?.text).toBe('string');
  }, 120_000);

  geminiIt('checks Gemini chat, TTS, image and STT', async () => {
    const key = keys.genai!;

    const chatModel = process.env.SMOKE_GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
    const chatResp = await fetch(
      `${getBaseUrl('genai')}/models/${chatModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say only: ok' }] }],
        }),
      },
    );
    assertOk(chatResp, 'Gemini chat');
    const chatData = await chatResp.json();
    expect(chatData?.candidates?.[0]?.content?.parts?.[0]?.text).toBeTruthy();

    const ttsModel = process.env.SMOKE_GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    const ttsResp = await fetch(
      `${getBaseUrl('genai')}/models/${ttsModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: { parts: [{ text: 'Hello from smoke test.' }] },
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
          },
        }),
      },
    );
    assertOk(ttsResp, 'Gemini TTS');
    const ttsData = await ttsResp.json();
    expect(
      ttsData?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data,
    ).toBeTruthy();

    const imageModel = process.env.SMOKE_GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const imageResp = await fetch(
      `${getBaseUrl('genai')}/models/${imageModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'A simple blue square icon' }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
    assertOk(imageResp, 'Gemini image');
    const imageData = await imageResp.json();
    const imagePart = imageData?.candidates?.[0]?.content?.parts?.find(
      (part: { inlineData?: unknown }) => Boolean(part.inlineData),
    );
    expect(Boolean(imagePart)).toBe(true);

    const sttModel = process.env.SMOKE_GEMINI_STT_MODEL || 'gemini-2.5-flash';
    const sttResp = await fetch(
      `${getBaseUrl('genai')}/models/${sttModel}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: makeSilentWavBuffer().toString('base64'),
                },
              },
              {
                text: 'Transcribe exactly what was said in English. Output only the transcription text.',
              },
            ],
          },
        }),
      },
    );
    assertOk(sttResp, 'Gemini STT');
    const sttData = await sttResp.json();
    expect(typeof sttData?.candidates?.[0]?.content?.parts?.[0]?.text).toBe('string');
  }, 120_000);

  groqIt('checks Groq chat, TTS and STT', async () => {
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders('groq'),
    };

    const chatModel = process.env.SMOKE_GROQ_CHAT_MODEL || 'llama-3.1-8b-instant';
    const chatResp = await fetch(`${getBaseUrl('groq')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: 'user', content: 'Say only: ok' }],
        temperature: 0,
      }),
    });
    assertOk(chatResp, 'Groq chat');
    const chatData = await chatResp.json();
    expect(chatData?.choices?.[0]?.message?.content).toBeTruthy();

    const ttsModel = process.env.SMOKE_GROQ_TTS_MODEL || 'canopylabs/orpheus-v1-english';
    const ttsResp = await fetch(`${getBaseUrl('groq')}/audio/speech`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: ttsModel,
        voice: 'hannah',
        input: 'Hello from smoke test.',
        response_format: 'wav',
      }),
    });
    assertOk(ttsResp, 'Groq TTS');
    expect((await ttsResp.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const sttModel = process.env.SMOKE_GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    const sttForm = new FormData();
    sttForm.append(
      'file',
      new Blob([makeSilentWavBuffer()], { type: 'audio/wav' }),
      'sample.wav',
    );
    sttForm.append('model', sttModel);
    sttForm.append('language', 'en');

    const sttResp = await fetch(`${getBaseUrl('groq')}/audio/transcriptions`, {
      method: 'POST',
      headers: getAuthHeaders('groq'),
      body: sttForm,
    });
    assertOk(sttResp, 'Groq STT');
    const sttData = await sttResp.json();
    expect(typeof sttData?.text).toBe('string');
  }, 120_000);
});
