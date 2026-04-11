---
phase: 17
slug: retry-exercise
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | TBD | — | N/A | unit | `npx vitest run src/components/practice/ExerciseMode.test.tsx` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | TBD | — | N/A | unit | `npx vitest run src/components/practice/ImageMode.test.tsx` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | TBD | — | N/A | unit | `npx vitest run src/components/live/LiveRoleplayPage.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for exercise retry behavior in ExerciseMode
- [ ] Test stubs for image mode retry behavior in ImageMode
- [ ] Test stubs for live roleplay retry behavior in LiveRoleplayPage
- [ ] Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Retry button appears with correct styling after exercise completion | TBD | Visual verification needed | Complete an exercise, verify "Tentar Novamente" button appears with RotateCcw icon |
| Post-completion flow shows 3 options (retry, new exercise, back) | TBD | Multi-step visual flow | Complete exercise, verify 3-button completion screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
