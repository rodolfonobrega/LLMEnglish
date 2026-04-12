// Supabase Edge Function: ai-proxy
//
// This Edge Function acts as a secure proxy for AI API calls.
// It decrypts the user's API keys and makes the actual API calls.
//
// Environment variables (set via `supabase secrets set` or a local env file):
// - ENCRYPTION_KEY: A 32-byte hex string for AES-256-GCM encryption

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// Get encryption key from environment
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable not set')
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set')
}
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

const PBKDF2_ITERATIONS = 600_000
const SALT_LENGTH = 16
const IV_LENGTH = 12
const KEY_LENGTH = 256

/**
 * Derive a cryptographic key from the encryption key and salt using PBKDF2
 */
async function deriveKey(encryptionKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Decrypt data using AES-256-GCM with PBKDF2-derived key
 */
async function decrypt(ciphertext: string, iv: string, salt: string, key: string): Promise<string> {
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0))
  const cryptoKey = await deriveKey(key, saltBytes)
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    ciphertextBytes
  )
  return new TextDecoder().decode(decrypted)
}

/**
 * Encrypt data using AES-256-GCM with PBKDF2-derived key and random salt
 */
async function encrypt(plaintext: string, key: string): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cryptoKey = await deriveKey(key, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(plaintext)
  )
  const ciphertextBytes = new Uint8Array(encrypted)
  return {
    ciphertext: uint8ToBase64(ciphertextBytes),
    iv: uint8ToBase64(iv),
    salt: uint8ToBase64(salt),
  }
}

// ============================================================================
// SOURCE HELPERS
// ============================================================================

/**
 * Map source name to DB column for API key retrieval.
 * Returns null for sources that don't use per-user API keys.
 */
function sourceToDbColumn(source: string): string | null {
  if (source === 'genai') return 'gemini_key'
  if (source === 'openai') return 'openai_key'
  if (source === 'groq') return 'groq_key'
  if (source === 'openrouter') return 'openrouter_key'
  if (source === 'vertex') return null  // vertex uses genai key via getApiKey(userId, 'genai')
  return null
}

/**
 * Normalize old provider values to new source names for backward compat.
 */
function normalizeSource(source: string | undefined, fallback = 'genai'): string {
  if (!source) return fallback
  if (source === 'gemini') return 'genai'  // old client compat
  return source
}

/**
 * Validate that an image URL is safe to fetch server-side (SSRF protection).
 * Blocks internal/private IPs and non-HTTP protocols.
 */
function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const hostname = parsed.hostname.toLowerCase()
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return false
    if (hostname.startsWith('172.')) {
      const secondOctet = parseInt(hostname.split('.')[1])
      if (secondOctet >= 16 && secondOctet <= 31) return false
    }
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return false
    if (hostname.startsWith('0.') || hostname === '::1') return false
    return true
  } catch {
    return false
  }
}

// ============================================================================
// API KEY RETRIEVAL
// ============================================================================

/**
 * Get and decrypt a user's API key by source.
 * Supports both new source names and old provider names for backward compat.
 */
async function getApiKey(userId: string, source: string): Promise<string | null> {
  const dbColumn = sourceToDbColumn(source)

  // Vertex uses ADC, not per-user keys
  if (!dbColumn) return null

  const { data, error } = await supabase
    .from('encrypted_api_keys')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  const encryptedKey = data[dbColumn]

  if (!encryptedKey) {
    return null
  }

  try {
    const parsed = JSON.parse(encryptedKey)
    // New format: {ciphertext, iv, salt} — decrypt with PBKDF2
    if (parsed.ciphertext && parsed.iv && parsed.salt) {
      return await decrypt(parsed.ciphertext, parsed.iv, parsed.salt, ENCRYPTION_KEY)
    }
    // Old format: {ciphertext, iv} without salt — treat as plaintext (broken encryption)
    // Fall through to migration path below
  } catch {
    // Not JSON — it's plaintext, fall through to migration
  }

  // Plaintext key (or old client-side encrypted) — auto-migrate by re-encrypting server-side
  const plaintextValue = encryptedKey
  try {
    await saveApiKey(userId, source, plaintextValue)
    console.log(`Migrated plaintext key for user ${userId}, source ${source}`)
  } catch (err) {
    console.error(`Failed to migrate key for user ${userId}, source ${source}:`, err)
  }
  return plaintextValue
}

