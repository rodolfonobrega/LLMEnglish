# Roadmap: SpeakLab

## Milestones

- ✅ **v1.0 Hardening & Praticar Redesign** — Phases 1-6 (shipped 2026-04-02)
- ✅ **v1.1 Dead Code & Facade Cleanup** — Phase 7 (shipped 2026-04-07)
- ✅ **v1.2 Audio & Proxy Cleanup** — Phases 8-12 (shipped 2026-04-08)
- 🔄 **v1.3 Image, Data & UX Improvements** — Phases 13-17 (in progress)

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
| 14. Student Data Flow | v1.3 | 0/? | Pending | |
| 15. Model Fallback | v1.3 | 0/? | Pending | |
| 16. Recording Logic | v1.3 | 0/? | Pending | |
| 17. Retry Exercise | v1.3 | 0/? | Pending | |

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

**Goal:** Review how student errors are tracked, how cards work, and how the learning trail ties together — ensure data flows correctly through the system
**Merged from:** 999.1 (error logic), 999.2 (cards logic), 999.4 (trail discussion)
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 14 to break down)

### Phase 15: Model Fallback

**Goal:** Add fallback model configuration for all modes so users don't get stuck when their primary model is unavailable
**Promoted from:** 999.3
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 15 to break down)

### Phase 16: Recording Logic

**Goal:** Review and verify that the audio recording logic is working correctly across all modes
**Promoted from:** 999.8
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 16 to break down)

### Phase 17: Retry Exercise

**Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Promoted from:** 999.9
**Requirements:** TBD
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 17 to break down)

---

*See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full v1.0 phase details.*
*See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full v1.1 phase details.*
*See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full v1.2 phase details.*
