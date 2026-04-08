# Roadmap: SpeakLab

## Milestones

- ✅ **v1.0 Hardening & Praticar Redesign** — Phases 1-6 (shipped 2026-04-02)
- ✅ **v1.1 Dead Code & Facade Cleanup** — Phase 7 (shipped 2026-04-07)
- **v1.2 Audio & Proxy Cleanup** — Phases 8-12 (current)

## Phases

<details>
<summary>✅ v1.0 Hardening & Praticar Redesign (Phases 1-6) — SHIPPED 2026-04-02</summary>

- [x] Phase 1: Dev Mode Routing (1/1 plans)
- [x] Phase 2: Error Boundaries (1/1 plans)
- [x] Phase 3: Code Splitting (1/1 plans)
- [x] Phase 4: Secure Storage (2/2 plans)
- [x] Phase 5: Storage Consolidation (2/2 plans)
- [x] Phase 6: Praticar Redesign (1/1 plans)

</details>

<details>
<summary>✅ v1.1 Dead Code & Facade Cleanup (Phase 7) — SHIPPED 2026-04-07</summary>

- [x] Phase 7: Dead Code & Facade Cleanup (2/2 plans)

</details>

### v1.2 Audio & Proxy Cleanup (Phases 8-12)

- [ ] **Phase 8: Dead Code & Config Cleanup** — Remove dead Groq proxy and stale coverage references
- [ ] **Phase 9: Model Catalog** — Replace fragile detectSource() with explicit model lookup
- [ ] **Phase 10: Edge Function Modularization** — Split ai-proxy monolith into focused modules
- [ ] **Phase 11: AudioWorklet Migration** — Replace deprecated ScriptProcessorNode in Gemini Live
- [ ] **Phase 12: IndexedDB Audio Cache** — Build TTS response cache from scratch

## Phase Details

### Phase 8: Dead Code & Config Cleanup
**Goal**: Build environment is free of dead code and stale references — clean foundation for subsequent phases
**Depends on**: Nothing (first phase of v1.2)
**Requirements**: DC-01, DC-02
**Success Criteria** (what must be TRUE):
  1. `vite.config.ts` contains no `/api/groq` proxy block — grep confirms zero hits
  2. Coverage config references no deleted files — `vitest run --coverage` succeeds without warnings about missing files
  3. All existing routes and features work identically after removal
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — Remove dead /api/groq proxy and stale coverage references

### Phase 9: Model Catalog
**Goal**: Model-to-source resolution uses an explicit catalog instead of fragile prefix heuristics, with graceful handling of unknown models
**Depends on**: Phase 8
**Requirements**: MC-01, MC-02, MC-03, MC-04
**Success Criteria** (what must be TRUE):
  1. All 105 models across 5 ModelOption arrays in settings.ts resolve to the correct Source via catalog lookup
  2. Model IDs not in the catalog still work via heuristic fallback — no regression for user-saved custom models
  3. Settings UI shows a warning badge when a selected model+source combination is not in the catalog
  4. Existing chat, TTS, and STT call chains produce identical results for all known models
**Plans**: 2 plans

Plans:
- [x] 09-01-PLAN.md — Build model catalog module and wire openai.ts to catalog-first resolution
- [x] 09-02-PLAN.md — Add warning badge to Settings UI for unknown model+source combos

### Phase 10: Edge Function Modularization
**Goal**: The ai-proxy Edge Function is maintainable — thin router delegating to focused provider modules with structured logging
**Depends on**: Phase 9
**Requirements**: EF-01, EF-02, EF-03, EF-04, EF-05
**Success Criteria** (what must be TRUE):
  1. `ai-proxy/index.ts` is under 120 lines — a thin router that delegates to provider modules
  2. All provider logic lives in dedicated modules (crypto.ts, api-keys.ts, providers/openai.ts, providers/gemini.ts, providers/groq.ts, providers/openrouter.ts, providers/vertex.ts, utils.ts)
  3. Local testing via `supabase functions serve` passes for all action types (chat, TTS, STT, image) with identical request/response shapes
  4. Every request logs a structured entry with request ID, provider, action, and outcome
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — Remove dead /api/groq proxy and stale coverage references

### Phase 11: AudioWorklet Migration
**Goal**: Gemini Live microphone input uses AudioWorkletNode — off-main-thread processing with no deprecated API usage
**Depends on**: Phase 10
**Requirements**: AW-01, AW-02, AW-03, AW-04, AW-05, AW-06
**Success Criteria** (what must be TRUE):
  1. `geminiLive.ts` contains zero references to ScriptProcessorNode — only AudioWorkletNode for mic input
  2. A live roleplay session sends and receives audio without glitches or WebSocket message flooding
  3. The PCM processor file exists at `public/worklets/pcm-processor.js` as plain JS with no imports/exports
  4. Audio output path (AudioBufferSourceNode scheduling) remains completely unchanged
**Plans**: 1 plan

Plans:
- [ ] 08-01-PLAN.md — Remove dead /api/groq proxy and stale coverage references

### Phase 12: IndexedDB Audio Cache
**Goal**: TTS responses are cached locally — repeated text produces instant audio without network round-trips
**Depends on**: Phase 11
**Requirements**: AC-01, AC-02, AC-03, AC-04, AC-05, AC-06
**Success Criteria** (what must be TRUE):
  1. Replaying the same TTS text returns cached audio instantly without a proxy request
  2. Cache stores native Blobs (no base64 encoding) and keys on text hash + voice + model
  3. When cache exceeds 50MB, oldest entries are evicted automatically with no user-facing error
  4. The cache module lives in `src/services/audioCache.ts` with no modifications to storage.ts or supabase/storage.ts
  5. A write failure (quota exceeded, IndexedDB unavailable) logs a warning and continues — TTS still works
**Plans**: 1 plan

Plans:
- [ ] 08-01-PLAN.md — Remove dead /api/groq proxy and stale coverage references

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dev Mode Routing | v1.0 | 1/1 | Complete | 2026-04-02 |
| 2. Error Boundaries | v1.0 | 1/1 | Complete | 2026-04-02 |
| 3. Code Splitting | v1.0 | 1/1 | Complete | 2026-04-02 |
| 4. Secure Storage | v1.0 | 2/2 | Complete | 2026-04-02 |
| 5. Storage Consolidation | v1.0 | 2/2 | Complete | 2026-04-02 |
| 6. Praticar Redesign | v1.0 | 1/1 | Complete | 2026-04-02 |
| 7. Dead Code & Facade Cleanup | v1.1 | 2/2 | Complete | 2026-04-07 |
| 8. Dead Code & Config Cleanup | v1.2 | 0/? | Not started | - |
| 9. Model Catalog | v1.2 | 0/? | Not started | - |
| 10. Edge Function Modularization | v1.2 | 0/? | Not started | - |
| 11. AudioWorklet Migration | v1.2 | 0/? | Not started | - |
| 12. IndexedDB Audio Cache | v1.2 | 0/? | Not started | - |

---

*See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full v1.0 phase details.*
*See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full v1.1 phase details.*
