import { GoogleGenAI, Modality } from '@google/genai';
import { getOpenAIKey, getGeminiKey, getGroqKey, getCachedAudio, setCachedAudio, getModelConfig } from './storage';
import { pcm16Base64ToWavBase64 } from '../utils/audio';
import type { Provider } from '../types/settings';

const OPENAI_BASE = 'https://api.openai.com/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GROQ_BASE = '/api/groq';

function openaiHeaders(): Record<string, string> {
  const key = getOpenAIKey();
  if (!key) throw new Error('OpenAI API key not configured. Go to Settings to add it.');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function groqHeaders(): Record<string, string> {
  const key = getGroqKey();
  if (!key) throw new Error('Groq API key not configured. Go to Settings to add it.');
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function getGeminiAI(): GoogleGenAI {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add it.');
  return new GoogleGenAI({ apiKey: key });
}

// ---------------------------------------------------------------------------
// Helpers for provider detection from model overrides
// ---------------------------------------------------------------------------

function detectProvider(modelId: string): Provider {
  if (modelId.startsWith('gemini')) return 'gemini';
  // Groq models use slashes (meta-llama/, qwen/, canopylabs/) or specific IDs
  if (
    modelId.startsWith('llama-') ||
    modelId.startsWith('meta-llama/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('canopylabs/') ||
    modelId.startsWith('whisper-large-v3')
  ) {
    return 'groq';
  }
  return 'openai';
}

// ---------------------------------------------------------------------------
// Internal dispatch helpers (used by both primary and fallback paths)
// ---------------------------------------------------------------------------

async function callChat(
  provider: Provider,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  if (provider === 'gemini') return geminiChat(systemPrompt, userMessage, model);
  if (provider === 'groq') return groqChat(systemPrompt, userMessage, model);
  return openaiChat(systemPrompt, userMessage, model);
}

async function callSTT(
  provider: Provider,
  model: string,
  audioBlob: Blob,
): Promise<string> {
  if (provider === 'gemini') return geminiSTT(audioBlob, model);
  if (provider === 'groq') return groqSTT(audioBlob, model);
  return openaiSTT(audioBlob, model);
}

async function callTTS(
  provider: Provider,
  model: string,
  voice: string,
  text: string,
): Promise<string> {
  if (provider === 'gemini') return geminiTTS(text, voice, model);
  if (provider === 'groq') return groqTTS(text, voice, model);
  return openaiTTS(text, voice, model);
}

// ===== Chat Completions (supports OpenAI, Gemini, and Groq) =====

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  modelOverride?: string
): Promise<string> {
  const config = getModelConfig();
  const model = modelOverride || config.chatModel;
  const provider = modelOverride ? detectProvider(modelOverride) : config.chatProvider;

  try {
    return await callChat(provider, model, systemPrompt, userMessage);
  } catch (primaryError) {
    if (!modelOverride && config.chatFallbackModel && config.chatFallbackProvider) {
      console.warn('Primary chat failed, trying fallback:', primaryError);
      return await callChat(config.chatFallbackProvider, config.chatFallbackModel, systemPrompt, userMessage);
    }
    throw primaryError;
  }
}

async function openaiChat(systemPrompt: string, userMessage: string, model: string): Promise<string> {
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

async function geminiChat(systemPrompt: string, userMessage: string, model: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add it.');

  const resp = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.8 },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.candidates[0].content.parts[0].text;
}

async function groqChat(systemPrompt: string, userMessage: string, model: string): Promise<string> {
  const resp = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: groqHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq API error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ===== Chat Completions with Image (supports OpenAI and Gemini -- Groq not supported) =====

export async function chatCompletionWithImage(
  systemPrompt: string,
  imageUrl: string
): Promise<string> {
  const config = getModelConfig();

  // Groq does not support image input; fall back to chat provider logic for openai/gemini
  const provider = config.chatProvider === 'groq' ? 'gemini' : config.chatProvider;
  const model = config.chatProvider === 'groq' ? 'gemini-2.5-flash' : config.chatModel;

  if (provider === 'gemini') {
    return geminiChatWithImage(systemPrompt, imageUrl, model);
  }
  return openaiChatWithImage(systemPrompt, imageUrl, model);
}

async function openaiChatWithImage(systemPrompt: string, imageUrl: string, model: string): Promise<string> {
  const resp = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: 'Please create a question about this image as instructed.' },
          ],
        },
      ],
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

