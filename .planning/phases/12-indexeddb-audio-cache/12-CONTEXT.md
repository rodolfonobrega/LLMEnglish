# Phase 12: IndexedDB Audio Cache - Context

**Gathered:** 2026-04-08
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — no discuss needed)

<domain>
## Phase Boundary

TTS responses are cached locally — repeated text produces instant audio without network round-trips. Build an IndexedDB-backed audio cache module in `src/services/audioCache.ts`.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

Success criteria:
1. Replaying the same TTS text returns cached audio instantly without a proxy request
2. Cache stores native Blobs (no base64 encoding) and keys on text hash + voice + model
3. When cache exceeds 50MB, oldest entries are evicted automatically with no user-facing error
4. The cache module lives in `src/services/audioCache.ts` with no modifications to storage.ts or supabase/storage.ts
5. A write failure (quota exceeded, IndexedDB unavailable) logs a warning and continues — TTS still works

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.
