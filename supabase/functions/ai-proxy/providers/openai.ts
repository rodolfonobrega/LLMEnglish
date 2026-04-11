/** OpenAI API calls: chat, TTS, STT, image generation */
import { uint8ToBase64 } from '../utils.ts'

export async function chat(apiKey: string, model: string, systemPrompt: string, userMessage: string, temperature = 0.8): Promise<string> {
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
 * OpenAI TTS
 */
export async function tts(apiKey: string, text: string, voice: string, model: string): Promise<string> {
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
 * OpenAI STT
 */
export async function stt(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
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
 * OpenAI Image Generation
 */
export async function image(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
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
