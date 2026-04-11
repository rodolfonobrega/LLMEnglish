---
phase: 17-retry-exercise
plan: "01"
subsystem: practice-ui
tags: [retry, navigation, ux, exercise-mode, image-mode]
dependency_graph:
  requires: []
  provides: [retry-same-exercise, post-evaluation-nav]
  affects: [ExerciseMode, ImageMode]
tech_stack:
  added: []
  patterns: [react-router-dom useNavigate, 3-button post-evaluation layout]
key_files:
  created: []
  modified:
    - src/components/discovery/ExerciseMode.tsx
    - src/components/discovery/ImageMode.tsx
decisions:
  - "retrySame preserves prompt/imageUrl+question by only clearing evaluation state, not content state"
  - "3-button layout order: primary Tentar Novamente, secondary Novo Exercicio, ghost Voltar ao Hub"
metrics:
  duration: ~5min
  completed: "2026-04-11T20:34:40Z"
  tasks_completed: 2
  files_modified: 2
requirements: [RETRY-01, RETRY-02, RETRY-03, RETRY-04]
---

# Phase 17 Plan 01: Retry Exercise + Post-Evaluation Navigation Summary

**One-liner:** Added 3-button post-evaluation layout (Tentar Novamente / Novo Exercicio / Voltar ao Hub) to ExerciseMode and ImageMode with a retrySame function that preserves the exercise prompt.

## What Was Built

Both ExerciseMode.tsx and ImageMode.tsx now show a 3-button group after exercise evaluation instead of a single "Tentar Outro" button:

- **Tentar Novamente** (primary) — calls `retrySame()`, clears evaluation/audio but keeps the current prompt/image+question so the user can practice the same content again
- **Novo Exercicio** (secondary) — calls `reset()`, full state clear returning to setup flow
- **Voltar ao Hub** (ghost) — calls `navigate('/practice')`, exits to the practice hub

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add retry + post-exercise navigation to ExerciseMode | 83c1976 | src/components/discovery/ExerciseMode.tsx |
| 2 | Add retry + post-exercise navigation to ImageMode | dda6800 | src/components/discovery/ImageMode.tsx |

## Decisions Made

- `retrySame` only clears `evaluation`, `error`, `saved`, and `userAudioBase64` — deliberately does NOT call `setPrompt('')` (ExerciseMode) or `setImageUrl`/`setQuestion` (ImageMode), so the user sees the same exercise again
- Button order follows UX convention: most likely action first (retry), destructive-ish action second (new), exit last
- Used `useNavigate` from react-router-dom (already a project dependency) for `/practice` navigation

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. All changes are client-side UI state transitions with no external input handling.

## Self-Check: PASSED

- src/components/discovery/ExerciseMode.tsx: FOUND
- src/components/discovery/ImageMode.tsx: FOUND
- Commit 83c1976: FOUND
- Commit dda6800: FOUND
- "Tentar Outro" no longer present in either file: CONFIRMED
- TypeScript compilation: PASSED (npx tsc --noEmit)
- retrySame function in both files: CONFIRMED
