# Phase 12: IndexedDB Audio Cache - Research

**Researched:** 2026-04-08
**Domain:** IndexedDB, TTS audio caching, `idb` library
**Confidence:** HIGH

## Summary

This phase adds a local audio cache backed by IndexedDB so that repeated TTS text produces instant audio without network round-trips. The TTS call chain is: `useTTS.speak()` -> `textToSpeech()` in `openai.ts` -> `proxyTTS()` in `aiProxy.ts` -> Supabase Edge Function. The proxy returns base64 audio, which `useTTS` converts via `base64ToAudioUrl()` -> `base64ToBlob()` -> `URL.createObjectURL()`.

The cache module (`audioCache.ts`) will intercept this chain: before calling the proxy, check IndexedDB for a cached Blob keyed by text hash + voice + model. On cache miss, proceed with the network call, then store the Blob in IndexedDB. The module uses `idb@8` for typed IndexedDB access and must handle quota errors gracefully (log warning, continue).

**Primary recommendation:** Use `idb@8.0.3` with a typed `DBSchema` for the audio cache store. Integrate at the `textToSpeech()` function in `openai.ts` -- the cache check happens before the proxy call, and the cache write happens after receiving the base64 response. Convert base64 to Blob before caching to avoid storing large base64 strings. The `useTTS` hook needs minimal changes since `textToSpeech` currently returns base64 -- the cache-aware version can return base64 from the stored Blob (via FileReader) or from the network.