/**
 * Save an encrypted API key — encrypts with PBKDF2 before storing.
 * Supports both new source names and old provider names for backward compat.
 */
async function saveApiKey(userId: string, source: string, key: string): Promise<void> {
  const encrypted = await encrypt(key, ENCRYPTION_KEY)
  const encryptedValue = JSON.stringify(encrypted)

  const { data: existing } = await supabase
    .from('encrypted_api_keys')
    .select('id')
    .eq('user_id', userId)
    .single()

  const dbColumn = sourceToDbColumn(source)
  if (!dbColumn) {
    throw new Error(`Cannot save key for source '${source}' — no DB column mapped`)
  }

  const updateData: Record<string, string> = {}
  updateData[dbColumn] = encryptedValue
  updateData[`${dbColumn}_updated_at`] = new Date().toISOString()

  if (existing) {
    await supabase
      .from('encrypted_api_keys')
      .update(updateData)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('encrypted_api_keys')
      .insert({
        user_id: userId,
        ...updateData,
      })
  }
}

// ============================================================================
// AI API CALLS
// ============================================================================

/**
 * OpenAI Chat Completion
 */
async function openaiChat(apiKey: string, model: string, systemPrompt: string, userMessage: string, temperature = 0.8): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`OpenAI returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return content
}

/**
 * Gemini Chat Completion
 */
async function geminiChat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.8 },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(`Gemini returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}

/**
 * Groq Chat Completion
 */
async function groqChat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`Groq returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return content
}

/**
 * OpenAI TTS
 */
async function openaiTTS(apiKey: string, text: string, voice: string, model: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI TTS error: ${response.status} - ${error}`)
  }

  const buffer = await response.arrayBuffer()
  const base64 = uint8ToBase64(new Uint8Array(buffer))
  return base64
}

/**
 * Gemini TTS
 */
async function geminiTTS(apiKey: string, text: string, voice: string, model: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')
  const { Modality } = await import('https://esm.sh/@google/generative-ai@0.21.0')

  const ai = new GoogleGenerativeAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: { parts: [{ text }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
      },
    },
  })

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!audioData) {
    throw new Error('Gemini TTS returned no audio data')
  }

  // Wrap PCM16 in WAV header
  return pcm16ToWav(audioData, 24000)
}

/**
 * Groq TTS
 */
async function groqTTS(apiKey: string, text: string, voice: string, model: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'wav',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq TTS error: ${response.status} - ${error}`)
  }

  const buffer = await response.arrayBuffer()
  const base64 = uint8ToBase64(new Uint8Array(buffer))
  return base64
}

/**
 * OpenAI STT
 */
async function openaiSTT(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
  const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
  const blob = new Blob([audioData], { type: mimeType })

  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  formData.append('model', model)
  formData.append('language', 'en')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI STT error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.text
}

/**
 * Gemini STT
 */
async function geminiSTT(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')

  const ai = new GoogleGenerativeAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        { text: 'Transcribe exactly what was said in English. Output ONLY the transcription text, nothing else.' },
      ],
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini STT returned no text')
  return text.trim()
}

/**
 * Groq STT
 */
async function groqSTT(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
  const audioData = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))
  const blob = new Blob([audioData], { type: mimeType })

  const formData = new FormData()
  formData.append('file', blob, 'audio.webm')
  formData.append('model', model)
  formData.append('language', 'en')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq STT error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.text
}

// ============================================================================
// OPENROUTER API CALLS
// ============================================================================

/**
 * OpenRouter Chat Completion (OpenAI-compatible format)
 */
async function openrouterChat(apiKey: string, model: string, systemPrompt: string, userMessage: string, temperature = 0.8): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://speaklab.app',
      'X-Title': 'SpeakLab',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`OpenRouter returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return content
}

