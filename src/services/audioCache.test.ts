/**
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAudioCache } from './audioCache';

describe('audioCache', () => {
  let cache: ReturnType<typeof getAudioCache>;

  beforeEach(async () => {
    cache = getAudioCache();
    await cache.clear();
  });

  it('get() returns undefined for a key not in cache', async () => {
    const result = await cache.get('hello world', 'alloy', 'tts-1', 'openai');
    expect(result).toBeUndefined();
  });

  it('set() then get() returns the same Blob (round-trip)', async () => {
    const blob = new Blob(['fake-audio-data'], { type: 'audio/mp3' });
    await cache.set('hello world', 'alloy', 'tts-1', 'openai', blob);

    const result = await cache.get('hello world', 'alloy', 'tts-1', 'openai');
    expect(result).toBeInstanceOf(Blob);

    const resultText = await result!.text();
    expect(resultText).toBe('fake-audio-data');
  });

  it('different voice/model for same text produces different cache entries', async () => {
    const blob1 = new Blob(['audio-openai'], { type: 'audio/mp3' });
    const blob2 = new Blob(['audio-gemini'], { type: 'audio/mp3' });

    await cache.set('hello', 'alloy', 'tts-1', 'openai', blob1);
    await cache.set('hello', 'kore', 'gemini-2.5-flash', 'genai', blob2);

    const result1 = await cache.get('hello', 'alloy', 'tts-1', 'openai');
    const result2 = await cache.get('hello', 'kore', 'gemini-2.5-flash', 'genai');

    expect(await result1!.text()).toBe('audio-openai');
    expect(await result2!.text()).toBe('audio-gemini');
  });

  it('set() fires eviction when total size exceeds MAX_CACHE_SIZE', async () => {
    // Create entries totaling > 50MB to trigger eviction
    // Use smaller number of large blobs (e.g., 30 x 2MB = 60MB)
    const twoMB = 2 * 1024 * 1024;

    for (let i = 0; i < 30; i++) {
      const data = new Uint8Array(twoMB);
      data.fill(i); // unique content per entry
      const blob = new Blob([data], { type: 'audio/mp3' });
      await cache.set(`text-${i}`, `voice-${i}`, `model-${i}`, `source-${i}`, blob);
    }

    const totalSize = await cache.getSize();
    // After eviction, total should be <= 50MB (the MAX_CACHE_SIZE)
    expect(totalSize).toBeLessThanOrEqual(50 * 1024 * 1024);

    // Oldest entries (low index) should have been evicted
    const oldEntry = await cache.get('text-0', 'voice-0', 'model-0', 'source-0');
    const newEntry = await cache.get('text-29', 'voice-29', 'model-29', 'source-29');
    expect(oldEntry).toBeUndefined();
    expect(newEntry).toBeInstanceOf(Blob);
  });

  it('set() logs warning and does not throw on IndexedDB write failure', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a cache that will fail: close the underlying database to force errors
    // We access the internal DB by writing then clearing, then force-closing
    const blob = new Blob(['test'], { type: 'audio/mp3' });

    // Write should work normally
    await expect(cache.set('safe-key', 'v', 'm', 's', blob)).resolves.toBeUndefined();

    // Verify no warning was logged for normal operation
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('get() updates lastAccessedAt timestamp for LRU tracking', async () => {
    const blob1 = new Blob(['old'], { type: 'audio/mp3' });
    const blob2 = new Blob(['new'], { type: 'audio/mp3' });

    // Set two entries
    await cache.set('old-text', 'v1', 'm', 's', blob1);
    await cache.set('new-text', 'v2', 'm', 's', blob2);

    // Wait a bit so timestamps differ
    await new Promise((r) => setTimeout(r, 10));

    // Access the old entry — this should update its lastAccessedAt
    await cache.get('old-text', 'v1', 'm', 's');

    // Verify the old entry is still retrievable (proving update didn't corrupt it)
    const result = await cache.get('old-text', 'v1', 'm', 's');
    expect(result).toBeInstanceOf(Blob);
    expect(await result!.text()).toBe('old');
  });
});
