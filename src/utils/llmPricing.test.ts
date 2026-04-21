import { describe, expect, it } from 'vitest';

import { estimateCostUsd } from './llmPricing';

describe('llmPricing.estimateCostUsd', () => {
  it('returns a positive cost for a known genai chat model', () => {
    const cost = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-2.5-flash',
      operation: 'chat',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    expect(cost).toBeDefined();
    expect(cost).toBeGreaterThan(0);
  });

  it('prefers explicit pricing over provider fallback', () => {
    const flash = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-2.5-flash',
      operation: 'chat',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    const pro = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-2.5-pro',
      operation: 'chat',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    expect(pro).toBeGreaterThan(flash!);
  });

  it('uses perImageUsd for image operations', () => {
    const cost = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-3.1-flash-image-preview',
      operation: 'image',
    });
    expect(cost).toBe(0.04);
  });

  it('uses perSecondUsd for tts/live operations', () => {
    const tts = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-2.5-flash-preview-tts',
      operation: 'tts',
      secondsUsed: 10,
    });
    expect(tts).toBeCloseTo(0.0016);
    const live = estimateCostUsd({
      provider: 'genai',
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      operation: 'live',
      secondsUsed: 60,
    });
    expect(live).toBeCloseTo(0.12);
  });

  it('falls back to provider pricing when the model is unknown', () => {
    const cost = estimateCostUsd({
      provider: 'openai',
      model: 'gpt-4o-unknown-variant',
      operation: 'chat',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    expect(cost).toBeGreaterThan(0);
  });

  it('returns undefined when nothing is known', () => {
    const cost = estimateCostUsd({
      // @ts-expect-error deliberately invalid source
      provider: 'unknown-provider',
      model: 'unknown-model',
      operation: 'chat',
      tokensIn: 1000,
      tokensOut: 1000,
    });
    expect(cost).toBeUndefined();
  });
});
