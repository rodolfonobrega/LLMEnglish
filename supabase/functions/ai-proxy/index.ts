// Supabase Edge Function: ai-proxy
//
// This Edge Function acts as a secure proxy for AI API calls.
// It decrypts the user's API keys and makes the actual API calls.
//
// Environment variables (set via `supabase secrets set` or a local env file):
// - ENCRYPTION_KEY: A 32-byte hex string for AES-256-GCM encryption

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS allowlist — configurable via ALLOWED_ORIGINS (comma-separated).
// Fallback keeps local development working and preserves the current hosted
// app origin when the secret has not been populated yet.
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://localhost:5173',
  'http://127.0.0.1:5173',
  'https://127.0.0.1:5173',
  'https://speaklab.app',
].join(',')

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ALLOWED_ORIGINS)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Build CORS response headers for a given request origin.
 * - Allowlisted origins: echoes the origin back.
 * - Non-allowlisted: returns headers WITHOUT Access-Control-Allow-Origin
 *   (browsers will block cross-origin reads; preflights get 403 separately).
 * Content-Type is included here so every JSON response carries it.
 */
function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = !!origin && ALLOWED_ORIGINS.includes(origin)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  }
  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin!
  }
  return headers
}

function isOriginAllowed(origin: string | null): boolean {
  return !!origin && ALLOWED_ORIGINS.includes(origin)
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

// ----------------------------------------------------------------------------
// Image fetch bounds — prevents OOM / slowloris from user-supplied image URLs.
// ----------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB
const IMAGE_FETCH_TIMEOUT_MS = 10_000

/**
 * Fetch a user-supplied image URL with hard bounds:
 *   - 10-second request timeout (AbortSignal.timeout).
 *   - Reject up-front if Content-Length > 10 MB.
 *   - Stream-read and abort if the body grows past 10 MB
 *     (servers may omit Content-Length).
 * Throws on any violation so callers surface the error to the client.
 */
async function fetchBoundedImage(url: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const response = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS) })

  if (!response.ok) {
    throw new Error(`Image fetch failed: ${response.status}`)
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
    // Release the body before throwing so the connection can be reused.
    try { await response.body?.cancel() } catch { /* ignore */ }
    throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_IMAGE_BYTES})`)
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0].trim() || 'image/png'

  // Stream-read, aborting past the cap even if Content-Length was absent or wrong.
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Image fetch returned no body')
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > MAX_IMAGE_BYTES) {
        try { await reader.cancel() } catch { /* ignore */ }
        throw new Error(`Image too large: exceeds ${MAX_IMAGE_BYTES} bytes`)
      }
      chunks.push(value)
    }
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, mimeType }
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
 * Common shape for chat provider requests.
 */
interface ChatRequest {
  model: string
  systemPrompt: string
  userMessage: string
  temperature?: number
  responseSchema?: Record<string, unknown>
}

interface UsagePayload {
  tokens_in?: number
  tokens_out?: number
  seconds_used?: number
  cost_usd_override?: number
}

interface TextResult {
  content: string
  usage?: UsagePayload
}

interface AudioResult {
  audio: string
  usage?: UsagePayload
}

interface STTResult {
  text: string
  usage?: UsagePayload
}

interface ImageResult {
  image: string
  usage?: UsagePayload
}

/**
 * Declarative endpoint definition for a chat provider.
 * Each provider supplies its URL, auth headers, request body shape,
 * and a response parser. `callChat` drives the common fetch flow.
 */
interface ChatEndpoint {
  label: string // used in error messages (e.g. 'OpenAI', 'Gemini')
  url: (req: ChatRequest) => string
  buildHeaders: (apiKey: string) => HeadersInit
  buildBody: (req: ChatRequest) => unknown
  parseResponse: (raw: unknown) => TextResult
}

/**
 * Generic chat dispatcher — fetches an endpoint, validates status,
 * parses the response, and surfaces provider-labelled errors.
 * Applies a 60-second timeout so a hung provider cannot stall the function.
 */
async function callChat(ep: ChatEndpoint, apiKey: string, req: ChatRequest): Promise<TextResult> {
  const response = await fetch(ep.url(req), {
    method: 'POST',
    headers: ep.buildHeaders(apiKey),
    body: JSON.stringify(ep.buildBody(req)),
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`${ep.label} error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const parsed = ep.parseResponse(data)
  if (!parsed.content) {
    throw new Error(`${ep.label} returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return parsed
}

// --- Provider-specific body/parse helpers shared by OpenAI-compatible APIs ---

function openaiCompatBody(req: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      { role: 'system', content: req.systemPrompt },
      { role: 'user', content: req.userMessage },
    ],
    temperature: req.temperature ?? 0.8,
  }
  if (req.responseSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'scenario', strict: true, schema: req.responseSchema },
    }
  }
  return body
}

function groqCompatBody(req: ChatRequest): Record<string, unknown> {
  let systemPrompt = req.systemPrompt;
  if (req.responseSchema) {
    systemPrompt += '\n\nYou must output valid JSON matching the requested schema.';
  }
  const body: Record<string, unknown> = {
    model: req.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: req.userMessage },
    ],
    temperature: req.temperature ?? 0.8,
  }
  if (req.responseSchema) {
    body.response_format = { type: 'json_object' }
  }
  return body
}

function normalizeUsage(values: UsagePayload): UsagePayload | undefined {
  const usage: UsagePayload = {}
  if (typeof values.tokens_in === 'number' && Number.isFinite(values.tokens_in)) {
    usage.tokens_in = Math.max(0, Math.floor(values.tokens_in))
  }
  if (typeof values.tokens_out === 'number' && Number.isFinite(values.tokens_out)) {
    usage.tokens_out = Math.max(0, Math.floor(values.tokens_out))
  }
  if (typeof values.seconds_used === 'number' && Number.isFinite(values.seconds_used)) {
    usage.seconds_used = Math.max(0, values.seconds_used)
  }
  if (typeof values.cost_usd_override === 'number' && Number.isFinite(values.cost_usd_override)) {
    usage.cost_usd_override = values.cost_usd_override
  }
  return Object.keys(usage).length > 0 ? usage : undefined
}

function readOpenAICompatUsage(raw: unknown): UsagePayload | undefined {
  const data = raw as {
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_cost?: number }
  }
  return normalizeUsage({
    tokens_in: data.usage?.prompt_tokens,
    tokens_out: data.usage?.completion_tokens,
    cost_usd_override: data.usage?.total_cost,
  })
}

function readGeminiUsage(raw: unknown): UsagePayload | undefined {
  const data = raw as {
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }
  return normalizeUsage({
    tokens_in: data.usageMetadata?.promptTokenCount,
    tokens_out: data.usageMetadata?.candidatesTokenCount,
  })
}

function openaiCompatParse(raw: unknown): TextResult {
  const data = raw as { choices?: Array<{ message?: { content?: string } }>; usage?: unknown }
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: readOpenAICompatUsage(data),
  }
}

function geminiCompatBody(req: ChatRequest): Record<string, unknown> {
  const generationConfig: Record<string, unknown> = { temperature: req.temperature ?? 0.8 }
  if (req.responseSchema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = req.responseSchema
  }
  return {
    system_instruction: { parts: [{ text: req.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: req.userMessage }] }],
    generationConfig,
  }
}

function geminiCompatParse(raw: unknown): TextResult {
  const data = raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    usage: readGeminiUsage(data),
  }
}

// --- Endpoint registry for text-only chat providers ---

const CHAT_ENDPOINTS: Record<'openai' | 'genai' | 'groq' | 'openrouter', ChatEndpoint> = {
  openai: {
    label: 'OpenAI',
    url: () => 'https://api.openai.com/v1/chat/completions',
    buildHeaders: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    buildBody: openaiCompatBody,
    parseResponse: openaiCompatParse,
  },
  genai: {
    label: 'Gemini',
    url: (req) => `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent`,
    buildHeaders: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    }),
    buildBody: geminiCompatBody,
    parseResponse: geminiCompatParse,
  },
  groq: {
    label: 'Groq',
    url: () => 'https://api.groq.com/openai/v1/chat/completions',
    buildHeaders: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    buildBody: groqCompatBody,
    parseResponse: openaiCompatParse,
  },
  openrouter: {
    label: 'OpenRouter',
    url: () => 'https://openrouter.ai/api/v1/chat/completions',
    buildHeaders: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://speaklab.app',
      'X-Title': 'SpeakLab',
    }),
    buildBody: openaiCompatBody,
    parseResponse: openaiCompatParse,
  },
}

// ----------------------------------------------------------------------------
// Fallback helper (G1)
// ----------------------------------------------------------------------------

/**
 * Run `primary`. If it throws and a `fallback` is supplied, run the fallback.
 * Always surfaces the primary error on total failure — the fallback failure is
 * logged but not reported to the caller (same semantics the client used to have).
 */
async function withFallback<T>(
  primary: () => Promise<T>,
  fallback?: { run: () => Promise<T>; label: string },
): Promise<T> {
  try {
    return await primary()
  } catch (primaryErr) {
    if (!fallback) throw primaryErr
    console.warn(`Primary call failed, trying fallback (${fallback.label}):`, primaryErr)
    try {
      return await fallback.run()
    } catch (fallbackErr) {
      console.warn(`Fallback call also failed (${fallback.label}):`, fallbackErr)
      throw primaryErr
    }
  }
}

/**
 * Optional fallback metadata parsed off the request body.
 * Validated before use: unknown sources or missing models collapse to `null`.
 */
interface FallbackMeta {
  source: string
  model: string
  voice?: string
}

function parseFallback(raw: unknown): FallbackMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const source = typeof obj.source === 'string' ? normalizeSource(obj.source) : ''
  const model = typeof obj.model === 'string' ? obj.model : ''
  const voice = typeof obj.voice === 'string' ? obj.voice : undefined
  if (!source || !model) return null
  const allowed = new Set(['openai', 'genai', 'groq', 'openrouter', 'vertex'])
  if (!allowed.has(source)) return null
  return { source, model, voice }
}

// ----------------------------------------------------------------------------
// Dispatch helpers — switch on source, resolve the user's API key, call
// provider. Shared between primary and fallback code paths (G1).
// ----------------------------------------------------------------------------

async function resolveKeyOrThrow(userId: string, source: string): Promise<string> {
  // Vertex piggy-backs on the genai key.
  const keySource = source === 'vertex' ? 'genai' : source
  const apiKey = await getApiKey(userId, keySource)
  if (!apiKey) {
    if (source === 'vertex') throw new Error('No Gemini API key configured for Vertex AI')
    if (source === 'openai') throw new Error('No OpenAI API key configured')
    if (source === 'groq') throw new Error('No Groq API key configured')
    if (source === 'openrouter') throw new Error('No OpenRouter API key configured')
    throw new Error('No Gemini API key configured')
  }
  return apiKey
}

async function dispatchChat(
  userId: string,
  source: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature: number | undefined,
  responseSchema: Record<string, unknown> | undefined,
): Promise<TextResult> {
  const apiKey = await resolveKeyOrThrow(userId, source)
  if (source === 'vertex') {
    return vertexChat(apiKey, model, systemPrompt, userMessage, responseSchema)
  }
  if (source === 'openai' || source === 'genai' || source === 'groq' || source === 'openrouter') {
    return callChat(CHAT_ENDPOINTS[source], apiKey, { model, systemPrompt, userMessage, temperature, responseSchema })
  }
  throw new Error(`Unsupported chat source: ${source}`)
}

/**
 * Resolve a chat-with-image `imageUrl` (either a data: URL or an external URL
 * subject to SSRF guard + size cap) to raw base64 + mime. Pulled out so that
 * primary + fallback share a single fetch.
 */
async function resolveImagePayload(imageUrl: string): Promise<{ imageData: string; mimeType: string }> {
  if (imageUrl.startsWith('data:')) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error('Invalid data URL')
    return { mimeType: match[1], imageData: match[2] }
  }
  if (!isSafeImageUrl(imageUrl)) {
    throw new Error('Image URL must be a publicly accessible HTTPS or HTTP URL')
  }
  const fetched = await fetchBoundedImage(imageUrl)
  return { mimeType: fetched.mimeType, imageData: uint8ToBase64(fetched.bytes) }
}

async function dispatchChatWithImage(
  userId: string,
  source: string,
  model: string,
  systemPrompt: string,
  imageUrl: string,
  imageData: string,
  mimeType: string,
): Promise<TextResult> {
  const apiKey = await resolveKeyOrThrow(userId, source)

  if (source === 'vertex') {
    return vertexChatWithImage(apiKey, model, systemPrompt, imageData, mimeType)
  }

  if (source === 'genai') {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: imageData } },
            { text: 'Please create a question about this image as instructed.' },
          ],
        }],
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!geminiResp.ok) {
      const error = await geminiResp.text()
      throw new Error(`Gemini error: ${geminiResp.status} - ${error}`)
    }

    const geminiData = await geminiResp.json()
    return {
      content: geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '',
      usage: readGeminiUsage(geminiData),
    }
  }

  if (source === 'openrouter') {
    return openrouterChat(apiKey, model, systemPrompt, imageUrl)
  }

  // openai, groq — legacy behavior routed imageUrl as a message string.
  if (source === 'openai' || source === 'groq') {
    return callChat(CHAT_ENDPOINTS[source], apiKey, {
      model,
      systemPrompt,
      userMessage: imageUrl,
    })
  }

  throw new Error(`Unsupported chat-with-image source: ${source}`)
}

async function dispatchTTS(
  userId: string,
  source: string,
  model: string,
  voice: string,
  text: string,
): Promise<AudioResult> {
  const apiKey = await resolveKeyOrThrow(userId, source)
  if (source === 'openai') return openaiTTS(apiKey, text, voice, model)
  if (source === 'groq') return groqTTS(apiKey, text, voice, model)
  if (source === 'openrouter') return openrouterTTS(apiKey, text, voice, model)
  if (source === 'vertex') return vertexTTS(apiKey, model, text, voice)
  if (source === 'genai') return geminiTTS(apiKey, text, voice, model)
  throw new Error(`Unsupported TTS source: ${source}`)
}

async function dispatchSTT(
  userId: string,
  source: string,
  model: string,
  audioBase64: string,
  mimeType: string,
): Promise<STTResult> {
  const apiKey = await resolveKeyOrThrow(userId, source)
  if (source === 'openai') return openaiSTT(apiKey, audioBase64, mimeType, model)
  if (source === 'groq') return groqSTT(apiKey, audioBase64, mimeType, model)
  if (source === 'openrouter') return openrouterSTT(apiKey, audioBase64, mimeType, model)
  if (source === 'vertex') return vertexSTT(apiKey, model, audioBase64, mimeType)
  if (source === 'genai') return geminiSTT(apiKey, audioBase64, mimeType, model)
  throw new Error(`Unsupported STT source: ${source}`)
}

async function dispatchImage(
  userId: string,
  source: string,
  model: string,
  prompt: string,
  options: Record<string, unknown>,
): Promise<ImageResult> {
  const apiKey = await resolveKeyOrThrow(userId, source)
  if (source === 'vertex') return vertexImage(apiKey, model, prompt, options)
  if (source === 'openrouter') return openrouterImage(apiKey, prompt, model)
  if (source === 'openai') return openaiImage(apiKey, prompt, model, options)
  if (source === 'genai') return geminiImage(apiKey, prompt, model, options)
  throw new Error(`Unsupported image source: ${source}`)
}

// Note: openaiChat / geminiChat / groqChat thin wrappers were removed when
// `dispatchChat` started calling `callChat(CHAT_ENDPOINTS[source], …)` directly.

/**
 * OpenAI TTS
 */
async function openaiTTS(
  apiKey: string,
  text: string,
  voice: string,
  model: string,
): Promise<AudioResult> {
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
  return { audio: base64 }
}

/**
 * Gemini TTS
 */
async function geminiTTS(
  apiKey: string,
  text: string,
  voice: string,
  model: string,
): Promise<AudioResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
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
    throw new Error(`Gemini TTS error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!audioData) {
    throw new Error('Gemini TTS returned no audio data')
  }

  // Wrap PCM16 in WAV header
  return {
    audio: pcm16ToWav(audioData, 24000),
    usage: readGeminiUsage(data),
  }
}

