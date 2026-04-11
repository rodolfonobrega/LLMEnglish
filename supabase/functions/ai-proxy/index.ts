// Supabase Edge Function: ai-proxy
//
// This Edge Function acts as a secure proxy for AI API calls.
// It decrypts the user's API keys and makes the actual API calls.
//
// Environment variables (set via `supabase secrets set` or a local env file):
// - ENCRYPTION_KEY: A 32-byte hex string for AES-256-GCM encryption

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { uint8ToBase64 } from './utils.ts'
import { normalizeSource, getApiKey as getApiKeyFromModule, saveApiKey as saveApiKeyFromModule } from './api-keys.ts'
import * as Gemini from './providers/gemini.ts'
import * as OpenAI from './providers/openai.ts'
import * as Groq from './providers/groq.ts'
import * as OpenRouter from './providers/openrouter.ts'
import * as Vertex from './providers/vertex.ts'

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
// SECURITY: SSRF protection for server-side image fetching
// ============================================================================

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
// API KEY WRAPPERS (closures over module-level supabase + ENCRYPTION_KEY)
// ============================================================================

async function getApiKey(userId: string, source: string): Promise<string | null> {
  return getApiKeyFromModule(supabase, ENCRYPTION_KEY, userId, source)
}

async function saveApiKey(userId: string, source: string, key: string): Promise<void> {
  return saveApiKeyFromModule(supabase, ENCRYPTION_KEY, userId, source, key)
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
            const accessToken = await Vertex.getAccessToken()
            const { projectId, region } = await Vertex.getConfig(supabase, userId)

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

            content = await Vertex.chatWithImage(accessToken, projectId, region, model, body.systemPrompt, imageData, mimeType)
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
            content = await OpenRouter.chat(apiKey, model, body.systemPrompt, body.imageUrl)
          } else {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenAI API key configured')
            content = await OpenAI.chat(apiKey, model, body.systemPrompt, body.imageUrl)
          }
        } else {
          // Regular chat
          if (source === 'openai') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenAI API key configured')
            content = await OpenAI.chat(apiKey, model, body.systemPrompt, body.userMessage, body.temperature)
          } else if (source === 'groq') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No Groq API key configured')
            content = await Groq.chat(apiKey, model, body.systemPrompt, body.userMessage)
          } else if (source === 'openrouter') {
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No OpenRouter API key configured')
            content = await OpenRouter.chat(apiKey, model, body.systemPrompt, body.userMessage, body.temperature)
          } else if (source === 'vertex') {
            const accessToken = await Vertex.getAccessToken()
            const { projectId, region } = await Vertex.getConfig(supabase, userId)
            content = await Vertex.chat(accessToken, projectId, region, model, body.systemPrompt, body.userMessage)
          } else {
            // genai (default)
            const apiKey = await getApiKey(userId, source)
            if (!apiKey) throw new Error('No Gemini API key configured')
            content = await Gemini.chat(apiKey, model, body.systemPrompt, body.userMessage)
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
          audio = await OpenAI.tts(apiKey, body.text, voice, model)
        } else if (source === 'groq') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Groq API key configured')
          audio = await Groq.tts(apiKey, body.text, voice, model)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          audio = await OpenRouter.tts(apiKey, body.text, voice, model)
        } else if (source === 'vertex') {
          const accessToken = await Vertex.getAccessToken()
          const { projectId, region } = await Vertex.getConfig(supabase, userId)
          audio = await Vertex.tts(accessToken, projectId, region, model, body.text, voice)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          audio = await Gemini.tts(apiKey, body.text, voice, model)
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
          text = await OpenAI.stt(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'groq') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Groq API key configured')
          text = await Groq.stt(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          text = await OpenRouter.stt(apiKey, body.audio, body.mimeType, model)
        } else if (source === 'vertex') {
          const accessToken = await Vertex.getAccessToken()
          const { projectId, region } = await Vertex.getConfig(supabase, userId)
          text = await Vertex.stt(accessToken, projectId, region, model, body.audio, body.mimeType)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          text = await Gemini.stt(apiKey, body.audio, body.mimeType, model)
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
          const accessToken = await Vertex.getAccessToken()
          const { projectId, region } = await Vertex.getConfig(supabase, userId)
          result = await Vertex.image(accessToken, projectId, region, model, body.prompt, options)
        } else if (source === 'openrouter') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenRouter API key configured')
          result = await OpenRouter.image(apiKey, body.prompt, model)
        } else if (source === 'openai') {
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No OpenAI API key configured')
          result = await OpenAI.image(apiKey, body.prompt, model, options)
        } else {
          // genai (default)
          const apiKey = await getApiKey(userId, source)
          if (!apiKey) throw new Error('No Gemini API key configured')
          result = await Gemini.image(apiKey, body.prompt, model, options)
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
        const accessToken = await Vertex.getAccessToken()
        const { projectId, region } = await Vertex.getConfig(supabase, userId)
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
