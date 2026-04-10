---
phase: 14-student-data-flow
plan: 01
subsystem: data-flow
tags: [supabase, error-analysis, review-persistence, card-reviews, error-patterns]

# Dependency graph
requires:
  - phase: v1.0 Phase 05
    provides: unified storage facade with Supabase primary
provides:
  - stable exercise_ prefixed IDs for error pattern recording
  - accurate guessCategory with keyword-first classification
  - category-filtered getCardsForWeakArea via categoryToCardThemes mapping
  - review persistence to card_reviews Supabase table in updateCard
affects: [error-analysis, review-page, exercise-mode, weak-areas]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "keyword-first category classification: check explicit meta-words before substring matching"
    - "date+score composite key dedup for review persistence"
    - "categoryToCardThemes mapping for filtering cards by error category"

key-files:
  created:
    - src/services/errorAnalysis.test.ts
    - src/services/supabase/storage.test.ts
  modified:
    - src/services/errorAnalysis.ts
    - src/components/discovery/ExerciseMode.tsx
    - src/services/supabase/storage.ts

key-decisions:
  - "Keyword-first guessCategory: check 'preposition'/'article' meta-words before matching short substrings like 'in'/'on'/'at' to prevent false positives"
  - "Non-blocking review persistence: card_reviews insert failures log errors but do not fail the entire updateCard call"
  - "categoryToCardThemes mapping bridges ErrorCategory enum to card theme/context keywords for targeted filtering"

patterns-established:
  - "Thenable mock chain: Supabase mock objects that are both chainable and Promise-like for complex query testing"
  - "exercise_ prefix convention: exercise session IDs distinguish unsaved exercise patterns from real card IDs"

requirements-completed: [999.1, 999.2]

# Metrics
duration: 26min
completed: 2026-04-09
---

# Phase 14 Plan 01: Student Data Flow Fixes Summary

**Fixed four broken data flows: stable exercise IDs, accurate error classification, category-filtered weak area cards, and review persistence to card_reviews table**

## Performance

- **Duration:** 26 min
- **Started:** 2026-04-09T14:50:37Z
- **Completed:** 2026-04-09T15:16:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Error patterns from exercises now use `exercise_` prefixed IDs instead of fake `temp_` IDs that never matched real cards
- guessCategory checks explicit category keywords before short substring matching, eliminating false positives on words like "in", "on", "at"
- getCardsForWeakArea now filters cards by theme/context matching the requested ErrorCategory, falling back to all low-scoring cards when no match
- Reviews pushed during ReviewPage are persisted to the card_reviews Supabase table via updateCard, surviving page refresh
- 13 new tests across errorAnalysis and supabase/storage covering all four fixes

## Task Commits

Each task was committed atomically:

1. **Task 0: Create test scaffolds** - `4caf8f0` (test)
2. **Task 1: Fix error tracking -- stable exercise IDs and guessCategory accuracy** - `f65a67a` (fix)
3. **Task 2: Fix review persistence -- save reviews to card_reviews Supabase table** - `06ff575` (fix)

## Files Created/Modified
- `src/services/errorAnalysis.test.ts` - Test fixtures for guessCategory, extractErrorPatterns, and getCardsForWeakArea
- `src/services/supabase/storage.test.ts` - Test fixtures for review persistence in updateCard
- `src/services/errorAnalysis.ts` - Fixed guessCategory, nullable cardId support, category-filtered getCardsForWeakArea
- `src/components/discovery/ExerciseMode.tsx` - Uses stable exercise-session ID for error pattern recording
- `src/services/supabase/storage.ts` - updateCard persists new reviews to card_reviews table

## Decisions Made
- Used keyword-first classification in guessCategory to prevent "Put it in the box" from being classified as a preposition error
- Made review persistence non-blocking: card_reviews insert failures log errors but do not fail updateCard
- Used date+score composite key for review deduplication rather than adding a unique constraint
- Used categoryToCardThemes mapping to bridge ErrorCategory enum values to searchable card theme/context keywords

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test scaffold used "natural" which triggers new fluency classification**
- **Found during:** Task 1 (fix guessCategory accuracy)
- **Issue:** Test for "generic correction" used "Try to be more natural" which now matches the "natural" fluency keyword added in the fix
- **Fix:** Changed test input to "Capitalization missing at start" which has no category keywords
- **Files modified:** src/services/errorAnalysis.test.ts
- **Verification:** All 10 errorAnalysis tests pass
- **Committed in:** f65a67a (Task 1 commit)

**2. [Rule 3 - Blocking] Supabase mock factory hoisting issue**
- **Found during:** Task 0 (test scaffolds)
- **Issue:** vi.mock factory is hoisted above variable declarations, causing "Cannot access before initialization" error when referencing mock functions
- **Fix:** Restructured mock to use thenable chainable objects returned from mockImplementation rather than top-level variables
- **Files modified:** src/services/supabase/storage.test.ts
- **Verification:** All 3 storage tests pass
- **Committed in:** 06ff575 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing audioCache.test.ts failures (5 tests) confirmed unrelated to this plan -- IndexedDB test infrastructure issue

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Student data pipeline now correctly records error patterns, persists reviews, and filters weak area cards
- Ready for UI work that displays error patterns and weak area recommendations

## Self-Check: PASSED

- All 6 key files found on disk
- All 3 task commits (4caf8f0, f65a67a, 06ff575) found in git log
- All 13 new tests pass (10 errorAnalysis + 3 storage)
- Pre-existing audioCache.test.ts failures confirmed unrelated

---
*Phase: 14-student-data-flow*
*Completed: 2026-04-09*
