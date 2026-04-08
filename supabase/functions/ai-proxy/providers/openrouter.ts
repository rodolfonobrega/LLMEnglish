/** OpenRouter API calls: chat, TTS, STT, image generation */

/**
 * OpenRouter Chat Completion (OpenAI-compatible format)
 */
export async function chat(apiKey: string, model: string, systemPrompt: string, userMessage: string, temperature = 0.8): Promise<string> {
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
  return data.choices[0].message.content
}

/**
 * OpenRouter TTS — passes through to OpenAI-compatible audio endpoint.
 * Most OpenRouter models don't support TTS; only use with compatible models.
 */
export async function tts(apiKey: string, text: string, voice: string, model: string): Promise<string> {
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
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

/**
 * OpenRouter STT — uses chat completions with input_audio content.
 * Models like openai/gpt-audio support audio via chat completions, not transcription endpoint.
 */
export async function stt(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
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
export async function image(apiKey: string, prompt: string, model: string): Promise<string> {
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
