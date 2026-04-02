---
phase: 1
slug: dev-mode-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | `vite.config.ts` (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `npx vitest run 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | RELI-04 | unit | `npx vitest run src/contexts/__tests__/AuthContext.test.tsx` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | RELI-04 | unit | `npx vitest run src/App.test.tsx` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | RELI-04 | unit | `npx vitest run src/components/layout/__tests__/DevBanner.test.tsx` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | RELI-04 | integration | `npx vitest run 2>&1` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/contexts/__tests__/AuthContext.test.tsx` — stubs for dev-mode auth mock
- [ ] `src/App.test.tsx` — stubs for ProtectedApp routing in dev mode
- [ ] `src/components/layout/__tests__/DevBanner.test.tsx` — stubs for DevBanner component

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full app renders in dev mode without Supabase env vars | RELI-04 | Requires running `npx vite` without `.env.local` and visually verifying Layout + all routes | 1. Remove/rename `.env.local` 2. Run `npx vite --port 5173 --host` 3. Open browser, verify sidebar renders, navigate to each route 4. Verify DevBanner shows "Dev Mode" indicator |
| Mock user appears authenticated in dev mode | RELI-04 | Visual verification that auth-gated UI renders | 1. Run dev server without env vars 2. Check Settings, Practice pages render fully 3. Verify no redirect to /login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
