---
phase: 17-retry-exercise
plan: 01
subsystem: ui
tags: [react, exercise-mode, image-mode, navigation, retry, lucide-react]

# Dependency graph
requires: []
provides:
  - 3-button post-evaluation layout for ExerciseMode (retry same, new exercise, back to hub)
  - 3-button post-evaluation layout for ImageMode (retry same, new exercise, back to hub)
  - retrySame function pattern preserving prompt/image while clearing evaluation state
affects: [17-02, conversation-analysis]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "retrySame state reset pattern: clear evaluation/error/saved/audio, preserve prompt/image"

key-files:
  created: []
  modified:
    - src/components/discovery/ExerciseMode.tsx
    - src/components/discovery/ImageMode.tsx

key-decisions:
  - "Used variant='primary' for retry button (teal accent) per UI-SPEC, matching the highest-emphasis action"
  - "retrySame does NOT clear prompt/image/question — only clears evaluation, error, saved, and userAudioBase64"

patterns-established:
  - "3-button post-evaluation layout: primary retry, secondary new, ghost exit"
  - "Selective state clearing for retry vs full reset for new exercise"

requirements-completed: [RETRY-01, RETRY-02, RETRY-03, RETRY-04]

# Metrics
duration: 18min
completed: 2026-04-11
---

# Phase 17 Plan 01: Retry Exercise Navigation Summary

**3-button post-evaluation layout (Tentar Novamente / Novo Exercicio / Voltar ao Hub) replacing single Tentar Outro in ExerciseMode and ImageMode**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-11T02:11:27Z
- **Completed:** 2026-04-11T02:29:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ExerciseMode evaluation view now shows 3 clear post-exercise choices instead of a single reset button
- ImageMode evaluation view has the same 3-button pattern, preserving imageUrl and question on retry
- retrySame function selectively clears evaluation state while keeping exercise content intact
- Back-to-hub navigation via useNavigate('/practice') in both components

## Task Commits

Each task was committed atomically:

1. **Task 1: Add retry + post-exercise navigation to ExerciseMode** - `98d1abc` (feat)
2. **Task 2: Add retry + post-exercise navigation to ImageMode** - `5ff339b` (feat)

## Files Created/Modified
- `src/components/discovery/ExerciseMode.tsx` - Added useNavigate, RotateCcw import, retrySame function, 3-button evaluation layout
- `src/components/discovery/ImageMode.tsx` - Added useNavigate, RotateCcw/ChevronLeft imports, retrySame function, 3-button evaluation layout

## Decisions Made
- Used variant="primary" for the retry button (Tentar Novamente) as the highest-emphasis action, matching UI-SPEC specification
- retrySame preserves prompt in ExerciseMode and imageUrl+question in ImageMode, only clearing evaluation/error/saved/audio state
- "Tentar Outro" label replaced with "Novo Exercicio" for clarity on the full-reset action

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ExerciseMode and ImageMode retry patterns established, ready for ConversationAnalysis retry in plan 02
- The retrySame pattern (selective state clearing) can be applied to ConversationAnalysis with scenario preservation

---
*Phase: 17-retry-exercise*
*Completed: 2026-04-11*

## Self-Check: PASSED

- FOUND: src/components/discovery/ExerciseMode.tsx
- FOUND: src/components/discovery/ImageMode.tsx
- FOUND: .planning/phases/17-retry-exercise/17-01-SUMMARY.md
- FOUND: commit 98d1abc (Task 1)
- FOUND: commit 5ff339b (Task 2)
