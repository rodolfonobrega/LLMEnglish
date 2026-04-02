/**
 * AI Service - Chat, TTS, STT, Image Generation
 *
 * All AI calls route through the Supabase Edge Function proxy.
 * API keys are never exposed client-side (per SEC-04).
 * In dev mode (no Supabase), these calls will fail with a descriptive error.
 */

import type { Provider } from '../types/settings';
import {
  chatCompletion as proxyChat,
  chatCompletionWithImage as proxyChatWithImage,
  textToSpeech as proxyTTS,
  speechToText as proxySTT,
  generateImage as proxyImage,
} from './supabase/aiProxy';
import { getRuntimeModelConfig } from './runtimeState';

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

// ===== Chat Completions =====

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  modelOverride?: string
): Promise<string> {
  const config = getRuntimeModelConfig();
  const model = modelOverride || config.chatModel;
  const provider = modelOverride ? detectProvider(modelOverride) : config.chatProvider;

  try {
    return await proxyChat({ provider, model, systemPrompt, userMessage });
  } catch (primaryError) {
    if (!modelOverride && config.chatFallbackModel && config.chatFallbackProvider) {
      console.warn('Primary chat failed, trying fallback:', primaryError);
      try {
        return await proxyChat({
          provider: config.chatFallbackProvider,
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
  const provider = modelOverride ? detectProvider(modelOverride) : config.chatProvider;

  // Groq does not support image input; fall back to openai/gemini
  const resolvedProvider = provider === 'groq' ? 'gemini' : provider;
  const resolvedModel = provider === 'groq' ? 'gemini-2.5-flash' : model;

  return proxyChatWithImage({ provider: resolvedProvider, model: resolvedModel, systemPrompt, imageUrl });
}

// ===== Text to Speech =====

export async function textToSpeech(
  text: string,
  voiceOverride?: string
): Promise<string> {
  const config = getRuntimeModelConfig();
  const provider = config.ttsProvider;
  const model = config.ttsModel;
  const voice = voiceOverride || config.ttsVoice || 'alloy';

  try {
    return await proxyTTS({ provider, model, voice, text });
  } catch (primaryError) {
    if (config.ttsFallbackModel && config.ttsFallbackProvider) {
      console.warn('Primary TTS failed, trying fallback:', primaryError);
      try {
        const fallbackVoice = config.ttsFallbackVoice || voice;
        return await proxyTTS({
          provider: config.ttsFallbackProvider,
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
  const provider = config.sttProvider;
  const model = config.sttModel;

  try {
    return await proxySTT({ provider, model, audioBlob });
  } catch (primaryError) {
    if (config.sttFallbackModel && config.sttFallbackProvider) {
      console.warn('Primary STT failed, trying fallback:', primaryError);
      try {
        return await proxySTT({
          provider: config.sttFallbackProvider,
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
  const provider = config.imageProvider;
  const model = config.imageModel;
  return proxyImage({ provider, model, prompt, ...options });
}

// Export types used by consumers
export type { Provider };