/**
 * Groq TTS
 */
async function groqTTS(
  apiKey: string,
  text: string,
  voice: string,
  model: string,
): Promise<AudioResult> {
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
  return { audio: base64 }
}

/**
 * OpenAI STT
 */
async function openaiSTT(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  model: string,
): Promise<STTResult> {
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
  return {
    text: data.text,
    usage: readOpenAICompatUsage(data),
  }
}

/**
 * Gemini STT
 */
async function geminiSTT(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  model: string,
): Promise<STTResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: 'Transcribe exactly what was said in English. Output ONLY the transcription text, nothing else.' },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini STT error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini STT returned no text')
  return {
    text: text.trim(),
    usage: readGeminiUsage(data),
  }
}

/**
 * Groq STT
 */
async function groqSTT(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  model: string,
): Promise<STTResult> {
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
  return {
    text: data.text,
    usage: readOpenAICompatUsage(data),
  }
}

// ============================================================================
// OPENROUTER API CALLS
// ============================================================================

/**
 * OpenRouter Chat Completion (OpenAI-compatible format).
 * Thin wrapper over `callChat` — see CHAT_ENDPOINTS.openrouter above.
 */
async function openrouterChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  temperature = 0.8,
  responseSchema?: Record<string, unknown>,
): Promise<TextResult> {
  return callChat(CHAT_ENDPOINTS.openrouter, apiKey, { model, systemPrompt, userMessage, temperature, responseSchema })
}

