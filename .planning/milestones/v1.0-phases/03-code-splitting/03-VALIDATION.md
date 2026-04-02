---
phase: 3
slug: code-splitting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1` |
| **Full suite command** | `npx vitest run --coverage 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1`
- **After every plan wave:** Run `npx vitest run --coverage 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PERF-01 | unit | `npx vitest run src/App.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PERF-02 | unit | `npx vitest run src/App.test.tsx` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PERF-03 | manual | browser network tab verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/App.test.tsx` — tests for lazy loading and Suspense fallback behavior
- [ ] `src/test/setup.ts` — existing test setup covers DOM environment

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bundle does not include jspdf in main chunk | PERF-01 | Requires build analysis or network inspection | Run `npx vite build`, check dist/assets/ for chunk sizes, verify jspdf is in separate chunk |
| Route chunks appear in network tab on navigation | PERF-03 | Requires browser runtime + network panel | Open app in browser, navigate between routes, verify new JS chunks load in Network tab |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
