import { useState, useCallback } from 'react';
import { textToSpeech } from '../services/openai';
import { getModelConfig } from '../services/storage';
import { base64ToAudioUrl, playAudioUrl, stopCurrentAudio } from '../utils/audio';

function getTtsMimeType(): string {
  const config = getModelConfig();
  return config.ttsProvider === 'gemini' ? 'audio/wav' : 'audio/mp3';
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