/**
 * OpenRouter TTS — passes through to OpenAI-compatible audio endpoint.
 * Most OpenRouter models don't support TTS; only use with compatible models.
 */
async function openrouterTTS(apiKey: string, text: string, voice: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter TTS error: ${response.status} - ${error}`)
  }

  const buffer = await response.arrayBuffer()
  return uint8ToBase64(new Uint8Array(buffer))
}

/**
 * OpenRouter STT — uses chat completions with input_audio content.
 * Models like openai/gpt-audio support audio via chat completions, not transcription endpoint.
 */
async function openrouterSTT(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://speaklab.app',
      'X-Title': 'SpeakLab',
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Transcribe exactly what was said in English. Output ONLY the transcription text, nothing else.' },
          { type: 'input_audio', input_audio: { data: audioBase64, format: mimeType.includes('webm') ? 'webm' : 'wav' } },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter STT error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

/**
 * OpenRouter Image Generation — uses chat completions with image modality.
 * OpenRouter doesn't support /images/generations; image models use chat completions.
 */
async function openrouterImage(apiKey: string, prompt: string, model: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://speaklab.app',
      'X-Title': 'SpeakLab',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter Image error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const msg = data.choices?.[0]?.message

  // Check for images in response (OpenRouter format)
  if (msg?.images?.length) {
    const imageUrl = msg.images[0]?.image_url?.url
    if (imageUrl) {
      // data:image/png;base64,... or regular URL
      return imageUrl.startsWith('data:') ? imageUrl : imageUrl
    }
  }

  // Check for inline content
  if (msg?.content && typeof msg.content === 'string') {
    throw new Error(`OpenRouter returned text instead of image: ${msg.content.slice(0, 200)}`)
  }

  throw new Error(`OpenRouter response missing image: ${JSON.stringify(data).slice(0, 500)}`)
}

// ============================================================================
// VERTEX AI API CALLS
// ============================================================================

/**
 * Get Vertex AI access token using Application Default Credentials.
 * In Supabase Edge Functions, this reads from VERTEX_SERVICE_ACCOUNT_KEY secret.
 */
async function getVertexAccessToken(): Promise<string> {
  const serviceAccountKey = Deno.env.get('VERTEX_SERVICE_ACCOUNT_KEY')
  if (!serviceAccountKey) {
    throw new Error('Vertex AI not configured. Set VERTEX_SERVICE_ACCOUNT_KEY secret.')
  }

  const sa = JSON.parse(serviceAccountKey)
  const now = Math.floor(Date.now() / 1000)

  // Create JWT
  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64urlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    str2ab(atob(sa.private_key.replace(/-----[^-]+-----/g, '').trim())),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // Sign JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(`${header}.${payload}`)
  )

  const jwt = `${header}.${payload}.${uint8ToBase64url(new Uint8Array(signature))}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get Vertex access token: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * Get Vertex AI config (project ID and region) from user's stored credentials.
 */
async function getVertexConfig(userId: string): Promise<{ projectId: string; region: string }> {
  const { data, error } = await supabase
    .from('encrypted_api_keys')
    .select('vertex_config')
    .eq('user_id', userId)
    .single()

  if (error || !data?.vertex_config) {
    throw new Error('Vertex AI not configured for this user. Configure project ID and region in Settings.')
  }

  const config = typeof data.vertex_config === 'string'
    ? JSON.parse(data.vertex_config)
    : data.vertex_config

  if (!config.projectId || !config.region) {
    throw new Error('Vertex AI config missing projectId or region.')
  }

  return { projectId: config.projectId, region: config.region }
}

/**
 * Vertex AI Chat Completion (express mode with API key)
 */
async function vertexChat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.8 },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(`Vertex returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}

/**
 * Vertex AI Chat with Image (express mode with API key)
 */
async function vertexChatWithImage(
  apiKey: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

  const contents: Record<string, unknown>[] = [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: imageMimeType, data: imageBase64 } },
      { text: 'Please create a question about this image as instructed.' },
    ],
  }]

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(`Vertex returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}

/**
 * Vertex AI TTS (express mode with API key)
 */
