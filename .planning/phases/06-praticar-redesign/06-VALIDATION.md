---
phase: 06
slug: praticar-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `npx vitest run 2>&1` |
| **Estimated runtime** | ~10 seconds |

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
| 06-01-01 | 01 | 1 | VIS-01 | component | `npx vitest run src/components/practice/PracticeModeCard.test.tsx` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | VIS-02 | component | `npx vitest run src/components/practice/PracticeModeCard.test.tsx` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | VIS-03 | component+accessibility | `npx vitest run src/components/practice/PracticeModeCard.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/practice/PracticeModeCard.test.tsx` — stubs for VIS-01, VIS-02, VIS-03

*Existing infrastructure (vite.config.ts test block, src/test/setup.ts) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card image banner renders with correct mode image | VIS-01 | Visual rendering of mode-specific images requires browser inspection | Navigate to /practice, verify each card shows its mode image in top banner |
| Card proportions visibly different from PathCards | VIS-02 | Visual comparison between two components requires human judgment | Compare Praticar cards vs Trilhas PathCards side-by-side; verify different height/aspect ratio |
| Card gradient background uses mode color tokens | VIS-01 | CSS variable resolution in gradient backgrounds is visual | Inspect card backgrounds match expected mode color tokens from UI-SPEC |
| Hover/focus animations match UI-SPEC | VIS-01 | Animation timing and visual feedback require browser interaction | Tab through cards, verify focus ring; hover cards, verify lift effect |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
