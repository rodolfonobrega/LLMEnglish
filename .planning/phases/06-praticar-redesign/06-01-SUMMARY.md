---
phase: 06-praticar-redesign
plan: 01
subsystem: ui
tags: [react, tailwind, vitest, accessibility, lucide-react]

# Dependency graph
requires:
  - phase: 05-storage-consolidation
    provides: Storage facade used by PracticeHubPage
provides:
  - PracticeModeCard image-banner card component
  - Redesigned PracticeHubPage with 2-section vertical layout
  - 20 passing tests covering VIS-01, VIS-02, VIS-03
affects: [ui, praticar-page, practice-modes]

# Tech tracking
tech-stack:
  added: []
  patterns: [image-banner-card, inline-mode-grouping, button-accessibility]

key-files:
  created:
    - src/components/shared/PracticeModeCard.tsx
    - src/components/shared/PracticeModeCard.test.tsx
    - src/components/practice/PracticeHubPage.test.tsx
  modified:
    - src/components/practice/PracticeHubPage.tsx

key-decisions:
  - "Created new PracticeModeCard component instead of modifying ModeCard -- safer, no risk to other consumers"
  - "Inline mode grouping (soloModes/liveModes) in PracticeHubPage instead of modifying modes.ts config"
  - "Section headers use bg-primary neutral dot instead of mode-colored dots per UI-SPEC recommendation"

patterns-established:
  - "Image-banner card pattern: button > h-40 image div + p-4 content div, with gradient+icon fallback"
  - "Inline mode grouping: spread exerciseModes + find from conversationModes to create custom sections"

requirements-completed: [VIS-01, VIS-02, VIS-03]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 6: Praticar Redesign Summary

**Vertical image-banner cards with h-40 banners, 2-section layout (Pratica Solo + Ao Vivo), full keyboard accessibility, and gradient+icon fallback -- replacing horizontal ModeCard list**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T23:04:04Z
- **Completed:** 2026-04-02T23:08:16Z
- **Tasks:** 2 (Task 3 is human-verify checkpoint, pending)
- **Files modified:** 4

## Accomplishments
- New PracticeModeCard component with h-40 image banners, 25% taller than PathCard h-32
- PracticeHubPage rewritten with 2-section layout: Pratica Solo (5 modes) and Ao Vivo (2 modes)
- ModeTooltip removed -- all information (label, description, example) visible directly on cards
- 20 passing unit tests (11 PracticeModeCard + 9 PracticeHubPage) covering VIS-01/VIS-02/VIS-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PracticeModeCard component with tests** - `50cc984` (feat) -- TDD: RED test commit + GREEN implementation
2. **Task 2: Rewrite PracticeHubPage with 2-section layout and tests** - `e41686b` (feat)

**Plan metadata:** pending (docs commit after state updates)

## Files Created/Modified
- `src/components/shared/PracticeModeCard.tsx` - New image-banner card component for practice modes
- `src/components/shared/PracticeModeCard.test.tsx` - 11 tests for PracticeModeCard (VIS-01, VIS-02, VIS-03)
- `src/components/practice/PracticeHubPage.tsx` - Rewritten with 2-section layout, PracticeModeCard, no ModeTooltip
- `src/components/practice/PracticeHubPage.test.tsx` - 9 tests for PracticeHubPage section grouping

## Decisions Made
- Created new PracticeModeCard component rather than modifying existing ModeCard -- avoids risk to any other ModeCard consumers
- Inline mode grouping (soloModes/liveModes arrays) in PracticeHubPage instead of adding exports to modes.ts -- simpler, no config file changes needed by other consumers
- Section headers use bg-primary neutral dot for both sections since each card already has its own mode color

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (human-verify checkpoint) is pending -- requires visual verification by user
- All automated tests pass, TypeScript and lint checks should be clean
- After visual approval, this phase is complete

## Self-Check: PASSED

- All 4 files verified present (PracticeModeCard.tsx, PracticeModeCard.test.tsx, PracticeHubPage.tsx, PracticeHubPage.test.tsx)
- SUMMARY.md exists in plan directory
- Commit 50cc984 (Task 1) verified in git log
- Commit e41686b (Task 2) verified in git log

---
*Phase: 06-praticar-redesign*
*Completed: 2026-04-02*