async function geminiChatWithImage(systemPrompt: string, imageUrl: string, model: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add it.');

  // Extract base64 data from data URL or fetch the image
  let imageData: string;
  let mimeType: string;

  if (!imageUrl) {
    throw new Error('Image URL is missing (undefined or empty).');
  }

  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid data URL for image');
    mimeType = match[1];
    imageData = match[2];
  } else {
    // Fetch remote image and convert to base64
    const imgResp = await fetch(imageUrl);
    const blob = await imgResp.blob();
    mimeType = blob.type || 'image/png';
    imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const resp = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageData } },
            { text: 'Please create a question about this image as instructed.' },
          ],
        }],
        generationConfig: { temperature: 0.8 },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.candidates[0].content.parts[0].text;
}

// ===== Text to Speech (supports OpenAI, Gemini, and Groq) =====

export async function textToSpeech(
  text: string,
  voiceOverride?: string
): Promise<string> {
  const config = getModelConfig();
  const voice = voiceOverride || config.ttsVoice;
  const model = config.ttsModel;
  const provider = config.ttsProvider;

  // Check cache first
  const cacheKey = `tts_${voice}_${text.substring(0, 100)}`;
  const cached = getCachedAudio(cacheKey);
  if (cached) return cached;

  let base64: string;

  try {
    base64 = await callTTS(provider, model, voice, text);
  } catch (primaryError) {
    if (config.ttsFallbackModel && config.ttsFallbackProvider) {
      console.warn('Primary TTS failed, trying fallback:', primaryError);
      const fallbackVoice = config.ttsFallbackVoice || voice;
      base64 = await callTTS(config.ttsFallbackProvider, config.ttsFallbackModel, fallbackVoice, text);
    } else {
      throw primaryError;
    }
  }

  // Cache it
  try {
    setCachedAudio(cacheKey, base64);
  } catch {
    // Storage full, ignore
  }

  return base64;
}

async function openaiTTS(text: string, voice: string, model: string): Promise<string> {
  const resp = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI TTS error: ${resp.status} - ${err}`);
  }

  const blob = await resp.blob();
  return blobToBase64(blob);
}

async function geminiTTS(text: string, voice: string, model: string): Promise<string> {
  const ai = getGeminiAI();

  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
  });

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) {
    throw new Error('Gemini TTS returned no audio data');
  }

  // Gemini returns raw PCM16 at 24kHz. Wrap in WAV header so browsers can play it.
  return pcm16Base64ToWavBase64(audioData, 24000);
}

/**
 * Groq Orpheus TTS. Limited to 200 characters per request.
 * For longer texts, we split into sentence-sized chunks, generate each,
 * and concatenate the WAV buffers.
 */
async function groqTTS(text: string, voice: string, model: string): Promise<string> {
  const MAX_CHARS = 200;

  if (text.length <= MAX_CHARS) {
    return groqTTSSingle(text, voice, model);
  }

  // Split text into chunks on sentence boundaries
  const chunks = splitTextForTTS(text, MAX_CHARS);
  const wavBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const base64 = await groqTTSSingle(chunk, voice, model);
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    wavBuffers.push(buffer);
  }

  // Concatenate WAV data (skip headers for all but first, then rebuild header)
  return concatenateWavBuffers(wavBuffers);
}

async function groqTTSSingle(text: string, voice: string, model: string): Promise<string> {
  const resp = await fetch(`${GROQ_BASE}/audio/speech`, {
    method: 'POST',
    headers: groqHeaders(),
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'wav',
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq TTS error: ${resp.status} - ${err}`);
  }

  const blob = await resp.blob();
  return blobToBase64(blob);
}