/**
 * OpenRouter TTS — passes through to OpenAI-compatible audio endpoint.
 * Most OpenRouter models don't support TTS; only use with compatible models.
 */
async function openrouterTTS(
  apiKey: string,
  text: string,
  voice: string,
  model: string,
): Promise<AudioResult> {
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
  return { audio: uint8ToBase64(new Uint8Array(buffer)) }
}

/**
 * OpenRouter STT — uses chat completions with input_audio content.
 * Models like openai/gpt-audio support audio via chat completions, not transcription endpoint.
 */
async function openrouterSTT(
  apiKey: string,
  audioBase64: string,
  mimeType: string,
  model: string,
): Promise<STTResult> {
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
  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: readOpenAICompatUsage(data),
  }
}

/**
 * OpenRouter Image Generation — uses chat completions with image modality.
 * OpenRouter doesn't support /images/generations; image models use chat completions.
 */
async function openrouterImage(apiKey: string, prompt: string, model: string): Promise<ImageResult> {
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
        return { image: imageUrl.startsWith('data:') ? imageUrl : imageUrl, usage: readOpenAICompatUsage(data) }
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
async function vertexChat(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  responseSchema?: Record<string, unknown>,
): Promise<TextResult> {
  const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`

  const generationConfig: Record<string, unknown> = { temperature: 0.8 }
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = responseSchema
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig,
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
  return {
    content: text,
    usage: readGeminiUsage(data),
  }
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
): Promise<TextResult> {
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
  return {
    content: text,
    usage: readGeminiUsage(data),
  }
}

/**
 * Vertex AI TTS (express mode with API key)
 */
async function vertexTTS(
  apiKey: string,
  model: string,
  text: string,
  voice: string,
): Promise<AudioResult> {
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

  return {
    audio: pcm16ToWav(audioData, 24000),
    usage: readGeminiUsage(data),
  }
}

/**
 * Vertex AI STT (express mode with API key)
 */
async function vertexSTT(
  apiKey: string,
  model: string,
  audioBase64: string,
  mimeType: string,
): Promise<STTResult> {
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
  return {
    text: text.trim(),
    usage: readGeminiUsage(data),
  }
}

/**
 * Vertex AI Image Generation (express mode with API key)
 */
async function vertexImage(
  apiKey: string,
  model: string,
  prompt: string,
  options: Record<string, unknown>,
): Promise<ImageResult> {
  const isImagenModel = model.startsWith('imagen-')

  if (isImagenModel) {
    const parameters: Record<string, unknown> = {
      sampleCount: 1,
    }
    if (options.aspectRatio) parameters.aspectRatio = options.aspectRatio
    if (options.imageSize) parameters.imageSize = options.imageSize
    if (options.personGeneration) parameters.personGeneration = options.personGeneration
    if (options.numberOfImages) parameters.sampleCount = options.numberOfImages

    const url = `https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:predict`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: parameters,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Vertex AI Image error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    if (data.predictions && data.predictions[0]) {
      const bytesBase64 = data.predictions[0].bytesBase64
      if (bytesBase64) {
        return {
          image: `data:image/png;base64,${bytesBase64}`,
          usage: readGeminiUsage(data),
        }
      }
    }

    throw new Error('Vertex AI did not return an image.')
  } else {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }

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
        return {
          image: `data:${mime};base64,${part.inlineData.data}`,
          usage: readGeminiUsage(data),
        }
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
async function openaiImage(
  apiKey: string,
  prompt: string,
  model: string,
  options: Record<string, unknown>,
): Promise<ImageResult> {
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
    if (data.data[0].url) return { image: data.data[0].url, usage: readOpenAICompatUsage(data) }
    if (data.data[0].b64_json) {
      return {
        image: `data:image/png;base64,${data.data[0].b64_json}`,
        usage: readOpenAICompatUsage(data),
      }
    }
  }

  throw new Error(`OpenAI response missing image: ${JSON.stringify(data)}`)
}

/**
 * Gemini Image Generation
 */
async function geminiImage(
  apiKey: string,
  prompt: string,
  model: string,
  options: Record<string, unknown>,
): Promise<ImageResult> {
  const isImagenModel = model.startsWith('imagen-')

  if (isImagenModel) {
    const parameters: Record<string, unknown> = {
      sampleCount: 1,
    }
    if (options.aspectRatio) parameters.aspectRatio = options.aspectRatio
    if (options.imageSize) parameters.imageSize = options.imageSize
    if (options.personGeneration) parameters.personGeneration = options.personGeneration
    if (options.numberOfImages) parameters.sampleCount = options.numberOfImages

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters,
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
      if (bytesBase64) {
        return {
          image: `data:image/png;base64,${bytesBase64}`,
          usage: readGeminiUsage(data),
        }
      }
    }

    throw new Error('Gemini did not return an image.')
  } else {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }

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
        return {
          image: `data:${mime};base64,${part.inlineData.data}`,
          usage: readGeminiUsage(data),
        }
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
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    // Non-allowlisted origins: 403 with NO Access-Control-Allow-Origin.
    if (!isOriginAllowed(origin)) {
      return new Response('forbidden', { status: 403, headers: cors })
    }
    return new Response('ok', { headers: cors })
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
        return new Response(JSON.stringify({ success: true }), { headers: cors })
      }

      case 'get_key': {
        const src = normalizeSource(body.source || body.provider)
        const key = await getApiKey(userId, src)
        return new Response(JSON.stringify({ key }), { headers: cors })
      }

      // Chat
      case 'chat': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash' : 'gpt-4o-mini')
        const fallback = parseFallback(body.fallback)

        let result: TextResult

        if (body.imageMode) {
          // Pre-fetch image bytes once so fallback doesn't re-download.
          const { imageData, mimeType } = await resolveImagePayload(body.imageUrl)

          const primaryRun = () => dispatchChatWithImage(
            userId, source, model, body.systemPrompt, body.imageUrl, imageData, mimeType,
          )
          const fallbackRun = fallback
            ? { run: () => dispatchChatWithImage(
                userId,
                fallback.source,
                fallback.model,
                body.systemPrompt,
                body.imageUrl,
                imageData,
                mimeType,
              ), label: `${fallback.source}:${fallback.model}` }
            : undefined

          result = await withFallback(primaryRun, fallbackRun)
        } else {
          // Regular chat
          const schema = body.responseSchema || undefined
          const primaryRun = () => dispatchChat(
            userId, source, model, body.systemPrompt, body.userMessage, body.temperature, schema,
          )
          const fallbackRun = fallback
            ? { run: () => dispatchChat(
                userId,
                fallback.source,
                fallback.model,
                body.systemPrompt,
                body.userMessage,
                body.temperature,
                schema,
              ), label: `${fallback.source}:${fallback.model}` }
            : undefined

          result = await withFallback(primaryRun, fallbackRun)
        }

        return new Response(JSON.stringify(result), { headers: cors })
      }

      // TTS
      case 'tts': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash-preview-tts' : 'tts-1')
        const voice = body.voice || (source === 'genai' || source === 'vertex' ? 'Kore' : 'alloy')
        const fallback = parseFallback(body.fallback)

        const primaryRun = () => dispatchTTS(userId, source, model, voice, body.text)
        const fallbackRun = fallback
          ? { run: () => dispatchTTS(
              userId,
              fallback.source,
              fallback.model,
              fallback.voice || voice,
              body.text,
            ), label: `${fallback.source}:${fallback.model}` }
          : undefined

        const result = await withFallback(primaryRun, fallbackRun)

        return new Response(JSON.stringify(result), { headers: cors })
      }

      // STT
      case 'stt': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-2.5-flash' : 'whisper-1')
        const fallback = parseFallback(body.fallback)

        const primaryRun = () => dispatchSTT(userId, source, model, body.audio, body.mimeType)
        const fallbackRun = fallback
          ? { run: () => dispatchSTT(userId, fallback.source, fallback.model, body.audio, body.mimeType),
              label: `${fallback.source}:${fallback.model}` }
          : undefined

        const result = await withFallback(primaryRun, fallbackRun)

        return new Response(JSON.stringify(result), { headers: cors })
      }

      // Image Generation
      case 'image': {
        const source = normalizeSource(body.source || body.provider, 'genai')
        const model = body.model || (source === 'genai' || source === 'vertex' ? 'gemini-3.1-flash-image-preview' : 'gpt-image-1')
        const fallback = parseFallback(body.fallback)

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

        const primaryRun = () => dispatchImage(userId, source, model, body.prompt, options)
        const fallbackRun = fallback
          ? { run: () => dispatchImage(userId, fallback.source, fallback.model, body.prompt, options),
              label: `${fallback.source}:${fallback.model}` }
          : undefined

        const result = await withFallback(primaryRun, fallbackRun)

        const isBase64 = result.image.startsWith('data:')
        return new Response(
          JSON.stringify(isBase64
            ? { imageData: result.image, usage: result.usage }
            : { imageUrl: result.image, usage: result.usage }),
          { headers: cors }
        )
      }

      // Vertex AI Live Token
      case 'get_vertex_live_token': {
        // Requires VERTEX_SERVICE_ACCOUNT_KEY secret to be configured
        const accessToken = await getVertexAccessToken()
        const { projectId, region } = await getVertexConfig(userId)
        return new Response(
          JSON.stringify({ accessToken, projectId, region }),
          { headers: cors }
        )
      }

      default:
        throw new Error(`Unknown action: ${body.action}`)
    }
  } catch (error) {
    console.error('Error in ai-proxy:', error)
    const message = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: cors }
    )
  }
})
