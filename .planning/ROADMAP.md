# Roadmap: SpeakLab

## Milestones

- ✅ **v1.0 Hardening & Praticar Redesign** — Phases 1-6 (shipped 2026-04-02)
- ✅ **v1.1 Dead Code & Facade Cleanup** — Phase 7 (shipped 2026-04-07)
- ✅ **v1.2 Audio & Proxy Cleanup** — Phases 8-12 (shipped 2026-04-08)
- 🔄 **v1.3 Image, Data & UX Improvements** — Phases 13-19 (in progress)
- 🚧 **v1.4 Review, Analysis & Library** — Phases 20-23 (in progress)

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

## v1.3 — Image, Data & UX Improvements (Phases 13-19)

### Phase 13: Image Generation

**Goal:** Verify dialog screen image creation, fix Gemini image generation models, and optimize resolution to reduce token usage and cost
**Requirements:** 999.5, 999.6, 999.7
**Plans:** 3/3 plans complete

Plans:
- [x] 13-01-PLAN.md — Fix client proxy option forwarding (999.5)
- [x] 13-02-PLAN.md — Fix edge function + providers + config optimization (999.5, 999.6, 999.7)
- [x] 13-03-PLAN.md — Close verification gaps: inline provider functions in index.ts (999.5, 999.6, 999.7)

### Phase 14: Student Data Flow

**Goal:** Fix broken data flow connections — error patterns with fake temp IDs, reviews lost on refresh, weak area cards ignoring category filter, and guessCategory false positives
**Requirements:** 999.1, 999.2
**Plans:** 1/1 plans complete

Plans:
- [x] 14-01-PLAN.md — Fix error tracking, review persistence, weak area filtering, and guessCategory

### Phase 15: Model Fallback

**Goal:** Add fallback model configuration for all modes so users don't get stuck when their primary model is unavailable
**Requirements:** IMAGE-FALLBACK-TYPES, LIVE-FACTORY, IMAGE-FALLBACK, IMAGE-CHAT-FALLBACK, SETTINGS-UI
**Plans:** 2/2 plans complete

Plans:
- [x] 15-01-PLAN.md — Add image fallback types to ModelConfig + fix live session provider factory
- [x] 15-02-PLAN.md — Add image fallback logic to openai.ts + Settings UI for image fallback

### Phase 16: Recording Logic

**Goal:** Re-apply AudioWorklet migration (silently reverted), fix blob URL memory leak in useAudioRecorder, fix ReviewPage type mismatch, and add unit tests
**Requirements:** REC-01, REC-02, REC-03, REC-04, REC-05
**Plans:** 1/2 plans complete

Plans:
- [ ] 16-01-PLAN.md — Migrate geminiLive.ts from ScriptProcessorNode to AudioWorkletNode + remove unclamped createPcmBlob
- [x] 16-02-PLAN.md — Fix useAudioRecorder blob URL cleanup + stream safety + ReviewPage type fix + tests

### Phase 17: Retry Exercise

**Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Requirements:** RETRY-01, RETRY-02, RETRY-03, RETRY-04, RETRY-05, RETRY-06, RETRY-07
**Plans:** 2/2 plans complete

Plans:
- [x] 17-01-PLAN.md — Add retry + post-exercise navigation to ExerciseMode and ImageMode
- [x] 17-02-PLAN.md — Add retry-same-scenario to LiveRoleplayPage and ConversationAnalysis

### Phase 18: Fix Student Data Flow

**Goal:** Close the two Phase 14 gaps confirmed by the milestone audit — stable exercise IDs at the call site and a real category filter in getCardsForWeakArea
**Requirements:** 999.1, 999.2
**Plans:** 1/1 plans complete

Plans:
- [x] 18-01-PLAN.md — Fix exercise_ ID prefix in ExerciseMode.tsx + implement categoryToCardThemes mapping in errorAnalysis.ts

### Phase 19: Fix TTS MIME Type

**Goal:** Fix pre-existing bug where ttsProvider (always undefined) is checked instead of ttsSource, silently breaking OpenAI TTS MP3 audio output
**Requirements:** TTS-MIME-FIX
**Plans:** 0/1 plans complete

Plans:
- [ ] 19-01-PLAN.md — Fix config.ttsProvider → config.ttsSource in ConversationAnalysis.tsx and useTTS.ts

## v1.4 — Review, Analysis & Library (Phases 20-23)

**Milestone Goal:** Fix broken review flow, upgrade error analysis to teacher-style reports, add lesson history/progress to Library, and show evaluation improvement trends.