/** Split text into chunks of at most maxChars, preferring sentence boundaries. */
function splitTextForTTS(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    // Try to find the last sentence-ending punctuation within the limit
    let splitIdx = -1;
    for (const sep of ['. ', '! ', '? ', '.\n', '!\n', '?\n']) {
      const idx = remaining.lastIndexOf(sep, maxChars);
      if (idx > 0 && idx > splitIdx) {
        splitIdx = idx + sep.length;
      }
    }
    // Fallback: split on last space
    if (splitIdx <= 0) {
      splitIdx = remaining.lastIndexOf(' ', maxChars);
    }
    // Last resort: hard cut
    if (splitIdx <= 0) {
      splitIdx = maxChars;
    }

    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/** Concatenate multiple WAV buffers (all same format) into a single base64 WAV string. */
function concatenateWavBuffers(buffers: ArrayBuffer[]): string {
  if (buffers.length === 0) throw new Error('No WAV buffers to concatenate');
  if (buffers.length === 1) {
    const bytes = new Uint8Array(buffers[0]);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  // WAV header is 44 bytes. Extract raw PCM data from each buffer (skip 44-byte header).
  const headerSize = 44;
  const pcmChunks: Uint8Array[] = [];
  let totalPcmLength = 0;

  // Use the header from the first buffer as template
  const firstHeader = new Uint8Array(buffers[0].slice(0, headerSize));

  for (const buf of buffers) {
    const pcm = new Uint8Array(buf.slice(headerSize));
    pcmChunks.push(pcm);
    totalPcmLength += pcm.length;
  }

  // Build new WAV with updated sizes
  const result = new Uint8Array(headerSize + totalPcmLength);
  result.set(firstHeader, 0);

  // Update RIFF chunk size (offset 4, little-endian uint32): totalSize - 8
  const riffSize = headerSize + totalPcmLength - 8;
  result[4] = riffSize & 0xff;
  result[5] = (riffSize >> 8) & 0xff;
  result[6] = (riffSize >> 16) & 0xff;
  result[7] = (riffSize >> 24) & 0xff;

  // Update data sub-chunk size (offset 40, little-endian uint32): totalPcmLength
  result[40] = totalPcmLength & 0xff;
  result[41] = (totalPcmLength >> 8) & 0xff;
  result[42] = (totalPcmLength >> 16) & 0xff;
  result[43] = (totalPcmLength >> 24) & 0xff;

  // Copy PCM data
  let offset = headerSize;
  for (const pcm of pcmChunks) {
    result.set(pcm, offset);
    offset += pcm.length;
  }

  // Convert to base64
  let binary = '';
  for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
  return btoa(binary);
}

// ===== Image Generation (supports OpenAI and Gemini -- no Groq) =====

export type ImageGenerationOptions = {
  // OpenAI parameters
  size?: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  quality?: 'auto' | 'low' | 'medium' | 'high';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number; // 0-100, for JPEG/WebP
  background?: 'opaque' | 'transparent';
  moderation?: 'auto' | 'low';

  // Imagen parameters
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize?: '1K' | '2K';
  personGeneration?: 'allow_adult' | 'allow_all' | 'dont_allow';
  numberOfImages?: number; // 1-4
};

export async function generateImage(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> {
  const config = getModelConfig();

  if (config.imageProvider === 'gemini') {
    return geminiImageGeneration(prompt, config.imageModel, options);
  }
  return openaiImageGeneration(prompt, config.imageModel, options);
}

async function openaiImageGeneration(
  prompt: string,
  model: string,
  options?: ImageGenerationOptions
): Promise<string> {
  const body: Record<string, any> = {
    model,
    prompt,
    n: 1,
  };

  // Apply options if provided
  if (options?.size) body.size = options.size;
  if (options?.quality) body.quality = options.quality;
  // Note: OpenAI Images API doesn't support format parameter (always returns URL or b64_json)
  if (options?.compression !== undefined) body.output_compression = options.compression;
  if (options?.background) body.background = options.background;
  if (options?.moderation) body.moderation = options.moderation;

  const resp = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI Image error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();

  if (data.data && data.data[0]) {
    if (data.data[0].url) {
      return data.data[0].url;
    }
    if (data.data[0].b64_json) {
      // OpenAI always returns PNG for b64_json
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
  }

  throw new Error(`OpenAI response missing image URL or b64_json: ${JSON.stringify(data)}`);
}

async function geminiImageGeneration(
  prompt: string,
  model: string,
  options?: ImageGenerationOptions
): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add it.');

  // Check if it's an Imagen dedicated model or a Gemini multimodal model
  const isImagenModel = model.startsWith('imagen-');

  if (isImagenModel) {
    // Use the 'predict' endpoint for Imagen dedicated models
    const generationConfig: Record<string, any> = {
      responseModalities: ['IMAGE'],
    };

    // Apply Imagen-specific options
    if (options?.aspectRatio) {
      generationConfig.aspectRatio = options.aspectRatio;
    }
    if (options?.imageSize) {
      generationConfig.imageSize = options.imageSize;
    }
    if (options?.personGeneration) {
      generationConfig.personGeneration = options.personGeneration;
    }
    if (options?.numberOfImages) {
      generationConfig.numberOfImages = Math.min(Math.max(options.numberOfImages, 1), 4);
    } else {
      generationConfig.numberOfImages = 1;
    }

    const resp = await fetch(
      `${GEMINI_BASE}/models/${model}:predict?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: generationConfig,
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini Image error: ${resp.status} - ${err}`);
    }

    const data = await resp.json();

    if (data.predictions && data.predictions[0]) {
      const bytesBase64 = data.predictions[0].bytesBase64;
      if (bytesBase64) {
        return `data:image/png;base64,${bytesBase64}`;
      }
    }

    throw new Error('Gemini did not return an image.');
  } else {
    // Use 'generateContent' endpoint for Gemini multimodal models
    const generationConfig: Record<string, any> = {
      responseModalities: ['IMAGE'],
    };

    // Apply supported options
    if (options?.aspectRatio) {
      generationConfig.aspectRatio = options.aspectRatio;
    }
    if (options?.imageSize) {
      generationConfig.imageSize = options.imageSize;
    }

    const resp = await fetch(
      `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini Image error: ${resp.status} - ${err}`);
    }

    const data = await resp.json();

    // Gemini multimodal models return data in a different format
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('Gemini did not return an image.');
  }
}

// ===== Speech to Text (supports OpenAI, Gemini, and Groq) =====

export async function speechToText(audioBlob: Blob): Promise<string> {
  const config = getModelConfig();

  try {
    return await callSTT(config.sttProvider, config.sttModel, audioBlob);
  } catch (primaryError) {
    if (config.sttFallbackModel && config.sttFallbackProvider) {
      console.warn('Primary STT failed, trying fallback:', primaryError);
      return await callSTT(config.sttFallbackProvider, config.sttFallbackModel, audioBlob);
    }
    throw primaryError;
  }
}

async function openaiSTT(audioBlob: Blob, model: string): Promise<string> {
  const key = getOpenAIKey();
  if (!key) throw new Error('OpenAI API key not configured.');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model);
  formData.append('language', 'en');
  formData.append('prompt', 'Transcribe exactly what was said, including any errors or mispronunciations. Do not correct or improve the speech.');

  const resp = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI STT error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.text;
}

async function geminiSTT(audioBlob: Blob, model: string): Promise<string> {
  const ai = getGeminiAI();

  // Convert blob to base64
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const mimeType = audioBlob.type || 'audio/webm';

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Audio } },
        { text: 'Transcribe exactly what was said in English. Output ONLY the transcription text, nothing else. Include any errors or mispronunciations as-is. Do not correct the speech.' },
      ],
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini STT returned no text');
  return text.trim();
}

async function groqSTT(audioBlob: Blob, model: string): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('Groq API key not configured.');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', model);
  formData.append('language', 'en');
  formData.append('prompt', 'Transcribe exactly what was said, including any errors or mispronunciations. Do not correct or improve the speech.');

  const resp = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Groq STT error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  return data.text;
}

// ===== Helpers =====

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
