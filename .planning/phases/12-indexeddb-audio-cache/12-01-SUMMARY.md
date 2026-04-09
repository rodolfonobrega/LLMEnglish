---
phase: 12-indexeddb-audio-cache
plan: 01
subsystem: infra
tags: [indexeddb, idb, audio-cache, tts, sha-256, lru-eviction]

requires: []
provides:
  - "IndexedDB-backed audio cache module (audioCache.ts) with SHA-256 keying and LRU eviction"
  - "Cache-first TTS integration in textToSpeech() reducing latency for repeated text"
  - "fake-indexeddb polyfill in test setup for IndexedDB tests in jsdom"
affects: [tts, audio, caching, performance]

tech-stack:
  added: [idb@8, fake-indexeddb]
  patterns: [indexeddb-cache, lru-eviction, sha-256-cache-key, fire-and-forget-write]

key-files:
  created:
    - src/services/audioCache.ts
    - src/services/audioCache.test.ts
  modified:
    - src/services/openai.ts
    - src/test/setup.ts

key-decisions:
  - "Used @vitest-environment node directive for audioCache tests to avoid jsdom Blob serialization issues"
  - "Wrapped base64ToBlob in try/catch in cache write path to handle non-base64 proxy responses gracefully"
  - "Only cache primary TTS path, not fallback -- avoids caching lower-quality audio"

patterns-established:
  - "Cache-first lookup: check IndexedDB before network, store on miss, fire-and-forget write"
  - "SHA-256 cache key from composite string: source:model:voice:text"
  - "LRU eviction via lastAccessedAt timestamp, 50MB threshold, evict to 80%"

requirements-completed: [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06]

duration: 30min
completed: 2026-04-08
---

# Phase 12 Plan 01: IndexedDB Audio Cache Summary

**SHA-256 keyed IndexedDB audio cache with 50MB LRU eviction, integrated into textToSpeech() for instant replay of cached TTS audio**

## Performance

- **Duration:** 30 min
- **Started:** 2026-04-08T14:46:14Z
- **Completed:** 2026-04-08T15:13:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Built standalone IndexedDB audio cache module with idb@8, SHA-256 composite keys, and automatic LRU eviction at 50MB
- Integrated cache-first lookup into textToSpeech() -- repeated TTS text returns cached audio instantly with no proxy request
- Full test suite passes (51 tests across 7 files) with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 0: Install dependencies and test setup** - `87c8c6c` (chore)
2. **Task 1: Build audioCache.ts module with tests** - `8fef3c1` (feat)
3. **Task 2: Integrate cache-first into textToSpeech()** - `d4c0fd1` (feat)

## Files Created/Modified
- `src/services/audioCache.ts` - IndexedDB audio cache with get/set/clear/getSize, SHA-256 keys, LRU eviction
- `src/services/audioCache.test.ts` - 6 unit tests covering all AC requirements (node environment)
- `src/services/openai.ts` - Cache-first integration in textToSpeech() with graceful error handling
- `src/test/setup.ts` - Added fake-indexeddb/auto polyfill for IndexedDB in jsdom tests

## Decisions Made
- Used `@vitest-environment node` for audioCache tests because jsdom's Blob implementation doesn't serialize correctly through fake-indexeddb's structured clone -- in production browsers, IndexedDB handles Blob storage natively
- Wrapped `base64ToBlob()` in try/catch in the cache write path because existing tests mock the proxy with non-base64 strings -- this also protects against malformed proxy responses in production
- Only the primary TTS path is cached; fallback TTS responses are not cached to avoid storing lower-quality audio

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wrapped base64ToBlob in try/catch for cache write path**
- **Found during:** Task 2 (textToSpeech integration)
- **Issue:** `base64ToBlob()` throws InvalidCharacterError when proxy returns non-base64 string, crashing before the fire-and-forget `.catch()` could handle it
- **Fix:** Wrapped the entire cache-write block (including base64ToBlob conversion) in try/catch
- **Files modified:** src/services/openai.ts
- **Verification:** All 12 openai.test.ts tests pass including "normalizes invalid OpenAI TTS voices"
- **Committed in:** d4c0fd1 (Task 2 commit)

**2. [Rule 3 - Blocking] Used @vitest-environment node for audioCache tests**
- **Found during:** Task 1 (test creation)
- **Issue:** jsdom's Blob constructor produces objects that don't survive fake-indexeddb's structured clone, causing `toBeInstanceOf(Blob)` to fail
- **Fix:** Added `@vitest-environment node` directive to test file so Node's native Blob is used
- **Files modified:** src/services/audioCache.test.ts
- **Verification:** All 6 audioCache tests pass

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness and test infrastructure. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audio cache module complete and tested, ready for integration by any TTS consumer
- Cache is transparent to useTTS.ts -- no hook changes needed
- Potential future enhancement: expose cache size/stats in settings UI

## Self-Check: PASSED

All files verified: src/services/audioCache.ts, src/services/audioCache.test.ts, src/services/openai.ts, src/test/setup.ts
All commits verified: 87c8c6c, 8fef3c1, d4c0fd1

---
*Phase: 12-indexeddb-audio-cache*
*Completed: 2026-04-08*
