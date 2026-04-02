---
phase: 2
slug: error-boundaries
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | RELI-01 | unit | `npx vitest run` | TBD | pending |
| 02-01-02 | 01 | 1 | RELI-02 | unit | `npx vitest run` | TBD | pending |
| 02-02-01 | 02 | 1 | RELI-03 | unit | `npx vitest run` | TBD | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Install `@testing-library/react` and `@testing-library/jest-dom` for component testing
- [ ] Add test setup in `src/test/setup.ts` for `@testing-library/jest-dom` matchers
- [ ] Create test stubs for error boundary components

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Error fallback renders visually with retry button | RELI-01 | Visual rendering check | Run dev server, trigger error, verify UI |
| Sidebar remains navigable during error state | RELI-02 | Layout interaction check | Navigate between routes while error is shown |
| Chunk error shows recovery UI | RELI-03 | Requires network failure simulation | DevTools Network offline, then navigate |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
