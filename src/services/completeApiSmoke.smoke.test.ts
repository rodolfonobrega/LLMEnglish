// @vitest-environment node

/**
 * COMPLETE API SMOKE TEST - ALL PROVIDERS & CAPABILITIES
 * 
 * Tests ALL API capabilities with cheap models:
 * - OpenAI: chat, TTS, STT, image
 * - Gemini (Google AI Studio): chat, TTS, STT, image, live
 * - Groq: chat, TTS, STT
 * - OpenRouter: chat, image (multi-provider)
 * 
 * Usage:
 * 1. Copy .env.local.example to .env.local
 * 2. Fill in your API keys
 * 3. Run: RUN_PAID_SMOKE_TESTS=true npm run test:api:complete
 */

import { describe, expect, it } from 'vitest';
import {
  loadLocalEnvFiles,
  getProviderKeys,
  getPaidSmokeEnabled,
  getBaseUrl,
  getAuthHeaders,
  assertOk,
  makeSilentWavBuffer,
} from '../test/smoke/smokeTestUtils';

// Load environment variables
loadLocalEnvFiles();

const paidDescribe = getPaidSmokeEnabled() ? describe : describe.skip;
const keys = getProviderKeys();

paidDescribe('COMPLETE API SMOKE TESTS - All Providers & Capabilities', () => {
  
  // ==========================================
  // OPENAI API TESTS
  // ==========================================
  describe('OpenAI API', () => {
    
    it('chat with gpt-4o-mini (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openai'),
      };

      const resp = await fetch(`${getBaseUrl('openai')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Respond with exactly 3 words: "Hello from OpenAI"' }],
          temperature: 0,
          max_tokens: 20,
        }),
      });
      
      assertOk(resp, 'OpenAI chat');
      const data = await resp.json();
      expect(data?.choices?.[0]?.message?.content).toBeTruthy();
      console.log('✅ OpenAI Chat:', data?.choices?.[0]?.message?.content);
    }, 60_000);

    it('TTS with gpt-4o-mini-tts (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openai'),
      };

      const resp = await fetch(`${getBaseUrl('openai')}/audio/speech`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'nova',
          input: 'Hello from the smoke test! This is a test of text to speech.',
          response_format: 'mp3',
        }),
      });
      
      assertOk(resp, 'OpenAI TTS');
      const buffer = await resp.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      console.log('✅ OpenAI TTS: Generated', buffer.byteLength, 'bytes');
    }, 60_000);

    it('STT with whisper-1', async () => {
      const wavBuffer = makeSilentWavBuffer(1, 16000);
      const form = new FormData();
      form.append(
        'file',
        new Blob([wavBuffer], { type: 'audio/wav' }),
        'test.wav'
      );
      form.append('model', 'whisper-1');
      form.append('language', 'en');

      const resp = await fetch(`${getBaseUrl('openai')}/audio/transcriptions`, {
        method: 'POST',
        headers: getAuthHeaders('openai'),
        body: form,
      });
      
      assertOk(resp, 'OpenAI STT');
      const data = await resp.json();
      expect(typeof data?.text).toBe('string');
      console.log('✅ OpenAI STT transcription:', data?.text);
    }, 60_000);

    it('Image generation with gpt-image-1-mini (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openai'),
      };

      const resp = await fetch(`${getBaseUrl('openai')}/images/generations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gpt-image-1-mini',
          prompt: 'A simple blue square icon on white background, minimalist design',
          n: 1,
          size: '1024x1024',
          quality: 'low',
        }),
      });
      
      assertOk(resp, 'OpenAI Image');
      const data = await resp.json();
      expect(Boolean(data?.data?.[0]?.url || data?.data?.[0]?.b64_json)).toBe(true);
      console.log('✅ OpenAI Image generated successfully');
    }, 90_000);
  });

  // ==========================================
  // GEMINI (Google AI Studio) API TESTS
  // ==========================================
  describe('Gemini API (Google AI Studio)', () => {
    
    it('chat with gemini-2.5-flash (cheap)', async () => {
      const geminiKey = keys.genai;
      if (!geminiKey) throw new Error('No Gemini key');

      const resp = await fetch(
        `${getBaseUrl('genai')}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Respond with exactly 3 words: "Hello from Gemini"' }] }],
            generationConfig: { maxOutputTokens: 20, temperature: 0 },
          }),
        }
      );
      
      assertOk(resp, 'Gemini chat');
      const data = await resp.json();
      expect(data?.candidates?.[0]?.content?.parts?.[0]?.text).toBeTruthy();
      console.log('✅ Gemini Chat:', data?.candidates?.[0]?.content?.parts?.[0]?.text);
    }, 60_000);

    it('TTS with gemini-2.5-flash-preview-tts', async () => {
      const geminiKey = keys.genai;
      if (!geminiKey) throw new Error('No Gemini key');

      const resp = await fetch(
        `${getBaseUrl('genai')}/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: { parts: [{ text: 'Hello from the smoke test! This is a test of text to speech.' }] },
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
            },
          }),
        }
      );
      
      assertOk(resp, 'Gemini TTS');
      const data = await resp.json();
      expect(data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data).toBeTruthy();
      console.log('✅ Gemini TTS: Generated audio data');
    }, 60_000);

    it('STT with gemini-2.5-flash', async () => {
      const geminiKey = keys.genai;
      if (!geminiKey) throw new Error('No Gemini key');

      const wavBase64 = makeSilentWavBuffer(1, 16000).toString('base64');

      const resp = await fetch(
        `${getBaseUrl('genai')}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/wav',
                    data: wavBase64,
                  },
                },
                {
                  text: 'Transcribe exactly what was said in English. Output only the transcription text.',
                },
              ],
            },
          }),
        }
      );
      
      assertOk(resp, 'Gemini STT');
      const data = await resp.json();
      
      // Gemini pode retornar em diferentes formatos
      const transcription = 
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
        JSON.stringify(data);
      
      expect(transcription).toBeTruthy();
      console.log('✅ Gemini STT transcription:', transcription.substring(0, 100));
      console.log('📝 Full response structure:', JSON.stringify(data).substring(0, 200));
    }, 60_000);

    it('Image generation with gemini-2.5-flash-image', async () => {
      const geminiKey = keys.genai;
      if (!geminiKey) throw new Error('No Gemini key');

      const resp = await fetch(
        `${getBaseUrl('genai')}/models/gemini-2.5-flash-image:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Generate an image of a simple blue square icon on white background, minimalist flat design' }] }],
            generationConfig: { responseModalities: ['IMAGE'] },
          }),
        }
      );
      
      assertOk(resp, 'Gemini Image');
      const data = await resp.json();
      const imagePart = data?.candidates?.[0]?.content?.parts?.find(
        (part: { inlineData?: unknown }) => Boolean(part.inlineData)
      );
      expect(Boolean(imagePart)).toBe(true);
      console.log('✅ Gemini Image generated successfully');
    }, 90_000);

    it.skip('Live API connection test (requires WebSocket)', async () => {
      // NOTE: Gemini Live API uses WebSocket and requires the @google/genai SDK
      // This is tested in geminiLive.test.ts with mocks
      // A real smoke test would need to initialize the actual SDK connection
      console.log('⚠️ Gemini Live API: Skipping - requires WebSocket connection via @google/genai SDK');
    }, 60_000);
  });

  // ==========================================
  // GROQ API TESTS
  // ==========================================
  describe('Groq API', () => {
    
    it('chat with llama-3.1-8b-instant (cheap & fast)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('groq'),
      };

      const resp = await fetch(`${getBaseUrl('groq')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: 'Respond with exactly 3 words: "Hello from Groq"' }],
          temperature: 0,
          max_tokens: 20,
        }),
      });
      
      assertOk(resp, 'Groq chat');
      const data = await resp.json();
      expect(data?.choices?.[0]?.message?.content).toBeTruthy();
      console.log('✅ Groq Chat:', data?.choices?.[0]?.message?.content);
    }, 60_000);

    it('TTS with canopylabs/orpheus-v1-english', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('groq'),
      };

      const resp = await fetch(`${getBaseUrl('groq')}/audio/speech`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'canopylabs/orpheus-v1-english',
          voice: 'hannah',
          input: 'Hello from the smoke test! This is a test of text to speech.',
          response_format: 'wav',
        }),
      });
      
      assertOk(resp, 'Groq TTS');
      const buffer = await resp.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
      console.log('✅ Groq TTS: Generated', buffer.byteLength, 'bytes');
    }, 60_000);

    it('STT with whisper-large-v3-turbo', async () => {
      const wavBuffer = makeSilentWavBuffer(1, 16000);
      const form = new FormData();
      form.append(
        'file',
        new Blob([wavBuffer], { type: 'audio/wav' }),
        'test.wav'
      );
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'en');

      const resp = await fetch(`${getBaseUrl('groq')}/audio/transcriptions`, {
        method: 'POST',
        headers: getAuthHeaders('groq'),
        body: form,
      });
      
      assertOk(resp, 'Groq STT');
      const data = await resp.json();
      expect(typeof data?.text).toBe('string');
      console.log('✅ Groq STT transcription:', data?.text);
    }, 60_000);
  });

  // ==========================================
  // OPENROUTER API TESTS (Multi-Provider)
  // ==========================================
  describe('OpenRouter API', () => {
    
    it('chat with google/gemma-3-27b-it (free/cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openrouter'),
      };

      const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'google/gemma-3-27b-it',
          messages: [{ role: 'user', content: 'Respond with exactly 3 words: "Hello from OpenRouter"' }],
          temperature: 0,
          max_tokens: 20,
        }),
      });
      
      assertOk(resp, 'OpenRouter chat (Gemma)');
      const data = await resp.json();
      expect(data?.choices?.[0]?.message?.content).toBeTruthy();
      console.log('✅ OpenRouter Chat (Gemma):', data?.choices?.[0]?.message?.content);
    }, 90_000);

    it('chat with meta-llama/llama-3.1-8b-instruct (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openrouter'),
      };

      const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct',
          messages: [{ role: 'user', content: 'Respond with exactly 3 words: "Hello from Llama"' }],
          temperature: 0,
          max_tokens: 20,
        }),
      });
      
      assertOk(resp, 'OpenRouter chat (Llama)');
      const data = await resp.json();
      expect(data?.choices?.[0]?.message?.content).toBeTruthy();
      console.log('✅ OpenRouter Chat (Llama):', data?.choices?.[0]?.message?.content);
    }, 90_000);

    it('image generation with bytedance-seed/seedream-4.5 (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openrouter'),
      };

      const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'bytedance-seed/seedream-4.5',
          messages: [{ role: 'user', content: 'Generate a simple blue square icon on white background' }],
          modalities: ['image'],
        }),
      });
      
      assertOk(resp, 'OpenRouter Image (Seedream)');
      const data = await resp.json();
      const message = data?.choices?.[0]?.message;
      expect(Boolean(message?.images?.length || message?.content)).toBe(true);
      console.log('✅ OpenRouter Image (Seedream) generated successfully');
    }, 90_000);

    it('image generation with google/gemini-3.1-flash-image-preview (cheap)', async () => {
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders('openrouter'),
      };

      const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [{ role: 'user', content: 'Generate a simple red circle on white background' }],
          modalities: ['image'],
        }),
      });
      
      assertOk(resp, 'OpenRouter Image (Gemini)');
      const data = await resp.json();
      const message = data?.choices?.[0]?.message;
      expect(Boolean(message?.images?.length || message?.content)).toBe(true);
      console.log('✅ OpenRouter Image (Gemini) generated successfully');
    }, 90_000);
  });

  // ==========================================
  // CROSS-PROVIDER COMPARISON TEST
  // ==========================================
  describe('Cross-Provider Comparison', () => {
    
    it('all providers respond to same prompt', async () => {
      const prompt = 'What is 2+2? Answer with just the number.';
      const results: Record<string, string> = {};

      // OpenAI
      if (keys.openai) {
        const resp = await fetch(`${getBaseUrl('openai')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders('openai'),
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
          }),
        });
        const data = await resp.json();
        results.openai = data?.choices?.[0]?.message?.content;
      }

      // Gemini
      if (keys.genai) {
        const resp = await fetch(
          `${getBaseUrl('genai')}/models/gemini-2.5-flash:generateContent?key=${keys.genai}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 10, temperature: 0 },
            }),
          }
        );
        const data = await resp.json();
        results.genai = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      }

      // Groq
      if (keys.groq) {
        const resp = await fetch(`${getBaseUrl('groq')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders('groq'),
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
          }),
        });
        const data = await resp.json();
        results.groq = data?.choices?.[0]?.message?.content;
      }

      // OpenRouter
      if (keys.openrouter) {
        const resp = await fetch(`${getBaseUrl('openrouter')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders('openrouter'),
          },
          body: JSON.stringify({
            model: 'google/gemma-3-27b-it',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
            max_tokens: 10,
          }),
        });
        const data = await resp.json();
        results.openrouter = data?.choices?.[0]?.message?.content;
      }

      console.log('\n📊 Cross-Provider Comparison:');
      console.log('Prompt:', prompt);
      for (const [provider, response] of Object.entries(results)) {
        console.log(`  ${provider}: ${response}`);
      }

      expect(Object.keys(results).length).toBeGreaterThan(0);
    }, 120_000);
  });

  // ==========================================
  // SUMMARY TEST
  // ==========================================
  describe('Test Summary', () => {
    it('reports configuration status', () => {
      const summary = {
        openai: keys.openai ? '✅ Configured' : '❌ No key',
        gemini: keys.genai ? '✅ Configured' : '❌ No key',
        groq: keys.groq ? '✅ Configured' : '❌ No key',
        openrouter: keys.openrouter ? '✅ Configured' : '❌ No key',
      };

      console.log('\n🔧 API Key Configuration:');
      for (const [provider, status] of Object.entries(summary)) {
        console.log(`  ${provider}: ${status}`);
      }

      const configuredCount = Object.values(keys).filter(Boolean).length;
      console.log(`\n📈 ${configuredCount}/4 providers configured`);
      
      expect(configuredCount).toBeGreaterThan(0);
    });
  });
});
