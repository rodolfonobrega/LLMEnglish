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
import { getRuntimeModelConfig } from './runtimeState';

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
    modelId.startsWith('whisper-large-v3')
  ) {
    return 'groq';
  }
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}

// ===== Chat Completions =====

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  modelOverride?: string
): Promise<string> {
  const config = getRuntimeModelConfig();
  const model = modelOverride || config.chatModel;
  const source = modelOverride ? detectSource(modelOverride) : config.chatSource;

  try {
    return await proxyChat({ source, model, systemPrompt, userMessage });
  } catch (primaryError) {
    if (!modelOverride && config.chatFallbackModel && config.chatFallbackSource) {
      console.warn('Primary chat failed, trying fallback:', primaryError);
      try {
        return await proxyChat({
          source: config.chatFallbackSource,
          model: config.chatFallbackModel,
          systemPrompt,
          userMessage,
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
  const config = getRuntimeModelConfig();
  const model = modelOverride || config.chatModel;
  const source = modelOverride ? detectSource(modelOverride) : config.chatSource;

  // Groq does not support image input; fall back to genai
  const resolvedSource = source === 'groq' ? 'genai' : source;
  const resolvedModel = source === 'groq' ? 'gemini-2.5-flash' : model;

  return proxyChatWithImage({ source: resolvedSource, model: resolvedModel, systemPrompt, imageUrl });
}

// ===== Text to Speech =====

export async function textToSpeech(
  text: string,
  voiceOverride?: string
): Promise<string> {
  const config = getRuntimeModelConfig();
  const source = config.ttsSource;
  const model = config.ttsModel;
  const voice = normalizeTtsVoice(source, model, voiceOverride || config.ttsVoice);

  try {
    return await proxyTTS({ source, model, voice, text });
  } catch (primaryError) {
    if (config.ttsFallbackModel && config.ttsFallbackSource) {
      console.warn('Primary TTS failed, trying fallback:', primaryError);
      try {
        const fallbackVoice = normalizeTtsVoice(
          config.ttsFallbackSource,
          config.ttsFallbackModel,
          config.ttsFallbackVoice || voice,
        );
        return await proxyTTS({
          source: config.ttsFallbackSource,
          model: config.ttsFallbackModel,
          voice: fallbackVoice,
          text,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

// ===== Speech to Text =====

export async function speechToText(audioBlob: Blob): Promise<string> {
  const config = getRuntimeModelConfig();
  const source = config.sttSource;
  const model = config.sttModel;

  try {
    return await proxySTT({ source, model, audioBlob });
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
  const config = getRuntimeModelConfig();
  const source = config.imageSource;
  const model = config.imageModel;
  return proxyImage({ source, model, prompt, ...options });
}

// Export types used by consumers
export type { Source };
