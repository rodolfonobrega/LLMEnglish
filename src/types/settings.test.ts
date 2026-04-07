import { describe, expect, it } from 'vitest';

import {
  GEMINI_TTS_VOICES,
  GROQ_TTS_VOICES,
  OPENAI_TTS_VOICES,
  defaultTtsVoice,
  normalizeTtsVoice,
  ttsVoicesForSource,
} from './settings';

describe('tts voice catalogs', () => {
  it('includes the full Gemini TTS voice catalog', () => {
    expect(GEMINI_TTS_VOICES).toHaveLength(30);
    expect(GEMINI_TTS_VOICES[0]?.value).toBe('Zephyr');
    expect(GEMINI_TTS_VOICES.some(voice => voice.value === 'Kore')).toBe(true);
    expect(GEMINI_TTS_VOICES.some(voice => voice.value === 'Sulafat')).toBe(true);
  });

  it('includes the full OpenAI TTS voice catalog', () => {
    expect(OPENAI_TTS_VOICES).toHaveLength(13);
    expect(OPENAI_TTS_VOICES.some(voice => voice.value === 'ballad')).toBe(true);
    expect(OPENAI_TTS_VOICES.some(voice => voice.value === 'marin')).toBe(true);
    expect(OPENAI_TTS_VOICES.some(voice => voice.value === 'cedar')).toBe(true);
  });

  it('keeps the full Groq Orpheus voice catalog', () => {
    expect(GROQ_TTS_VOICES).toHaveLength(6);
    expect(GROQ_TTS_VOICES.map(voice => voice.value)).toEqual([
      'autumn',
      'diana',
      'hannah',
      'austin',
      'daniel',
      'troy',
    ]);
  });
});

describe('tts voice compatibility', () => {
  it('filters OpenAI legacy TTS models to the supported 9 voices', () => {
    const voices = ttsVoicesForSource('openai', 'tts-1').map(voice => voice.value);
    expect(voices).toHaveLength(9);
    expect(voices).not.toContain('ballad');
    expect(voices).not.toContain('marin');
    expect(voices).not.toContain('cedar');
  });

  it('exposes all 13 OpenAI voices for gpt-4o-mini-tts', () => {
    const voices = ttsVoicesForSource('openai', 'gpt-4o-mini-tts').map(voice => voice.value);
    expect(voices).toHaveLength(13);
    expect(voices).toContain('ballad');
    expect(voices).toContain('marin');
    expect(voices).toContain('cedar');
  });

  it('chooses sensible defaults per source and model', () => {
    expect(defaultTtsVoice('genai', 'gemini-2.5-flash-preview-tts')).toBe('Kore');
    expect(defaultTtsVoice('groq', 'canopylabs/orpheus-v1-english')).toBe('hannah');
    expect(defaultTtsVoice('openai', 'tts-1')).toBe('alloy');
    expect(defaultTtsVoice('openai', 'gpt-4o-mini-tts')).toBe('marin');
  });

  it('normalizes invalid voices to a supported default', () => {
    expect(normalizeTtsVoice('openai', 'tts-1', 'ballad')).toBe('alloy');
    expect(normalizeTtsVoice('openai', 'gpt-4o-mini-tts', 'ballad')).toBe('ballad');
    expect(normalizeTtsVoice('genai', 'gemini-2.5-flash-preview-tts', 'Puck')).toBe('Puck');
  });
});
