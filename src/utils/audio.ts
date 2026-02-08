/**
 * Convert a Float32Array of audio samples to PCM16 Int16Array.
 */
export function float32ToPCM16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

/**
 * Convert Int16Array PCM16 to base64 string.
 */
export function pcm16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert a Blob to base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data URL prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 to Blob.
 */
export function base64ToBlob(base64: string, mimeType = 'audio/wav'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Wrap raw PCM16 base64 data in a WAV container so browsers can play it.
 * Assumes mono, 24000Hz sample rate (Gemini TTS default).
 */
export function pcm16Base64ToWavBase64(pcm16Base64: string, sampleRate = 24000): string {
  const binaryStr = atob(pcm16Base64);
  const pcmBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    pcmBytes[i] = binaryStr.charCodeAt(i);
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.length;
  const headerSize = 44;
  const wav = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(wav);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // subchunk1 size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavBytes = new Uint8Array(wav);
  wavBytes.set(pcmBytes, headerSize);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < wavBytes.length; i++) {
    binary += String.fromCharCode(wavBytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Create an audio URL from base64.
 */
export function base64ToAudioUrl(base64: string, mimeType = 'audio/mp3'): string {
  const blob = base64ToBlob(base64, mimeType);
  return URL.createObjectURL(blob);
}

/**
 * Stop all currently playing audio elements.
 */
let currentAudio: HTMLAudioElement | null = null;

export function playAudioUrl(url: string): HTMLAudioElement {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  const audio = new Audio(url);
  currentAudio = audio;
  audio.play();
  return audio;
}

export function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}
