/**
 * IndexedDB-backed audio cache for TTS results.
 *
 * Stores native Blobs keyed by SHA-256 hash of source:model:voice:text.
 * Implements LRU eviction when total size exceeds 50MB.
 * Write failures are caught and logged — never propagated.
 */

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';

const DB_NAME = 'speaktts-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-cache';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
const EVICTION_TARGET_RATIO = 0.8; // Evict to 80% of max

interface AudioCacheEntry {
  blob: Blob;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
}

interface AudioCacheDB extends DBSchema {
  [STORE_NAME]: {
    key: string;
    value: AudioCacheEntry;
  };
}

let dbPromise: Promise<IDBPDatabase<AudioCacheDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AudioCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudioCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase<AudioCacheDB>) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise!;
}

async function computeCacheKey(
  text: string,
  voice: string,
  model: string,
  source: string,
): Promise<string> {
  const input = `${source}:${model}:${voice}:${text}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function getTotalCacheSize(db: IDBPDatabase<AudioCacheDB>): Promise<number> {
  let total = 0;
  const tx = db.transaction(STORE_NAME, 'readonly');
  for await (const cursor of tx.store) {
    total += cursor.value.size;
  }
  return total;
}

async function evictIfNeeded(db: IDBPDatabase<AudioCacheDB>): Promise<void> {
  try {
    const totalSize = await getTotalCacheSize(db);
    if (totalSize <= MAX_CACHE_SIZE) return;

    const targetSize = MAX_CACHE_SIZE * EVICTION_TARGET_RATIO;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    let freed = 0;

    // Collect all entries sorted by lastAccessedAt ascending (oldest first)
    const entries: Array<{ key: string; size: number; lastAccessedAt: number }> = [];
    for await (const cursor of tx.store) {
      entries.push({
        key: cursor.key as string,
        size: cursor.value.size,
        lastAccessedAt: cursor.value.lastAccessedAt,
      });
    }

    entries.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    for (const entry of entries) {
      if (totalSize - freed <= targetSize) break;
      freed += entry.size;
      await tx.store.delete(entry.key);
    }

    await tx.done;
  } catch (err) {
    console.warn('Audio cache eviction failed:', err);
  }
}

export interface AudioCache {
  get(text: string, voice: string, model: string, source: string): Promise<Blob | undefined>;
  set(text: string, voice: string, model: string, source: string, blob: Blob): Promise<void>;
  clear(): Promise<void>;
  getSize(): Promise<number>;
}

export function getAudioCache(): AudioCache {
  return {
    async get(text, voice, model, source): Promise<Blob | undefined> {
      try {
        const db = await getDB();
        const key = await computeCacheKey(text, voice, model, source);
        const entry = await db.get(STORE_NAME, key);
        if (!entry) return undefined;

        // Update lastAccessedAt for LRU tracking (fire-and-forget)
        entry.lastAccessedAt = Date.now();
        await db.put(STORE_NAME, entry, key).catch(() => {});

        return entry.blob;
      } catch {
        return undefined;
      }
    },

    async set(text, voice, model, source, blob): Promise<void> {
      try {
        const db = await getDB();
        const key = await computeCacheKey(text, voice, model, source);
        const now = Date.now();
        await db.put(STORE_NAME, {
          blob,
          size: blob.size,
          createdAt: now,
          lastAccessedAt: now,
        }, key);

        // Fire-and-forget eviction check
        evictIfNeeded(db).catch(() => {});
      } catch (err) {
        console.warn('Audio cache write failed:', err);
      }
    },

    async clear(): Promise<void> {
      try {
        const db = await getDB();
        await db.clear(STORE_NAME);
      } catch (err) {
        console.warn('Audio cache clear failed:', err);
      }
    },

    async getSize(): Promise<number> {
      try {
        const db = await getDB();
        return getTotalCacheSize(db);
      } catch {
        return 0;
      }
    },
  };
}
