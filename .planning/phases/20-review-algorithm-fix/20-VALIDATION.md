---
phase: 20
slug: review-algorithm-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0 |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | REVI-03 | — | N/A | unit | `npx vitest run src/services/spacedRepetition.test.ts` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | REVI-01 | — | N/A | unit | `npx vitest run src/services/spacedRepetition.test.ts` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 1 | REVI-02 | — | N/A | unit | `npx vitest run src/services/supabase/storage.test.ts` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 1 | REVI-04 | — | N/A | unit | `npx vitest run src/services/supabase/storage.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/spacedRepetition.test.ts` — test stubs for REVI-01, REVI-03 (three-tier scoring, createDefaultCard nextReviewAt)

*Existing infrastructure (`src/services/supabase/storage.test.ts`) covers REVI-02, REVI-04.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card appears in review queue immediately after save in live app | REVI-01 | Requires Supabase connection and live UI interaction | Save a new card, navigate to review page, verify card appears without reload |
| Same-day same-score reviews visible in card history UI | REVI-04 | Requires live UI interaction | Review same card twice with same score, verify both entries in history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