## User Constraints (from CONTEXT.md)

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None -- infrastructure phase.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AC-01 | Cache TTS audio in IndexedDB keyed by text hash + voice + model | `idb@8` with DBSchema, SHA-256 or similar hash for text key |
| AC-02 | Store Blobs natively (no base64), use `idb@8` with DBSchema | IndexedDB natively supports Blob storage; `idb` DBSchema for typed access |
| AC-03 | Cache-first strategy: check IndexedDB before proxy request | Modify `textToSpeech()` in `openai.ts` to check cache first |
| AC-04 | Graceful quota error handling: log warning, continue | Wrap IndexedDB writes in try/catch, log via `console.warn` |
| AC-05 | Evict oldest entries when exceeding 50MB using LRU by access timestamp | Store `lastAccessed` timestamp, query by index for eviction |
| AC-06 | Isolated in `src/services/audioCache.ts`, no modifications to storage.ts or supabase/storage.ts | Standalone module with single integration point in `openai.ts` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | 8.0.3 | Typed IndexedDB wrapper | Tiny (~1.19kB brotli), Promise-based, full TypeScript support with DBSchema [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | 6.2.5 | IndexedDB mock for jsdom tests | Required for unit tests in Vitest/jsdom environment [VERIFIED: npm registry] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb` | Raw IndexedDB API | Raw API is callback-based (`IDBRequest`), verbose, error-prone; `idb` adds only 1.19kB |
| `idb` | `Dexie` | Dexie is larger (~12kB), more features than needed for single-store cache |
| `idb` | `localForage` | localForage abstracts over multiple backends but lacks TypeScript DBSchema generics |

**Installation:**
```bash
npm install idb
npm install -D fake-indexeddb
```

**Version verification:**
- `idb@8.0.3` -- verified via `npm view idb version` (2026-04-08)
- `fake-indexeddb@6.2.5` -- verified via `npm view fake-indexeddb version` (2026-04-08)

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── audioCache.ts          # NEW: IndexedDB audio cache module
│   ├── audioCache.test.ts     # NEW: Tests for cache module
│   ├── openai.ts              # MODIFY: Add cache check to textToSpeech()
│   └── ...
├── test/
│   └── setup.ts               # MODIFY: Add fake-indexeddb import
└── ...
```

### Pattern 1: idb DBSchema for Typed Store Access
**What:** Define a typed schema for the audio cache IndexedDB database.
**When to use:** This is the single store needed for this phase.
**Example:**
```typescript
// Source: idb README TypeScript section [VERIFIED: npm pack README]
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface AudioCacheDB extends DBSchema {
  'audio-cache': {
    key: string; // hash of text + voice + model
    value: {
      blob: Blob;
      text: string;
      voice: string;
      model: string;
      source: string;
      mimeType: string;
      size: number;
      createdAt: number; // timestamp
      lastAccessedAt: number; // timestamp for LRU eviction
    };
  };
}
```

### Pattern 2: Singleton DB Promise
**What:** Open the database once and reuse the promise across calls.
**When to use:** Throughout the audioCache module.
**Example:**
```typescript
// Source: idb README keyval example [VERIFIED: npm pack README]
const dbPromise = openDB<AudioCacheDB>('speaktts-cache', 1, {
  upgrade(db) {
    db.createObjectStore('audio-cache');
  },
});
```

### Pattern 3: Cache-First Lookup
**What:** Check cache before making network request; store result on miss.
**When to use:** In `textToSpeech()` in `openai.ts`.
**Example:**
```typescript
// The integration point in openai.ts
export async function textToSpeech(text: string, voiceOverride?: string): Promise<string> {
  const config = getRuntimeModelConfig();
  const source = config.ttsSource;
  const model = config.ttsModel;
  const voice = normalizeTtsVoice(source, model, voiceOverride || config.ttsVoice);

  // Cache-first: check IndexedDB
  const cached = await audioCache.get(text, voice, model, source);
  if (cached) {
    // Convert Blob back to base64 for backward compatibility with useTTS
    return blobToBase64(cached);
  }

  // Network call (existing code path)
  try {
    const base64 = await proxyTTS({ source, model, voice, text });
    // Store in cache (fire-and-forget with error handling)
    audioCache.set(text, voice, model, source, base64ToBlob(base64, mimeType)).catch(err => {
      console.warn('Audio cache write failed:', err);
    });
    return base64;
  } catch (primaryError) {
    // ... existing fallback logic unchanged
  }
}
```

### Anti-Patterns to Avoid
- **Storing base64 strings instead of Blobs:** Base64 is ~33% larger than binary. IndexedDB natively supports Blob storage, which is more space-efficient. [CITED: AC-02 success criteria]
- **Awaiting cache writes in the TTS call path:** Cache writes should be fire-and-forget (with `.catch()` for error logging). The user should never wait for a cache write. [CITED: AC-04 success criteria]
- **Modifying `useTTS.ts` to handle Blobs:** The hook expects a base64 string from `textToSpeech()`. Convert cached Blobs back to base64 in the cache module, not in the hook. This keeps the change isolated.
- **Putting cache logic in `useTTS.ts`:** The cache should live in `audioCache.ts` and integrate at the `textToSpeech()` level in `openai.ts`, not in the hook.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB wrapper | Custom IndexedDB helper with request/event handling | `idb@8` | Promise-based, typed, handles transaction lifetime, ~1.19kB |
| Hash function for cache keys | Custom hash implementation | `crypto.subtle.digest('SHA-256', ...)` | Web Crypto API is available in all modern browsers, no dependencies |
| IndexedDB test mock | Custom IDB mock | `fake-indexeddb` | battle-tested, works with jsdom, used by idb's own tests |
| Blob <-> base64 conversion | New conversion utilities | Existing `base64ToBlob()` in `src/utils/audio.ts` | Already exists and is used by `useTTS` via `base64ToAudioUrl()` |

**Key insight:** The project already has `base64ToBlob()` in `src/utils/audio.ts`. The cache module needs to convert Blobs back to base64 for the return path. A small `blobToBase64()` helper (using FileReader) should live in the cache module or audio utils -- not in storage.ts (which must not be modified per AC-06).

## Common Pitfalls

### Pitfall 1: IndexedDB Transaction Auto-Close
**What goes wrong:** Awaiting something between transaction start and completion causes the transaction to auto-close, making subsequent operations fail.
**Why it happens:** IndexedDB transactions auto-commit when the event loop is empty. Awaiting a fetch or timer lets the transaction close.
**How to avoid:** Do all reads/writes within a single synchronous-ish block, then `await tx.done`. The `idb` library helps but does not eliminate this concern.
**Warning signs:** `TransactionInactiveError` in console.

### Pitfall 2: jsdom Has No IndexedDB
**What goes wrong:** Tests fail because `window.indexedDB` is undefined in jsdom.
**Why it happens:** jsdom does not implement IndexedDB natively.
**How to avoid:** Import `fake-indexeddb` in the test setup file (`src/test/setup.ts`) to polyfill `indexedDB` and `IDBKeyRange` globals.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'open')` in tests.

### Pitfall 3: Blob Size Tracking for Eviction
**What goes wrong:** Eviction logic does not know the actual total cache size, leading to under- or over-eviction.
**Why it happens:** IndexedDB does not provide a built-in "total store size" API.
**How to avoid:** Track size per entry (using `blob.size`) in the stored record. Compute total size by summing all entries during eviction checks. Use a threshold-based approach: check size periodically (e.g., on every write) rather than on every read.
**Warning signs:** Cache grows unbounded past 50MB.

### Pitfall 4: Cache Key Collision
**What goes wrong:** Same text with different voices/models returns wrong cached audio.
**Why it happens:** Keying only on text hash without voice/model.
**How to avoid:** Include `text + voice + model + source` in the hash input. The requirements explicitly state "keyed by text hash + voice + model" (AC-01).
**Warning signs:** Wrong voice plays for cached text.

### Pitfall 5: Memory Leaks from Object URLs
**What goes wrong:** `URL.createObjectURL()` creates a URL that holds a reference to the Blob until `URL.revokeObjectURL()` is called.
**Why it happens:** The existing code in `useTTS.ts` calls `base64ToAudioUrl()` which creates object URLs but never revokes them.
**How to avoid:** This is a pre-existing issue, not introduced by this phase. The cache should return Blobs, and the caller handles URL lifecycle. Do not fix this as part of AC requirements -- it is out of scope.
**Warning signs:** Not applicable to this phase.

## Code Examples

### Cache Key Generation (Web Crypto API)
```typescript
// Uses built-in Web Crypto API - no dependencies
async function computeCacheKey(text: string, voice: string, model: string, source: string): Promise<string> {
  const input = `${source}:${model}:${voice}:${text}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### LRU Eviction Query Pattern
```typescript
// Source: idb README patterns [VERIFIED: npm pack README]
async function evictIfNeeded(db: IDBPDatabase<AudioCacheDB>): Promise<void> {
  const totalSize = await getTotalCacheSize(db);
  if (totalSize <= MAX_CACHE_SIZE) return;

  const tx = db.transaction('audio-cache', 'readwrite');
  const store = tx.store;
  let freed = 0;

  // Iterate from oldest access time
  for await (const cursor of store) {
    if (totalSize - freed <= MAX_CACHE_SIZE * 0.8) break; // Evict to 80% of limit
    freed += cursor.value.size;
    cursor.delete();
  }
  await tx.done;
}
```

### Blob to Base64 Conversion (for return path)
```typescript
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Remove "data:audio/xxx;base64," prefix
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

### Test Setup Addition for fake-indexeddb
```typescript
// In src/test/setup.ts, add:
import 'fake-indexeddb/auto';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw IndexedDB with callbacks | `idb@8` with Promise-based API + DBSchema types | idb@7+ (2023) | Much cleaner code, full type safety |
| Base64 in localStorage | Blobs in IndexedDB | N/A (project-specific) | 33% size reduction, native binary storage |
| Service Worker Cache API | Application-level IndexedDB | N/A (project decision) | Explicitly deferred per REQUIREMENTS.md future section |

**Deprecated/outdated:**
- `idb-keyval`: Sub-library of idb for simple keyval stores. Not needed since we need indexes for LRU eviction. [ASSUMED]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `fake-indexeddb` works with `idb@8` in jsdom/Vitest | Validation Architecture | Tests may need alternative mock approach |
| A2 | `crypto.subtle.digest` is available in Vitest/jsdom test environment | Code Examples | Hash function would need a fallback or test-only alternative |
| A3 | IndexedDB Blob storage does not count against localStorage 5MB limit | Architecture | Cache size limit may need adjustment |

**Risk mitigation:** A1 and A2 are test infrastructure concerns that can be resolved during Wave 0. A3 is a known fact -- IndexedDB has its own quota separate from localStorage -- but flagged for completeness.

## Open Questions

1. **Should the cache return base64 or Blob?**
   - What we know: `useTTS.ts` calls `textToSpeech()` and expects a base64 string, then converts to Blob via `base64ToAudioUrl()`.
   - What's unclear: Whether to keep `textToSpeech()` returning base64 (with Blob-to-base64 conversion in cache) or refactor to return Blob.
   - Recommendation: Keep returning base64 from `textToSpeech()` to minimize changes. The cache stores Blobs internally and converts back to base64 on cache hit. This preserves backward compatibility.

2. **When should eviction run?**
   - What we know: AC-05 requires eviction when exceeding 50MB.
   - What's unclear: Should eviction run synchronously before every write, or asynchronously after?
   - Recommendation: Run eviction asynchronously after each write (fire-and-forget). This prevents blocking the TTS response. Check total size after each cache write and evict if over threshold.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| IndexedDB | Audio cache | N/A (browser) | Built-in | Graceful degradation (no caching) |
| Web Crypto API | Cache key hashing | N/A (browser) | Built-in | Simple string hash fallback |
| Node.js | Build/dev | Available | 20.20.2 | -- |
| npm | Package install | Available | -- | -- |
| jsdom | Test environment | Available (Vitest) | 28 | -- |
| fake-indexeddb | Test mock for IndexedDB | Not installed | 6.2.5 (latest) | Install as devDependency |
| idb | IndexedDB wrapper | Not installed | 8.0.3 (latest) | Install as dependency |

**Missing dependencies with no fallback:**
- `idb@8.0.3` -- must install as production dependency
- `fake-indexeddb@6.2.5` -- must install as dev dependency for tests

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/services/audioCache.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AC-01 | Cache stores and retrieves by text+voice+model key | unit | `npx vitest run src/services/audioCache.test.ts` | No -- Wave 0 |
| AC-02 | Cache stores Blobs, not base64 strings | unit | `npx vitest run src/services/audioCache.test.ts` | No -- Wave 0 |
| AC-03 | Cache-first: cached audio returned without network call | unit | `npx vitest run src/services/audioCache.test.ts` | No -- Wave 0 |
| AC-04 | Write failure logs warning and continues | unit | `npx vitest run src/services/audioCache.test.ts` | No -- Wave 0 |
| AC-05 | Eviction removes oldest entries when over 50MB | unit | `npx vitest run src/services/audioCache.test.ts` | No -- Wave 0 |
| AC-06 | Module isolation (no storage.ts/supabase changes) | manual | Verify via git diff | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/audioCache.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/audioCache.test.ts` -- covers AC-01 through AC-05
- [ ] `src/test/setup.ts` -- add `import 'fake-indexeddb/auto'`
- [ ] Package install: `npm install idb && npm install -D fake-indexeddb`

## Security Domain

> This phase adds a client-side cache for TTS audio. The security surface is minimal.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Cache key is SHA-256 hash (no injection risk); text/voice/model are strings from config |
| V6 Cryptography | no | SHA-256 used for cache keying only (not security), via Web Crypto API |
| V8 Data Protection | yes | Cache stores audio Blobs locally in IndexedDB; no PII in cache keys; cache is ephemeral |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache poisoning (stale/wrong audio) | Tampering | Cache key includes text+voice+model+source hash; no external write path |
| Storage exhaustion | Denial of Service | 50MB eviction limit with LRU; write failures are graceful |

## Sources

### Primary (HIGH confidence)
- `idb@8.0.3` README -- extracted via `npm pack` and read directly. Verified DBSchema API, openDB signature, transaction patterns, TypeScript generics.
- npm registry -- verified `idb@8.0.3` (latest), `fake-indexeddb@6.2.5` (latest)
- Codebase analysis -- `src/services/openai.ts`, `src/hooks/useTTS.ts`, `src/services/supabase/aiProxy.ts`, `src/utils/audio.ts`, `src/types/settings.ts`

### Secondary (MEDIUM confidence)
- Web Crypto API `crypto.subtle.digest` -- assumed available in modern browsers and jsdom (with polyfill) [ASSUMED]

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `idb@8` verified via npm pack README, version confirmed via npm registry
- Architecture: HIGH - TTS call chain traced through 4 files, integration point is clear (`textToSpeech()` in `openai.ts`)
- Pitfalls: HIGH - IndexedDB transaction lifetime and jsdom limitations are well-documented
- Testing: MEDIUM - `fake-indexeddb` compatibility with `idb@8` in jsdom needs verification during Wave 0

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable libraries, no fast-moving dependencies)
