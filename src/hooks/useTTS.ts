import { useState, useCallback } from 'react';
import { textToSpeech } from '../services/openai';
import { getModelConfig } from '../services/storage';
import { base64ToAudioUrl, playAudioUrl, stopCurrentAudio } from '../utils/audio';

function getTtsMimeType(): string {
  const config = getModelConfig();
  // OpenAI returns MP3; Gemini and Groq (Orpheus) return WAV
  return config.ttsProvider === 'openai' ? 'audio/mp3' : 'audio/wav';
}

export function useTTS() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback(async (text: string, voiceOverride?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      stopCurrentAudio();
      const base64 = await textToSpeech(text, voiceOverride);
      const url = base64ToAudioUrl(base64, getTtsMimeType());
      playAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TTS failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { speak, isLoading, error, stopAudio: stopCurrentAudio };
}
