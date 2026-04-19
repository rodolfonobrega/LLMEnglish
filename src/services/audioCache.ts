/**
 * IndexedDB-backed audio cache for TTS responses.
 *
 * Caches base64 audio data keyed by SHA-256 hash of source:model:voice:text.
 * Uses LRU eviction when total cache size exceeds 50MB.
 * Write failures are caught and logged — never throw.
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AudioCacheDB extends DBSchema {
  'audio-cache': {
    key: string;
    value: {
      key: string;
      data: string; // base64 audio
      size: number; // approximate byte size of the base64 string
      createdAt: number;
      lastAccessedAt: number;
    };
    indexes: {
      'by-last-accessed': number;
    };
  };
}

const DB_NAME = 'speaklab-audio-cache';
const DB_VERSION = 1;
const STORE = 'audio-cache';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB
const EVICT_TO_RATIO = 0.8; // Evict down to 80% of max

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase<AudioCacheDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AudioCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudioCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('by-last-accessed', 'lastAccessedAt');
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

async function computeKey(
  text: string,
  voice: string,
  model: string,
  source: string,
): Promise<string> {
  const raw = `${source}:${model}:${voice}:${text}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Eviction
// ---------------------------------------------------------------------------

async function evictIfNeeded(db: IDBPDatabase<AudioCacheDB>): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.store;

  let totalSize = 0;
  let cursor = await store.openCursor();
  while (cursor) {
    totalSize += cursor.value.size;
    cursor = await cursor.continue();
  }

  if (totalSize <= MAX_CACHE_SIZE) return;

  const targetSize = MAX_CACHE_SIZE * EVICT_TO_RATIO;

  // Evict oldest entries first (by lastAccessedAt index)
  const index = store.index('by-last-accessed');
  cursor = await index.openCursor();
  while (cursor && totalSize > targetSize) {
    totalSize -= cursor.value.size;
    await cursor.delete();
    cursor = await cursor.continue();
  }

  await tx.done;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AudioCache {
  /** Get cached base64 audio for the given text/voice/model/source combo. */
  get(
    text: string,
    voice: string,
    model: string,
    source: string,
  ): Promise<string | undefined>;
  /** Store base64 audio in cache. */
  set(
    text: string,
    voice: string,
    model: string,
    source: string,
    base64Audio: string,
  ): Promise<void>;
  /** Clear all cached entries. */
  clear(): Promise<void>;
}

let cacheInstance: AudioCache | null = null;

export function getAudioCache(): AudioCache {
  if (!cacheInstance) {
    cacheInstance = {
      async get(text, voice, model, source) {
        try {
          const db = await getDB();
          const key = await computeKey(text, voice, model, source);
          const entry = await db.get(STORE, key);
          if (!entry) return undefined;
          // Update lastAccessedAt for LRU tracking
          entry.lastAccessedAt = Date.now();
          await db.put(STORE, entry);
          return entry.data;
        } catch {
          return undefined;
        }
      },

      async set(text, voice, model, source, base64Audio) {
        try {
          const db = await getDB();
          const key = await computeKey(text, voice, model, source);
          const now = Date.now();
          await db.put(STORE, {
            key,
            data: base64Audio,
            size: base64Audio.length,
            createdAt: now,
            lastAccessedAt: now,
          });
          await evictIfNeeded(db);
        } catch (err) {
          console.warn('Audio cache write failed:', err);
        }
      },

      async clear() {
        const db = await getDB();
        await db.clear(STORE);
      },
    };
  }
  return cacheInstance;
}
