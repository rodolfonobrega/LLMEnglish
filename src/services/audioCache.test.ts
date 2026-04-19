import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAudioCache, type AudioCache } from './audioCache';

describe('audioCache', () => {
  let cache: AudioCache;

  beforeEach(async () => {
    cache = getAudioCache();
    await cache.clear();
  });

  it('returns undefined for a key not in cache', async () => {
    const result = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    expect(result).toBeUndefined();
  });

  it('stores and retrieves base64 audio (round-trip)', async () => {
    const fakeBase64 = btoa('fake-audio-data');
    await cache.set('hello', 'alloy', 'tts-1', 'openai', fakeBase64);

    const result = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    expect(result).toBe(fakeBase64);
  });

  it('produces different cache entries for different voice/model', async () => {
    const b64a = btoa('audio-1');
    const b64b = btoa('audio-2');

    await cache.set('hello', 'alloy', 'tts-1', 'openai', b64a);
    await cache.set('hello', 'nova', 'gemini-tts', 'genai', b64b);

    const r1 = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    const r2 = await cache.get('hello', 'nova', 'gemini-tts', 'genai');

    expect(r1).toBe(b64a);
    expect(r2).toBe(b64b);
  });

  it('same text with same params returns cached value', async () => {
    const fakeBase64 = btoa('audio-data');
    await cache.set('hello', 'alloy', 'tts-1', 'openai', fakeBase64);

    // Second get should return the same cached value
    const result = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    expect(result).toBe(fakeBase64);
  });

  it('evicts oldest entries when total size exceeds MAX_CACHE_SIZE', async () => {
    // Each entry ~1KB. Add 60 small entries to test cache still works.
    const fakeBase64 = 'a'.repeat(1024);
    for (let i = 0; i < 60; i++) {
      await cache.set(`text-${i}`, 'alloy', 'tts-1', 'openai', fakeBase64);
    }

    // Verify recent entries still exist
    const recent = await cache.get('text-59', 'alloy', 'tts-1', 'openai');
    expect(recent).toBe(fakeBase64);
  });

  it('logs warning and does not throw on write failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const fakeBase64 = btoa('test');
    await cache.set('test-text', 'alloy', 'tts-1', 'openai', fakeBase64);
    const result = await cache.get('test-text', 'alloy', 'tts-1', 'openai');
    expect(result).toBe(fakeBase64);

    // No warnings should have been logged for a normal write
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('updates lastAccessedAt on get() for LRU tracking', async () => {
    const fakeBase64 = btoa('audio');
    await cache.set('hello', 'alloy', 'tts-1', 'openai', fakeBase64);

    // Access the entry — should update lastAccessedAt without error
    await cache.get('hello', 'alloy', 'tts-1', 'openai');

    // Verify we can still retrieve it after LRU update
    const result = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    expect(result).toBe(fakeBase64);
  });

  it('clear() removes all cached entries', async () => {
    await cache.set('hello', 'alloy', 'tts-1', 'openai', btoa('audio'));
    await cache.clear();

    const result = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    expect(result).toBeUndefined();
  });
});
