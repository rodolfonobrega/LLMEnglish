# Roadmap: SpeakLab

## Milestones

- ✅ **v1.0 Hardening & Praticar Redesign** — Phases 1-6 (shipped 2026-04-02)
- ✅ **v1.1 Dead Code & Facade Cleanup** — Phase 7 (shipped 2026-04-07)
- ✅ **v1.2 Audio & Proxy Cleanup** — Phases 8-12 (shipped 2026-04-08)
- 🔄 **v1.3 Image, Data & UX Improvements** — Phases 13-19 (in progress)

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

<details>
<summary>✅ v1.2 Audio & Proxy Cleanup (Phases 8-12) — SHIPPED 2026-04-08</summary>

- [x] Phase 8: Dead Code & Config Cleanup (1/1 plans)
- [x] Phase 9: Model Catalog (2/2 plans)
- [x] Phase 10: Edge Function Modularization (3/3 plans)
- [x] Phase 11: AudioWorklet Migration (1/1 plans)
- [x] Phase 12: IndexedDB Audio Cache (1/1 plans)

</details>

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
| 8. Dead Code & Config Cleanup | v1.2 | 1/1 | Complete | 2026-04-08 |
| 9. Model Catalog | v1.2 | 2/2 | Complete | 2026-04-08 |
| 10. Edge Function Modularization | v1.2 | 3/3 | Complete | 2026-04-08 |
| 11. AudioWorklet Migration | v1.2 | 1/1 | Complete | 2026-04-08 |
| 12. IndexedDB Audio Cache | v1.2 | 1/1 | Complete | 2026-04-08 |
| 13. Image Generation | v1.3 | 3/3 | Complete    | 2026-04-09 |
| 14. Student Data Flow | v1.3 | 1/1 | Complete    | 2026-04-09 |
| 15. Model Fallback | v1.3 | 2/2 | Complete    | 2026-04-10 |
| 16. Recording Logic | v1.3 | 1/2 | Complete    | 2026-04-10 |
| 17. Retry Exercise | v1.3 | 2/2 | Complete    | 2026-04-11 |
| 18. Fix Student Data Flow | v1.3 | 1/0 | Complete    | 2026-04-11 |
| 19. Fix TTS MIME Type | v1.3 | 0/1 | Pending | — |

## v1.3 — Image, Data & UX Improvements (Phases 13-17)

### Phase 13: Image Generation

**Goal:** Verify dialog screen image creation, fix Gemini image generation models, and optimize resolution to reduce token usage and cost
**Merged from:** 999.5 (dialog images), 999.6 (Gemini image models), 999.7 (resolution optimization)
**Requirements:** 999.5, 999.6, 999.7
**Plans:** 3/3 plans complete

Plans:
- [x] 13-01-PLAN.md — Fix client proxy option forwarding (999.5)
- [x] 13-02-PLAN.md — Fix edge function + providers + config optimization (999.5, 999.6, 999.7)
- [x] 13-03-PLAN.md — Close verification gaps: inline provider functions in index.ts (999.5, 999.6, 999.7)

### Phase 14: Student Data Flow

**Goal:** Fix broken data flow connections — error patterns with fake temp IDs, reviews lost on refresh, weak area cards ignoring category filter, and guessCategory false positives
**Merged from:** 999.1 (error logic), 999.2 (cards logic), 999.4 (trail discussion)
**Requirements:** 999.1, 999.2
**Plans:** 1/1 plans complete

Plans:
- [x] 14-01-PLAN.md — Fix error tracking, review persistence, weak area filtering, and guessCategory

### Phase 15: Model Fallback

**Goal:** Add fallback model configuration for all modes so users don't get stuck when their primary model is unavailable
**Promoted from:** 999.3
**Requirements:** IMAGE-FALLBACK-TYPES, LIVE-FACTORY, IMAGE-FALLBACK, IMAGE-CHAT-FALLBACK, SETTINGS-UI
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md — Add image fallback types to ModelConfig + fix live session provider factory
- [x] 15-02-PLAN.md — Add image fallback logic to openai.ts + Settings UI for image fallback

### Phase 16: Recording Logic

**Goal:** Re-apply AudioWorklet migration (silently reverted), fix blob URL memory leak in useAudioRecorder, fix ReviewPage type mismatch, and add unit tests
**Promoted from:** 999.8
**Requirements:** REC-01, REC-02, REC-03, REC-04, REC-05
**Plans:** 1/2 plans complete

Plans:
- [ ] 16-01-PLAN.md — Migrate geminiLive.ts from ScriptProcessorNode to AudioWorkletNode + remove unclamped createPcmBlob
- [x] 16-02-PLAN.md — Fix useAudioRecorder blob URL cleanup + stream safety + ReviewPage type fix + tests

### Phase 17: Retry Exercise

**Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Promoted from:** 999.9
**Requirements:** RETRY-01, RETRY-02, RETRY-03, RETRY-04, RETRY-05, RETRY-06, RETRY-07
**Plans:** 2/2 plans complete

Plans:
- [x] 17-01-PLAN.md — Add retry + post-exercise navigation to ExerciseMode and ImageMode
- [x] 17-02-PLAN.md — Add retry-same-scenario to LiveRoleplayPage and ConversationAnalysis

### Phase 18: Fix Student Data Flow

**Goal:** Close the two Phase 14 gaps confirmed by the milestone audit — stable exercise IDs at the call site and a real category filter in getCardsForWeakArea
**Requirements:** 999.1, 999.2
**Gap Closure:** Closes gaps from v1.3 audit
**Plans:** 1/0 plans complete

Plans:
- [x] 18-01-PLAN.md — Fix exercise_ ID prefix in ExerciseMode.tsx + implement categoryToCardThemes mapping in errorAnalysis.ts

### Phase 19: Fix TTS MIME Type

**Goal:** Fix pre-existing bug where ttsProvider (always undefined) is checked instead of ttsSource, silently breaking OpenAI TTS MP3 audio output
**Requirements:** TTS-MIME-FIX
**Gap Closure:** Closes pre-existing TTS integration gap flagged in v1.3 audit
**Plans:** 0/1 plans complete

Plans:
- [ ] 19-01-PLAN.md — Fix config.ttsProvider → config.ttsSource in ConversationAnalysis.tsx and useTTS.ts

---
*See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full v1.0 phase details.*
*See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full v1.1 phase details.*
*See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full v1.2 phase details.*
