/**
 * AI Service - Chat, TTS, STT, Image Generation
 *
 * All AI calls route through the Supabase Edge Function proxy.
 * API keys are never exposed client-side (per SEC-04).
 * In dev mode (no Supabase), these calls will fail with a descriptive error.
 */

import { normalizeTtsVoice, type Source } from '../types/settings';
import {
  chatCompletion as proxyChat,
  chatCompletionWithImage as proxyChatWithImage,
  textToSpeech as proxyTTS,
  speechToText as proxySTT,
  generateImage as proxyImage,
} from './supabase/aiProxy';
import { getModelConfig, waitUntilHydrated } from './runtimeConfigSnapshot';
import { getAudioCache } from './audioCache';

// ---------------------------------------------------------------------------
// Helpers for source detection from model overrides
// ---------------------------------------------------------------------------

function detectSource(modelId: string): Source {
  if (modelId.startsWith('gemini')) return 'genai';
  // OpenRouter models use owner/model format (e.g. "anthropic/claude-sonnet-4")
  // but Groq also uses slashes — exclude known Groq prefixes first.
  if (
    modelId.startsWith('llama-') ||
    modelId.startsWith('meta-llama/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('canopylabs/') ||
    modelId.startsWith('whisper-large-v3') ||
    modelId.startsWith('openai/gpt-oss')
  ) {
    return 'groq';
  }
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}

// ===== Chat Completions =====

/**
 * `modelOverride` accepts either:
 *   - a bare model id string (legacy behaviour — source is inferred
 *     from `detectSource()`), or
 *   - an explicit `{ model, source }` pair (Phase 5 master-role
 *     overrides, where the source is NOT always heuristically
 *     guessable from the model id — e.g. the same Gemini model can
 *     live under 'genai' or 'vertex').
 */
export type ChatModelOverride = string | { model: string; source: Source };

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  modelOverride?: ChatModelOverride,
  responseSchema?: Record<string, unknown>,
): Promise<string> {
  await waitUntilHydrated();
  const config = getModelConfig();

  let model: string;
  let source: Source;
  let hasExplicitOverride = false;
  if (!modelOverride) {
    model = config.chatModel;
    source = config.chatSource;
  } else if (typeof modelOverride === 'string') {
    model = modelOverride;
    source = detectSource(modelOverride);
    hasExplicitOverride = true;
  } else {
    model = modelOverride.model;
    source = modelOverride.source;
    hasExplicitOverride = true;
  }

  // When no explicit override is used, thread the user's fallback config to the
  // Edge Function so it can retry server-side (G1). The client-side catch below
  // is kept as a belt-and-suspenders safety net for old Edge Function deploys.
  // Per Phase 5, we intentionally do NOT duplicate per-role fallbacks — role
  // overrides inherit the main fallback chain.
  const fallback = !hasExplicitOverride && config.chatFallbackModel && config.chatFallbackSource
    ? { source: config.chatFallbackSource, model: config.chatFallbackModel }
    : undefined;

  try {
    return await proxyChat({ source, model, systemPrompt, userMessage, responseSchema, fallback });
  } catch (primaryError) {
    if (config.chatFallbackModel && config.chatFallbackSource) {
      console.warn('Primary chat failed, trying fallback:', primaryError);
      try {
        return await proxyChat({
          source: config.chatFallbackSource,
          model: config.chatFallbackModel,
          systemPrompt,
          userMessage,
          responseSchema,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// ===== Chat Completions with Image =====

export async function chatCompletionWithImage(
  systemPrompt: string,
  imageUrl: string,
  modelOverride?: string
): Promise<string> {
  await waitUntilHydrated();
  const config = getModelConfig();
  const model = modelOverride || config.chatModel;
  const source = modelOverride ? detectSource(modelOverride) : config.chatSource;

  // Groq does not support image input; fall back to genai
  const resolvedSource = source === 'groq' ? 'genai' : source;
  const resolvedModel = source === 'groq' ? 'gemini-2.5-flash' : model;

  const fallback = !modelOverride && config.chatFallbackModel && config.chatFallbackSource
    ? { source: config.chatFallbackSource, model: config.chatFallbackModel }
    : undefined;

  try {
    return await proxyChatWithImage({ source: resolvedSource, model: resolvedModel, systemPrompt, imageUrl, fallback });
  } catch (primaryError) {
    if (!modelOverride && config.chatFallbackModel && config.chatFallbackSource) {
      console.warn('Primary chat-with-image failed, trying fallback:', primaryError);
      try {
        return await proxyChatWithImage({
          source: config.chatFallbackSource,
          model: config.chatFallbackModel,
          systemPrompt,
          imageUrl,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// ===== Text to Speech =====

export async function textToSpeech(
  text: string,
  voiceOverride?: string
): Promise<string> {
  await waitUntilHydrated();
  const config = getModelConfig();
  const source = config.ttsSource;
  const model = config.ttsModel;
  const voice = normalizeTtsVoice(source, model, voiceOverride || config.ttsVoice);

  // Cache-first: check IndexedDB before network call
  const audioCache = getAudioCache();
  try {
    const cached = await audioCache.get(text, voice, model, source);
    if (cached) return cached;
  } catch {
    // Cache read failure is non-critical — fall through to network
  }

  const fallback = config.ttsFallbackModel && config.ttsFallbackSource
    ? {
        source: config.ttsFallbackSource,
        model: config.ttsFallbackModel,
        voice: normalizeTtsVoice(
          config.ttsFallbackSource,
          config.ttsFallbackModel,
          config.ttsFallbackVoice || voice,
        ),
      }
    : undefined;

  try {
    const base64 = await proxyTTS({ source, model, voice, text, fallback });
    // Store in cache (fire-and-forget, errors are logged internally)
    audioCache.set(text, voice, model, source, base64);
    return base64;
  } catch (primaryError) {
    if (config.ttsFallbackModel && config.ttsFallbackSource) {
      console.warn('Primary TTS failed, trying fallback:', primaryError);
      try {
        const fallbackVoice = normalizeTtsVoice(
          config.ttsFallbackSource,
          config.ttsFallbackModel,
          config.ttsFallbackVoice || voice,
        );
        const base64 = await proxyTTS({
          source: config.ttsFallbackSource,
          model: config.ttsFallbackModel,
          voice: fallbackVoice,
          text,
        });
        // Cache fallback result too
        audioCache.set(text, voice, model, source, base64);
        return base64;
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// ===== Speech to Text =====

export async function speechToText(audioBlob: Blob): Promise<string> {
  await waitUntilHydrated();
  const config = getModelConfig();
  const source = config.sttSource;
  const model = config.sttModel;
  const fallback = config.sttFallbackModel && config.sttFallbackSource
    ? { source: config.sttFallbackSource, model: config.sttFallbackModel }
    : undefined;

  try {
    return await proxySTT({ source, model, audioBlob, fallback });
  } catch (primaryError) {
    if (config.sttFallbackModel && config.sttFallbackSource) {
      console.warn('Primary STT failed, trying fallback:', primaryError);
      try {
        return await proxySTT({
          source: config.sttFallbackSource,
          model: config.sttFallbackModel,
          audioBlob,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// ===== Image Generation =====

export type ImageGenerationOptions = {
  // OpenAI parameters
  size?: 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
  quality?: 'auto' | 'low' | 'medium' | 'high';
  format?: 'png' | 'jpeg' | 'webp';
  compression?: number;
  background?: 'opaque' | 'transparent';
  moderation?: 'auto' | 'low';

  // Imagen parameters
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize?: '1K' | '2K';
  personGeneration?: 'allow_adult' | 'allow_all' | 'dont_allow';
  numberOfImages?: number;
};

export async function generateImage(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> {
  await waitUntilHydrated();
  const config = getModelConfig();
  const source = config.imageSource;
  const model = config.imageModel;
  const fallback = config.imageFallbackModel && config.imageFallbackSource
    ? { source: config.imageFallbackSource, model: config.imageFallbackModel }
    : undefined;
  try {
    return await proxyImage({ source, model, prompt, ...options, fallback });
  } catch (primaryError) {
    if (config.imageFallbackModel && config.imageFallbackSource) {
      console.warn('Primary image generation failed, trying fallback:', primaryError);
      try {
        return await proxyImage({
          source: config.imageFallbackSource,
          model: config.imageFallbackModel,
          prompt,
          ...options,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// Export types used by consumers
export type { Source };
