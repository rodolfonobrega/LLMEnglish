/** Vertex AI API calls: auth, config, chat, chatWithImage, TTS, STT, image */
import { pcm16ToWav, str2ab, uint8ToBase64 } from '../utils.ts'

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
 * Get Vertex AI access token using Application Default Credentials.
 * In Supabase Edge Functions, this reads from VERTEX_SERVICE_ACCOUNT_KEY secret.
 */
export async function getAccessToken(): Promise<string> {
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
interface SupabaseQueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{ data: any; error: any }>
      }
    }
  }
}

export async function getConfig(supabaseClient: SupabaseQueryClient, userId: string): Promise<{ projectId: string; region: string }> {
  const { data, error } = await supabaseClient
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
 * Vertex AI Chat Completion (Gemini API format, different URL)
 */
export async function chat(accessToken: string, projectId: string, region: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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
 * Vertex AI Chat with Image (Gemini API format)
 */
export async function chatWithImage(
  accessToken: string,
  projectId: string,
  region: string,
  model: string,
  systemPrompt: string,
  imageBase64: string,
  imageMimeType: string,
): Promise<string> {
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`

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
      'Authorization': `Bearer ${accessToken}`,
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
 * Vertex AI TTS (Gemini API format)
 */
export async function tts(accessToken: string, projectId: string, region: string, model: string, text: string, voice: string): Promise<string> {
  // Vertex uses REST API with AUDIO response modality
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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
 * Vertex AI STT (Gemini API format)
 */
export async function stt(accessToken: string, projectId: string, region: string, model: string, audioBase64: string, mimeType: string): Promise<string> {
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
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
 * Vertex AI Image Generation
 */
export async function image(accessToken: string, projectId: string, region: string, model: string, prompt: string, options: Record<string, unknown>): Promise<string> {
  const isImagenModel = model.startsWith('imagen-')

  if (isImagenModel) {
    const generationConfig: Record<string, unknown> = {
      responseModalities: ['IMAGE'],
    }
    if (options.aspectRatio) generationConfig.aspectRatio = options.aspectRatio
    if (options.numberOfImages) generationConfig.numberOfImages = options.numberOfImages
    else generationConfig.numberOfImages = 1

    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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

    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
