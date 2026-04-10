---
phase: 14
slug: student-data-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-00 | 01 | 0 | Test scaffolds | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts src/services/supabase/storage.test.ts` | ⬜ pending | ⬜ pending |
| 14-01-01 | 01 | 1 | Error tracking fix | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ⬜ pending | ⬜ pending |
| 14-01-02 | 01 | 1 | Review persistence fix | — | N/A | unit | `npx vitest run src/services/supabase/storage.test.ts` | ⬜ pending | ⬜ pending |
| 14-01-03 | 01 | 1 | guessCategory fix | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ⬜ pending | ⬜ pending |
| 14-01-04 | 01 | 1 | WeakArea query fix | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ⬜ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/errorAnalysis.test.ts` — test fixtures for guessCategory, error recording, and weak area filtering
- [ ] `src/services/supabase/storage.test.ts` — test fixtures for review persistence and card_reviews insert

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | — |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
