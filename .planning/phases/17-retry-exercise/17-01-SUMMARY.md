---
phase: 17-retry-exercise
plan: "01"
subsystem: discovery-exercise-flow
tags: [ux, navigation, exercise, retry]
dependency_graph:
  requires: []
  provides: [retry-same-exercise, post-exercise-navigation]
  affects: [ExerciseMode, ImageMode]
tech_stack:
  added: []
  patterns: [useNavigate, selective-state-reset]
key_files:
  created: []
  modified:
    - src/components/discovery/ExerciseMode.tsx
    - src/components/discovery/ImageMode.tsx
decisions:
  - "Use variant=primary for Tentar Novamente to match UI spec (maps to teal via legacy variant system)"
  - "retrySame clears evaluation/audio/error/saved but never calls setPrompt or setImageUrl/setQuestion"
  - "Pre-existing errorAnalysis.test.ts failures confirmed on base commit — out of scope"
metrics:
  duration: 8min
  completed_date: "2026-04-11"
  tasks_completed: 2
  files_modified: 2
---

# Phase 17 Plan 01: Add Retry + Post-Exercise Navigation Summary

**One-liner:** 3-button post-evaluation layout (Tentar Novamente / Novo Exercicio / Voltar ao Hub) added to ExerciseMode and ImageMode with selective state reset preserving exercise prompt/image.

## What Was Built

Both `ExerciseMode` and `ImageMode` now show a 3-button group after exercise evaluation instead of the single "Tentar Outro" button:

1. **Tentar Novamente** (primary/teal, RotateCcw icon) — clears evaluation, error, saved flag, and audio base64 but preserves the exercise prompt / image+question. User sees the same exercise with a fresh AudioRecorder.
2. **Novo Exercicio** (secondary, RefreshCw icon) — full reset, equivalent to the old "Tentar Outro" button. Clears all state and returns to setup.
3. **Voltar ao Hub** (ghost, ChevronLeft icon) — calls `navigate('/practice')` to exit to the practice hub.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add retry + post-exercise navigation to ExerciseMode | 01846a9 | src/components/discovery/ExerciseMode.tsx |
| 2 | Add retry + post-exercise navigation to ImageMode | 1c1731d | src/components/discovery/ImageMode.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. Both button implementations are fully wired to their respective state handlers and router.

## Threat Flags

None. All changes are client-side UI state transitions — no new network endpoints, auth paths, file access patterns, or schema changes.

## Self-Check: PASSED

- [x] src/components/discovery/ExerciseMode.tsx — modified, contains retrySame, useNavigate, 3-button layout
- [x] src/components/discovery/ImageMode.tsx — modified, contains retrySame, useNavigate, 3-button layout
- [x] No "Tentar Outro" string in either file
- [x] TypeScript compiles clean (tsc --noEmit passes)
- [x] Commits 01846a9 and 1c1731d exist
- [x] Pre-existing test failures in errorAnalysis.test.ts confirmed on base commit (not introduced by this plan)
