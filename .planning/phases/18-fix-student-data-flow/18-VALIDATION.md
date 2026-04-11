---
phase: 18
slug: fix-student-data-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run src/services/errorAnalysis.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/services/errorAnalysis.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 1 | 999.1 | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ | ⬜ pending |
| 18-01-02 | 01 | 1 | 999.2 | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ | ⬜ pending |
| 18-01-03 | 01 | 1 | 999.1 | — | N/A | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — `src/services/errorAnalysis.test.ts` already contains failing tests for all three root causes.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
