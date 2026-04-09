/** Gemini API calls: chat, TTS, STT, image generation */
import { pcm16ToWav } from '../utils.ts'

/**
 * Gemini Chat Completion
 */
export async function chat(apiKey: string, model: string, systemPrompt: string, userMessage: string): Promise<string> {
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
 * Gemini TTS
 */
export async function tts(apiKey: string, text: string, voice: string, model: string): Promise<string> {
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
 * Gemini STT
 */
export async function stt(apiKey: string, audioBase64: string, mimeType: string): Promise<string> {
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
 * Gemini Image Generation
 */
export async function image(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
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