async function vertexTTS(apiKey: string, model: string, text: string, voice: string): Promise<string> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: { parts: [{ text }] },
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI TTS error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!audioData) {
    throw new Error('Vertex AI TTS returned no audio data')
  }

  return pcm16ToWav(audioData, 24000)
}

/**
 * Vertex AI STT (express mode with API key)
 */
async function vertexSTT(apiKey: string, model: string, audioBase64: string, mimeType: string): Promise<string> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: {
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: 'Transcribe exactly what was said in English. Output ONLY the transcription text, nothing else.' },
        ],
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Vertex AI STT error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Vertex AI STT returned no text')
  return text.trim()
}

/**
 * Vertex AI Image Generation (express mode with API key)
 */
async function vertexImage(apiKey: string, model: string, prompt: string, options: Record<string, unknown>): Promise<string> {
  const isImagenModel = model.startsWith('imagen-')

  if (isImagenModel) {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }
    if (options.aspectRatio) generationConfig.aspectRatio = options.aspectRatio
    if (options.numberOfImages) generationConfig.numberOfImages = options.numberOfImages
    else generationConfig.numberOfImages = 1

    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:predict`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: generationConfig,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Vertex AI Image error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    if (data.predictions && data.predictions[0]) {
      const bytesBase64 = data.predictions[0].bytesBase64
      if (bytesBase64) return `data:image/png;base64,${bytesBase64}`
    }

    throw new Error('Vertex AI did not return an image.')
  } else {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }
    if (options.aspectRatio) generationConfig.aspectRatio = options.aspectRatio

    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Vertex AI Image error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const parts = data.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png'
        return `data:${mime};base64,${part.inlineData.data}`
      }
    }

    throw new Error('Vertex AI did not return an image.')
  }
}

// ============================================================================
// HELPER: String to ArrayBuffer
// ============================================================================

/**
 * URL-safe Base64 encoding for JWT (RFC 7519).
 * Standard btoa produces +/= which are invalid in JWT tokens.
 */
function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * URL-safe Base64 encoding for binary data (JWT signatures).
 */
function uint8ToBase64url(bytes: Uint8Array): string {
  return uint8ToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Safely convert a Uint8Array to a base64 string.
 * Uses chunked encoding to avoid call stack limits on large arrays.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i)
  }
  return buf
}

// ============================================================================
// IMAGE GENERATION (existing)
// ============================================================================

/**
 * OpenAI Image Generation
 */
async function openaiImage(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
  const body: Record<string, unknown> = { model, prompt, n: 1 }

  if (options.size) body.size = options.size
  if (options.quality) body.quality = options.quality
  if (options.format) body.format = options.format
  if (options.compression) body.compression = options.compression
  if (options.background) body.background = options.background
  if (options.moderation) body.moderation = options.moderation

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI Image error: ${response.status} - ${error}`)
  }

  const data = await response.json()

  if (data.data && data.data[0]) {
    if (data.data[0].url) return data.data[0].url
    if (data.data[0].b64_json) return `data:image/png;base64,${data.data[0].b64_json}`
  }

  throw new Error(`OpenAI response missing image: ${JSON.stringify(data)}`)
}

/**
 * Gemini Image Generation
 */
async function geminiImage(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
  const isImagenModel = model.startsWith('imagen-')

  if (isImagenModel) {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }

    if (options.aspectRatio) generationConfig.aspectRatio = options.aspectRatio
    if (options.imageSize) generationConfig.imageSize = options.imageSize
    if (options.numberOfImages) generationConfig.numberOfImages = options.numberOfImages
    else generationConfig.numberOfImages = 1

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: generationConfig,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini Image error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    if (data.predictions && data.predictions[0]) {
      const bytesBase64 = data.predictions[0].bytesBase64
      if (bytesBase64) return `data:image/png;base64,${bytesBase64}`
    }

    throw new Error('Gemini did not return an image.')
  } else {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }

    if (options.aspectRatio) generationConfig.aspectRatio = options.aspectRatio

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini Image error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    const parts = data.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part.inlineData) {
        const mime = part.inlineData.mimeType || 'image/png'
        return `data:${mime};base64,${part.inlineData.data}`
      }
    }

    throw new Error('Gemini did not return an image.')
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert PCM16 to WAV
 */
