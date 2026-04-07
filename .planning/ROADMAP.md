# Roadmap: SpeakLab

## Milestones

- ✅ **v1.0 Hardening & Praticar Redesign** — Phases 1-6 (shipped 2026-04-02)
- 📋 **v1.1** — Phases 7+ (planned)

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

### 📋 v1.1 Gap Closure (Planned)

- [ ] Phase 7: Dead Code & Facade Cleanup (0/0 plans)
- [ ] Phase 8: Nyquist Validation (0/0 plans)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Dev Mode Routing | v1.0 | 1/1 | Complete | 2026-04-02 |
| 2. Error Boundaries | v1.0 | 1/1 | Complete | 2026-04-02 |
| 3. Code Splitting | v1.0 | 1/1 | Complete | 2026-04-02 |
| 4. Secure Storage | v1.0 | 2/2 | Complete | 2026-04-02 |
| 5. Storage Consolidation | v1.0 | 2/2 | Complete | 2026-04-02 |
| 6. Praticar Redesign | v1.0 | 1/1 | Complete | 2026-04-02 |
| 7. Dead Code & Facade Cleanup | v1.1 | 0/0 | Pending | — |
| 8. Nyquist Validation | v1.1 | 0/0 | Pending | — |

---

*See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full v1.0 phase details.*

### Phase 7: Dead Code & Facade Cleanup
**Goal:** Remove orphaned code accumulated during v1.0 and close STOR-01 integration gap
**Gap Closure:** Closes tech debt from v1.0 audit
- Remove orphaned `ChunkErrorFallback.tsx` (retry handled inline by ErrorFallback)
- Evaluate/remove unused `OpenAIRealtimeLiveSession`
- Remove orphaned exports from `aiProxy.ts`
- Fix `SettingsPage.tsx` dual import — route through storage facade exclusively

### Phase 8: Nyquist Validation
**Goal:** Achieve Nyquist-compliant validation for all 6 v1.0 phases
**Gap Closure:** Closes Nyquist compliance gap from v1.0 audit (0/6 → 6/6)
- Validate Phase 01: Dev Mode Routing
- Validate Phase 02: Error Boundaries
- Validate Phase 03: Code Splitting
- Validate Phase 04: Secure Storage
- Validate Phase 05: Storage Consolidation
- Validate Phase 06: Praticar Redesign
