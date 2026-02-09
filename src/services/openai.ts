import { GoogleGenAI, Modality } from '@google/genai';
import { getOpenAIKey, getGeminiKey, getCachedAudio, setCachedAudio, getModelConfig } from './storage';
import { pcm16Base64ToWavBase64 } from '../utils/audio';

const OPENAI_BASE = 'https://api.openai.com/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function openaiHeaders(): Record<string, string> {
  const key = getOpenAIKey();
  if (!key) throw new Error('OpenAI API key not configured. Go to Settings to add it.');
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

// --- Chat Completions (supports OpenAI and Gemini) ---

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  modelOverride?: string
): Promise<string> {
  const config = getModelConfig();
  const model = modelOverride || config.chatModel;
  const provider = modelOverride
    ? (modelOverride.startsWith('gemini') ? 'gemini' : 'openai')
    : config.chatProvider;

  if (provider === 'gemini') {
    return geminiChat(systemPrompt, userMessage, model);
  }
  return openaiChat(systemPrompt, userMessage, model);
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

// --- Chat Completions with Image (supports OpenAI and Gemini) ---

export async function chatCompletionWithImage(
  systemPrompt: string,
  imageUrl: string
): Promise<string> {
  const config = getModelConfig();

  if (config.chatProvider === 'gemini') {
    return geminiChatWithImage(systemPrompt, imageUrl, config.chatModel);
  }
  return openaiChatWithImage(systemPrompt, imageUrl, config.chatModel);
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

// --- Text to Speech (supports OpenAI and Gemini) ---

export async function textToSpeech(
  text: string,
  voiceOverride?: string
): Promise<string> {
  const config = getModelConfig();
  const voice = voiceOverride || config.ttsVoice;
  const model = config.ttsModel;

  // Check cache first
  const cacheKey = `tts_${voice}_${text.substring(0, 100)}`;
  const cached = getCachedAudio(cacheKey);
  if (cached) return cached;

  let base64: string;

  if (config.ttsProvider === 'gemini') {
    base64 = await geminiTTS(text, voice, model);
  } else {
    base64 = await openaiTTS(text, voice, model);
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

// --- Image Generation (supports OpenAI and Gemini) ---

export async function generateImage(prompt: string): Promise<string> {
  const config = getModelConfig();

  if (config.imageProvider === 'gemini') {
    return geminiImageGeneration(prompt, config.imageModel);
  }
  return openaiImageGeneration(prompt, config.imageModel);
}

async function openaiImageGeneration(prompt: string, model: string): Promise<string> {
  const resp = await fetch(`${OPENAI_BASE}/images/generations`, {
    method: 'POST',
    headers: openaiHeaders(),
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: '1024x1024',
    }),
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
      return `data:image/png;base64,${data.data[0].b64_json}`;
    }
  }

  throw new Error(`OpenAI response missing image URL or b64_json: ${JSON.stringify(data)}`);
}

async function geminiImageGeneration(prompt: string, model: string): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('Gemini API key not configured. Go to Settings to add it.');

  const resp = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini Image error: ${resp.status} - ${err}`);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      const mime = part.inlineData.mimeType || 'image/png';
      return `data:${mime};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('Gemini did not return an image.');
}

// --- Speech to Text (supports OpenAI and Gemini) ---

export async function speechToText(audioBlob: Blob): Promise<string> {
  const config = getModelConfig();

  if (config.sttProvider === 'gemini') {
    return geminiSTT(audioBlob, config.sttModel);
  }
  return openaiSTT(audioBlob, config.sttModel);
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

// Helper
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