- [ ] **Phase 20: Review Algorithm Fix** - Fix broken review queue so new cards appear immediately, backfill orphans, correct score mapping, fix dedup
- [ ] **Phase 21: Evaluation Trends** - Per-category trend visualization with direction, magnitude, CSS-based trend lines, and milestone markers
- [ ] **Phase 22: Library History** - Score timelines, review statistics, and next-review countdowns per card
- [ ] **Phase 23: Teacher-Style Error Analysis** - AI-generated narrative progress reports with visual report cards and period comparison

### Phase 20: Review Algorithm Fix
**Goal**: Users can review newly saved cards immediately and all existing cards appear correctly in the review queue
**Depends on**: Phase 19 (v1.3 completion)
**Requirements**: REVI-01, REVI-02, REVI-03, REVI-04
**Success Criteria** (what must be TRUE):
  1. A card appears in the review queue immediately after the user saves it — no page reload or waiting required
  2. Cards that previously had no next review date (orphaned cards) automatically become available for review without any manual intervention
  3. A score of 3 or 4 out of 10 is recognized as "partial" knowledge rather than "incorrect" — the card does not get fully reset
  4. Two reviews on the same day with the same score are both preserved in review history, not silently dropped
**Plans**: TBD

### Phase 21: Evaluation Trends
**Goal**: Users can see whether their skills are improving or declining over time with clear directional indicators
**Depends on**: Phase 20 (review data must be reliable for trends)
**Requirements**: TREN-01, TREN-02, TREN-03
**Success Criteria** (what must be TRUE):
  1. User sees per-category trend direction with percentage magnitude (e.g., "Grammar improved 20% this month, vocabulary declining 5%")
  2. Each skill category shows a CSS-based trend line visualization — no external chart library loaded
  3. User sees milestone markers celebrating concrete progress moments (e.g., "First article error resolved!", "Verb tenses improving for 2 weeks")
**Plans**: TBD
**UI hint**: yes

### Phase 22: Library History
**Goal**: Users can see detailed score history and progress for each card in their library
**Depends on**: Phase 20 (review data must be reliable for history)
**Requirements**: LIBR-01, LIBR-02, LIBR-03
**Success Criteria** (what must be TRUE):
  1. User sees a score timeline chart per card showing how their scores changed across review sessions over time
  2. Card detail shows review statistics: total review count, correct count, average score, and current streak
  3. Card detail shows when the next review is scheduled with a human-readable countdown (e.g., "Review again in 3 days", "Overdue by 2 days")
**Plans**: TBD
**UI hint**: yes

### Phase 23: Teacher-Style Error Analysis
**Goal**: Users receive an AI-generated teacher-style narrative report summarizing their overall progress with actionable recommendations
**Depends on**: Phase 21 (trend data enriches report quality)
**Requirements**: ANAL-01, ANAL-02, ANAL-03
**Success Criteria** (what must be TRUE):
  1. User sees a teacher-style AI narrative report summarizing progress across sessions (e.g., "You struggle with past tense verbs", "Your articles are improving")
  2. Error dashboard shows a visual report card with color-coded skill categories, trend indicators, and actionable recommendations
  3. User can compare progress between periods (this week vs last week) with clear directional indicators showing improvement or decline
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 13 → ... → 19 → 20 → 21 → 22 → 23

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
| 13. Image Generation | v1.3 | 3/3 | Complete | 2026-04-09 |
| 14. Student Data Flow | v1.3 | 1/1 | Complete | 2026-04-09 |
| 15. Model Fallback | v1.3 | 2/2 | Complete | 2026-04-10 |
| 16. Recording Logic | v1.3 | 1/2 | Complete | 2026-04-10 |
| 17. Retry Exercise | v1.3 | 2/2 | Complete | 2026-04-11 |
| 18. Fix Student Data Flow | v1.3 | 1/1 | Complete | 2026-04-11 |
| 19. Fix TTS MIME Type | v1.3 | 0/1 | Pending | — |
| 20. Review Algorithm Fix | v1.4 | 0/? | Not started | - |
| 21. Evaluation Trends | v1.4 | 0/? | Not started | - |
| 22. Library History | v1.4 | 0/? | Not started | - |
| 23. Teacher-Style Error Analysis | v1.4 | 0/? | Not started | - |

---
*See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full v1.0 phase details.*
*See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full v1.1 phase details.*
*See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full v1.2 phase details.*
