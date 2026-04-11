/** Groq API calls: chat, TTS, STT */
import { uint8ToBase64 } from '../utils.ts'

/**
 * Groq Chat Completion
 */
export async function chat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
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
 * Groq TTS
 */
export async function tts(apiKey: string, text: string, voice: string, model: string): Promise<string> {
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
 * Groq STT
 */
export async function stt(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
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
