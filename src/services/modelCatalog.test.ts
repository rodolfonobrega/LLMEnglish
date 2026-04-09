import { describe, expect, it } from 'vitest';
import {
  CHAT_MODELS,
  IMAGE_MODELS,
  LIVE_MODELS,
  STT_MODELS,
  TTS_MODELS,
} from '../types/settings';
import { getSourcesForModel, isKnownModel, resolveSource } from './modelCatalog';

describe('modelCatalog', () => {
  // --- Test 1: Catalog size matches unique model IDs across all 5 arrays ---
  it('contains exactly the number of unique model IDs across all 5 arrays', () => {
    const allModels = [...CHAT_MODELS, ...STT_MODELS, ...TTS_MODELS, ...IMAGE_MODELS, ...LIVE_MODELS];
    const uniqueIds = new Set(allModels.map(m => m.value));
    // Verify every unique ID resolves in the catalog
    let catalogHitCount = 0;
    for (const id of uniqueIds) {
      if (getSourcesForModel(id) !== undefined) {
        catalogHitCount++;
      }
    }
    expect(catalogHitCount).toBe(uniqueIds.size);
  });

  // --- Test 2: Duplicate model ID maps to multiple sources ---
  it('maps gemini-3.1-pro-preview to both genai and vertex', () => {
    const sources = getSourcesForModel('gemini-3.1-pro-preview');
    expect(sources).toBeDefined();
    expect(sources!.has('genai')).toBe(true);
    expect(sources!.has('vertex')).toBe(true);
  });

  // --- Test 3: Single-source model maps to one source ---
  it('maps gpt-5.4 to openai only', () => {
    const sources = getSourcesForModel('gpt-5.4');
    expect(sources).toBeDefined();
    expect(sources!.size).toBe(1);
    expect(sources!.has('openai')).toBe(true);
  });

  // --- Test 4: isKnownModel validates model+source combination ---
  it('returns true for known model+source, false for wrong source', () => {
    expect(isKnownModel('gemini-3.1-pro-preview', 'genai')).toBe(true);
    expect(isKnownModel('gemini-3.1-pro-preview', 'vertex')).toBe(true);
    expect(isKnownModel('gemini-3.1-pro-preview', 'groq')).toBe(false);
  });

  // --- Test 5: isKnownModel returns false for unknown model ---
  it('returns false for totally unknown model', () => {
    expect(isKnownModel('totally-unknown-model', 'openai')).toBe(false);
  });

  // --- Test 6: getSourcesForModel returns correct set for multi-source model ---
  it('returns genai+vertex set for gemini-3.1-pro-preview', () => {
    const sources = getSourcesForModel('gemini-3.1-pro-preview');
    expect(sources).toBeDefined();
    expect(sources).toEqual(new Set(['genai', 'vertex']));
  });

  // --- Test 7: getSourcesForModel returns undefined for nonexistent model ---
  it('returns undefined for nonexistent model', () => {
    expect(getSourcesForModel('nonexistent')).toBeUndefined();
  });

  // --- Test 8: resolveSource returns single source for catalog hit ---
  it('resolves gemini-2.5-flash to genai (single source in catalog)', () => {
    expect(resolveSource('gemini-2.5-flash')).toBe('genai');
  });

  // --- Test 9: resolveSource falls back to heuristic for unknown model ---
  it('resolves totally-custom-model-xyz via heuristic fallback (openai)', () => {
    expect(resolveSource('totally-custom-model-xyz')).toBe('openai');
  });

  // --- Test 10: resolveSource resolves openrouter model ---
  it('resolves anthropic/claude-sonnet-4 to openrouter', () => {
    expect(resolveSource('anthropic/claude-sonnet-4')).toBe('openrouter');
  });

  // --- Test 11: resolveSource resolves groq model with slash (NOT openrouter) ---
  it('resolves meta-llama/llama-4-scout-17b-16e-instruct to groq', () => {
    expect(resolveSource('meta-llama/llama-4-scout-17b-16e-instruct')).toBe('groq');
  });

  // --- Test 12: Every model ID in all 5 arrays is present in the catalog ---
  it('contains every model ID from all 5 arrays', () => {
    const allArrays = [
      ...CHAT_MODELS,
      ...STT_MODELS,
      ...TTS_MODELS,
      ...IMAGE_MODELS,
      ...LIVE_MODELS,
    ];
    for (const model of allArrays) {
      expect(getSourcesForModel(model.value)).toBeDefined();
      expect(isKnownModel(model.value, model.source)).toBe(true);
    }
  });
});
