/**
 * AI Proxy Edge Function Client
 *
 * Calls the Supabase Edge Function which acts as a proxy for AI API calls.
 * The Edge Function decrypts the user's API keys and makes the actual API calls.
 *
 * This keeps the API keys secure and never exposes them to the client.
 */

import { supabase } from './client'
import type { Source } from '../../types/settings'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-proxy`

/**
 * Get the current session token for authentication
 */
async function getSessionToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession()

  if (error || !session) {
    throw new Error('Not authenticated')
  }

  return session.access_token
}

function edgeFunctionHeaders(accessToken: string): HeadersInit {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'x-client-info': 'llmenglish-web',
  }
}

async function getFreshSessionToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error || !session) throw new Error('Not authenticated')
    return session.access_token
  }

  return getSessionToken()
}

/**
 * Generic function to call the AI proxy
 */
async function callAIProxy(request: {
  action: 'chat' | 'tts' | 'stt' | 'image' | 'get_key' | 'get_vertex_live_token'
  source?: string
  model?: string
  [key: string]: unknown
}): Promise<unknown> {
  let token = await getFreshSessionToken()
  let response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: edgeFunctionHeaders(token),
    body: JSON.stringify(request),
  })

  if (response.status === 401) {
    token = await getFreshSessionToken(true)
    response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: edgeFunctionHeaders(token),
      body: JSON.stringify(request),
    })
  }

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`AI proxy error: ${response.status} - ${error}`)
  }

  return response.json()
}

// ============================================================================
// CHAT COMPLETION
// ============================================================================

export interface ChatCompletionOptions {
  systemPrompt: string
  userMessage: string
  model?: string
  source?: Source
  temperature?: number
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'chat',
    systemPrompt: options.systemPrompt,
    userMessage: options.userMessage,
    model: options.model,
    source: options.source,
    temperature: options.temperature ?? 0.8,
  }) as { content: string }

  return result.content
}

// ============================================================================
// CHAT COMPLETION WITH IMAGE
// ============================================================================

export interface ChatCompletionWithImageOptions {
  systemPrompt: string
  imageUrl: string
  model?: string
  source?: Source
}

export async function chatCompletionWithImage(options: ChatCompletionWithImageOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'chat',
    systemPrompt: options.systemPrompt,
    imageUrl: options.imageUrl,
    model: options.model,
    source: options.source,
    imageMode: true,
  }) as { content: string }

  return result.content
}

// ============================================================================
// TEXT TO SPEECH
// ============================================================================

export interface TextToSpeechOptions {
  text: string
  voice?: string
  model?: string
  source?: Source
}

export async function textToSpeech(options: TextToSpeechOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'tts',
    text: options.text,
    voice: options.voice,
    model: options.model,
    source: options.source,
  }) as { audio: string } // base64 audio

  return result.audio
}

// ============================================================================
// SPEECH TO TEXT
// ============================================================================

export interface SpeechToTextOptions {
  audioBlob: Blob
  model?: string
  source?: Source
  language?: string
}

export async function speechToText(options: SpeechToTextOptions): Promise<string> {
  // Convert blob to base64
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(options.audioBlob)
  })

  const result = await callAIProxy({
    action: 'stt',
    audio: base64Audio,
    mimeType: options.audioBlob.type || 'audio/webm',
    model: options.model,
    source: options.source,
    language: options.language || 'en',
  }) as { text: string }

  return result.text
}

// ============================================================================
// IMAGE GENERATION
// ============================================================================

export interface ImageGenerationOptions {
  prompt: string
  model?: string
  source?: Source
  // OpenAI parameters
  size?: string
  quality?: string
  format?: string
  compression?: number
  background?: string
  moderation?: string
  // Imagen / Gemini parameters
  aspectRatio?: string
  imageSize?: string
  personGeneration?: string
  numberOfImages?: number
}

export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'image',
    prompt: options.prompt,
    model: options.model,
    source: options.source,
    size: options.size,
    quality: options.quality,
    format: options.format,
    compression: options.compression,
    background: options.background,
    moderation: options.moderation,
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize,
    personGeneration: options.personGeneration,
    numberOfImages: options.numberOfImages,
  }) as { imageUrl: string } | { imageData: string }

  if ('imageUrl' in result) {
    return result.imageUrl
  }
  return result.imageData
}

// ============================================================================
// GEMINI LIVE AUDIO
// ============================================================================

/**
 * For Gemini Live via Google AI Studio, we need a direct connection since it uses WebSocket.
 * The Edge Function provides the API key for the session.
 */

export async function getGeminiKeyForLive(): Promise<string> {
  const result = await callAIProxy({
    action: 'get_key',
    source: 'genai',
  }) as { key: string }

  return result.key
}

// ============================================================================
// VERTEX AI LIVE AUDIO
// ============================================================================

/**
 * For Gemini Live via Vertex AI, the Edge Function generates a short-lived token.
 */
export async function getVertexLiveToken(): Promise<string> {
  const result = await callAIProxy({
    action: 'get_vertex_live_token',
  }) as { token: string }

  return result.token
}

// ============================================================================
// FALLBACK HANDLING
// ============================================================================

/**
 * Try the Edge Function first, fall back to direct API call if it fails
 * This is useful during development when the Edge Function isn't set up yet
 */

export async function withFallback<T>(
  proxyCall: () => Promise<T>,
  _fallbackCall: () => Promise<T>,
  useFallback: boolean = false
): Promise<T> {
  // SEC-04: Always use proxy. Direct browser-to-provider calls are eliminated.
  // Fallback call parameter is kept for API compatibility but never executed.
  void useFallback
  return proxyCall()
}