function pcm16ToWav(pcm16Base64: string, sampleRate: number): string {
  const pcmData = atob(pcm16Base64)
  const wavDataLength = 44 + pcmData.length

  const buffer = new ArrayBuffer(wavDataLength)
  const view = new DataView(buffer)

  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, wavDataLength - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, pcmData.length, true)

  // Write PCM data
  for (let i = 0; i < pcmData.length; i++) {
    view.setUint8(44 + i, pcmData.charCodeAt(i))
  }

  const wavBytes = new Uint8Array(buffer)
  return uint8ToBase64(wavBytes)
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      throw new Error('Invalid authentication')
    }

    const userId = user.id
    const body = await req.json()

    // Handle different actions
    switch (body.action) {
      // Key management
      case 'save_key':
      case 'save_keys': {
        if (body.action === 'save_key') {
          const src = normalizeSource(body.source || body.provider)
          await saveApiKey(userId, src, body.key)
        } else {
          for (const [sourceOrProvider, key] of Object.entries(body.keys)) {
            if (key) {
              const src = normalizeSource(sourceOrProvider)
              await saveApiKey(userId, src, key as string)
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
      }

      case 'get_key': {
        const src = normalizeSource(body.source || body.provider)
        const key = await getApiKey(userId, src)
        return new Response(JSON.stringify({ key }), { headers: corsHeaders })
      }

      // Chat
      case 'chat': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash' : 'gpt-4o-mini')

        let content: string

        if (body.imageMode) {
          // Chat with image
          if (source === 'vertex') {
            const apiKey = await getApiKey(userId, 'genai')
            if (!apiKey) throw new Error('No Gemini API key configured for Vertex AI')

            let imageData: string
            let mimeType: string

            if (body.imageUrl.startsWith('data:')) {
              const match = body.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
              if (!match) throw new Error('Invalid data URL')
              mimeType = match[1]
              imageData = match[2]
            } else {
              if (!isSafeImageUrl(body.imageUrl)) {
                throw new Error('Image URL must be a publicly accessible HTTPS or HTTP URL')
              }
              const imgResp = await fetch(body.imageUrl)
              const blob = await imgResp.blob()
              mimeType = blob.type || 'image/png'
              imageData = await blob.arrayBuffer().then(b => uint8ToBase64(new Uint8Array(b)))
            }

            content = await vertexChatWithImage(apiKey, model, body.systemPrompt, imageData, mimeType)
          } else if (source === 'genai') {
            // Handle image with Gemini
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No Gemini API key configured')

            const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')

            let imageData: string
            let mimeType: string

            if (body.imageUrl.startsWith('data:')) {
              const match = body.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
              if (!match) throw new Error('Invalid data URL')
              mimeType = match[1]
              imageData = match[2]
            } else {
              if (!isSafeImageUrl(body.imageUrl)) {
                throw new Error('Image URL must be a publicly accessible HTTPS or HTTP URL')
              }
              const imgResp = await fetch(body.imageUrl)
              const blob = await imgResp.blob()
              mimeType = blob.type || 'image/png'
              imageData = await blob.arrayBuffer().then(b => uint8ToBase64(new Uint8Array(b)))
            }

            const ai = new GoogleGenerativeAI({ apiKey })
            const response = await ai.models.generateContent({
              model,
              systemInstruction: body.systemPrompt,
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType, data: imageData } },
                  { text: 'Please create a question about this image as instructed.' },
                ],
              }],
            })

            content = response.candidates?.[0]?.content?.parts?.[0]?.text || ''
          } else if (source === 'openrouter') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenRouter API key configured')
            content = await openrouterChat(apiKey, model, body.systemPrompt, body.imageUrl)
          } else {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenAI API key configured')
            content = await openaiChat(apiKey, model, body.systemPrompt, body.imageUrl)
          }
        } else {
          // Regular chat
          if (source === 'openai') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenAI API key configured')
            content = await openaiChat(apiKey, model, body.systemPrompt, body.userMessage, body.temperature)
          } else if (source === 'groq') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No Groq API key configured')
            content = await groqChat(apiKey, model, body.systemPrompt, body.userMessage)
          } else if (source === 'openrouter') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenRouter API key configured')
            content = await openrouterChat(apiKey, model, body.systemPrompt, body.userMessage, body.temperature)
          } else if (source === 'vertex') {
            const apiKey = await getApiKey(userId, 'genai')
            if (!apiKey) throw new Error('No Gemini API key configured for Vertex AI')
            content = await vertexChat(apiKey, model, body.systemPrompt, body.userMessage)
          } else {
            // genai (default)
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No Gemini API key configured')
            content = await geminiChat(apiKey, model, body.systemPrompt, body.userMessage)
          }
        }

        return new Response(JSON.stringify({ content }), { headers: corsHeaders })
      }

      // TTS
      case 'tts': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash-preview-tts' : 'tts-1')
        const voice = body.voice || (source === 'genai' || source === 'vertex' ? 'Kore' : 'alloy')

        let audio: string

        if (source === 'openai') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenAI API key configured')
          audio = await openaiTTS(apiKey, body.text, voice, model)
        } else if (source === 'groq') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Groq API key configured')
          audio = await groqTTS(apiKey, body.text, voice, model)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          audio = await openrouterTTS(apiKey, body.text, voice, model)
        } else if (source === 'vertex') {
          const apiKey = await getApiKey(userId, 'genai')
          if (!apiKey) throw new Error('No Gemini API key configured for Vertex AI')
          audio = await vertexTTS(apiKey, model, body.text, voice)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          audio = await geminiTTS(apiKey, body.text, voice, model)
        }

        return new Response(JSON.stringify({ audio }), { headers: corsHeaders })
      }

      // STT
      case 'stt': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash' : 'whisper-1')

        let text: string

        if (source === 'openai') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenAI API key configured')
          text = await openaiSTT(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'groq') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Groq API key configured')
          text = await groqSTT(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          text = await openrouterSTT(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'vertex') {
          const apiKey = await getApiKey(userId, 'genai')
          if (!apiKey) throw new Error('No Gemini API key configured for Vertex AI')
          text = await vertexSTT(apiKey, model, body.audio, body.mimeType)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          text = await geminiSTT(apiKey, body.audio, body.mimeType, model)
        }

        return new Response(JSON.stringify({ text }), { headers: corsHeaders })
      }

      // Image Generation
      case 'image': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-3.1-flash-image-preview' : 'gpt-image-1')

        const options = {
          size: body.size,
          quality: body.quality,
          format: body.format,
          compression: body.compression,
          background: body.background,
          moderation: body.moderation,
          aspectRatio: body.aspectRatio,
          imageSize: body.imageSize,
          personGeneration: body.personGeneration,
          numberOfImages: body.numberOfImages,
        }

        let result: string

        if (source === 'vertex') {
          const apiKey = await getApiKey(userId, 'genai')
          if (!apiKey) throw new Error('No Gemini API key configured for Vertex AI')
          result = await vertexImage(apiKey, model, body.prompt, options)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          result = await openrouterImage(apiKey, body.prompt, model)
        } else if (source === 'openai') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenAI API key configured')
          result = await openaiImage(apiKey, body.prompt, model, options)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          result = await geminiImage(apiKey, body.prompt, model, options)
        }

        const isBase64 = result.startsWith('data:')
        return new Response(
          JSON.stringify(isBase64 ? { imageData: result } : { imageUrl: result }),
          { headers: corsHeaders }
        )
      }

      // Vertex AI Live Token
      case 'get_vertex_live_token': {
        // Requires VERTEX_SERVICE_ACCOUNT_KEY secret to be configured
        const accessToken = await getVertexAccessToken()
        const { projectId, region } = await getVertexConfig(userId)
        return new Response(
          JSON.stringify({ accessToken, projectId, region }),
          { headers: corsHeaders }
        )
      }

      default:
        throw new Error(`Unknown action: ${body.action}`)
    }
  } catch (error) {
    console.error('Error in ai-proxy:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: corsHeaders }
    )
  }
})
