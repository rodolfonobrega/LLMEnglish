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
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get encryption key from environment
const ENCRYPTION_KEY = Deno.env.get('ENCRYPTION_KEY')
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable not set')
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// ENCRYPTION UTILITIES
// ============================================================================

/**
 * Decrypt data using AES-256-GCM
 */
async function decrypt(ciphertext: string, iv: string, key: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(key)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    ciphertextBytes
  )

  return new TextDecoder().decode(decrypted)
}

// ============================================================================
// API KEY RETRIEVAL
// ============================================================================

/**
 * Get and decrypt a user's API key
 */
async function getApiKey(userId: string, provider: 'openai' | 'gemini' | 'groq'): Promise<string | null> {
  const { data, error } = await supabase
    .from('encrypted_api_keys')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  const keyField = `${provider}_key` as const
  const encryptedKey = data[keyField]

  if (!encryptedKey) {
    return null
  }

  // For now, keys are stored as simple base64 (migration from LocalStorage)
  // In production, you'd decrypt them here
  try {
    // If the key is JSON (encrypted format), decrypt it
    if (encryptedKey.startsWith('{')) {
      const parsed = JSON.parse(encryptedKey)
      if (parsed.ciphertext && parsed.iv) {
        return await decrypt(parsed.ciphertext, parsed.iv, ENCRYPTION_KEY)
      }
    }
    // Otherwise, assume it's already plaintext (migration scenario)
    return encryptedKey
  } catch {
    return encryptedKey
  }
}

/**
 * Save an encrypted API key
 */
async function saveApiKey(userId: string, provider: 'openai' | 'gemini' | 'groq', key: string): Promise<void> {
  const { data: existing } = await supabase
    .from('encrypted_api_keys')
    .select('id')
    .eq('user_id', userId)
    .single()

  const updateData: Record<string, string> = {}
  updateData[`${provider}_key`] = key
  updateData[`${provider}_key_updated_at`] = new Date().toISOString()

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
  return data.choices[0].message.content
}

/**
 * Gemini Chat Completion
 */
async function geminiChat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  return data.candidates[0].content.parts[0].text
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
  return data.choices[0].message.content
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
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
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
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
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
async function geminiSTT(apiKey: string, audioBase64: string, mimeType: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')

  const ai = new GoogleGenerativeAI({ apiKey })
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
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

/**
 * OpenAI Image Generation
 */
async function openaiImage(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
  const body: Record<string, unknown> = { model, prompt, n: 1 }

  if (options.size) body.size = options.size
  if (options.quality) body.quality = options.quality

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
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (options.imageSize) generationConfig.imageSize = options.imageSize

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  return btoa(String.fromCharCode(...wavBytes))
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
          await saveApiKey(userId, body.provider, body.key)
        } else {
          for (const [provider, key] of Object.entries(body.keys)) {
            if (key) {
              await saveApiKey(userId, provider as 'openai' | 'gemini' | 'groq', key as string)
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
      }

      case 'get_key': {
        const key = await getApiKey(userId, body.provider)
        return new Response(JSON.stringify({ key }), { headers: corsHeaders })
      }

      // Chat
      case 'chat': {
        const provider = body.provider || 'gemini'
        const model = body.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini')
        const apiKey = await getApiKey(userId, provider)

        if (!apiKey) {
          throw new Error(`No ${provider} API key configured`)
        }

        let content: string

        if (body.imageMode) {
          // Chat with image
          if (provider === 'gemini') {
            // Handle image with Gemini
            const { GoogleGenerativeAI } = await import('https://esm.sh/@google/generative-ai@0.21.0')

            // Extract image data
            let imageData: string
            let mimeType: string

            if (body.imageUrl.startsWith('data:')) {
              const match = body.imageUrl.match(/^data:([^;]+);base64,(.+)$/)
              if (!match) throw new Error('Invalid data URL')
              mimeType = match[1]
              imageData = match[2]
            } else {
              // Fetch remote image
              const imgResp = await fetch(body.imageUrl)
              const blob = await imgResp.blob()
              mimeType = blob.type || 'image/png'
              imageData = await blob.arrayBuffer().then(b => btoa(String.fromCharCode(...new Uint8Array(b))))
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

            content = response.candidates[0].content.parts[0].text
          } else {
            // Handle image with OpenAI
            content = await openaiChat(apiKey, model, body.systemPrompt, body.imageUrl)
          }
        } else {
          // Regular chat
          if (provider === 'openai') {
            content = await openaiChat(apiKey, model, body.systemPrompt, body.userMessage, body.temperature)
          } else if (provider === 'groq') {
            content = await groqChat(apiKey, model, body.systemPrompt, body.userMessage)
          } else {
            content = await geminiChat(apiKey, model, body.systemPrompt, body.userMessage)
          }
        }

        return new Response(JSON.stringify({ content }), { headers: corsHeaders })
      }

      // TTS
      case 'tts': {
        const provider = body.provider || 'gemini'
        const model = body.model || (provider === 'gemini' ? 'gemini-2.5-flash-preview-tts' : 'tts-1')
        const voice = body.voice || (provider === 'gemini' ? 'Kore' : 'alloy')
        const apiKey = await getApiKey(userId, provider)

        if (!apiKey) {
          throw new Error(`No ${provider} API key configured`)
        }

        let audio: string

        if (provider === 'openai') {
          audio = await openaiTTS(apiKey, body.text, voice, model)
        } else if (provider === 'groq') {
          audio = await groqTTS(apiKey, body.text, voice, model)
        } else {
          audio = await geminiTTS(apiKey, body.text, voice, model)
        }

        return new Response(JSON.stringify({ audio }), { headers: corsHeaders })
      }

      // STT
      case 'stt': {
        const provider = body.provider || 'gemini'
        const model = body.model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'whisper-1')
        const apiKey = await getApiKey(userId, provider)

        if (!apiKey) {
          throw new Error(`No ${provider} API key configured`)
        }

        let text: string

        if (provider === 'openai') {
          text = await openaiSTT(apiKey, body.audio, body.mimeType, model)
        } else if (provider === 'groq') {
          text = await groqSTT(apiKey, body.audio, body.mimeType, model)
        } else {
          text = await geminiSTT(apiKey, body.audio, body.mimeType)
        }

        return new Response(JSON.stringify({ text }), { headers: corsHeaders })
      }

      // Image Generation
      case 'image': {
        const provider = body.provider || 'gemini'
        const model = body.model || (provider === 'gemini' ? 'gemini-2.5-flash-image' : 'gpt-image-1')
        const apiKey = await getApiKey(userId, provider)

        if (!apiKey) {
          throw new Error(`No ${provider} API key configured`)
        }

        const options = {
          size: body.size,
          aspectRatio: body.aspectRatio,
          imageSize: body.imageSize,
          numberOfImages: body.numberOfImages,
        }

        let result: string

        if (provider === 'gemini') {
          result = await geminiImage(apiKey, body.prompt, model, options)
        } else {
          result = await openaiImage(apiKey, body.prompt, model, options)
        }

        const isBase64 = result.startsWith('data:')
        return new Response(
          JSON.stringify(isBase64 ? { imageData: result } : { imageUrl: result }),
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
