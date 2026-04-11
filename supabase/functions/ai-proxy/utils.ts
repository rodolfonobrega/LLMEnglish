/** PCM16-to-WAV conversion and buffer helpers */

/**
 * Safely convert a Uint8Array to a base64 string.
 * Uses chunked encoding to avoid call stack limits with the spread operator
 * on large arrays (>64KB TTS audio, images, etc.).
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function str2ab(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(str.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i)
  }
  return buf
}

/**
 * Convert PCM16 to WAV
 */
export function pcm16ToWav(pcm16Base64: string, sampleRate: number): string {
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

export function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}
