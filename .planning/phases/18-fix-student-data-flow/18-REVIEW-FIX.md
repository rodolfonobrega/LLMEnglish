---
phase: 18-fix-student-data-flow
fixed_at: 2026-04-11T20:04:20Z
review_path: .planning/phases/18-fix-student-data-flow/18-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 18: Code Review Fix Report

**Fixed at:** 2026-04-11T20:04:20Z
**Source review:** .planning/phases/18-fix-student-data-flow/18-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01 + WR-04: Evaluation result discarded when background persistence fails / syncGamificationState never called after addXP

**Files modified:** `src/components/discovery/ExerciseMode.tsx`
**Commit:** 625f34e
**Applied fix:** Moved `setEvaluation(evalResult)` before persistence calls so the user always sees their result. Wrapped the background tasks (`extractErrorPatterns`, `recordErrorPatterns`, `addXP`, `syncGamificationState`) in a nested try/catch that logs with `console.warn` but does not surface as a UI error. Added the missing `syncGamificationState()` call immediately after `addXP()` inside the background block.

---

### WR-01: Division-by-zero when `recentScores` is empty in `criticalErrors` sort

**Files modified:** `src/services/errorAnalysis.ts`
**Commit:** 30ff87e
**Applied fix:** Introduced a `safeAvg` helper that returns `0` when the scores array is empty, replacing the inline division that produced `NaN` for empty arrays. The `criticalErrors` sort now uses `safeAvg(a.recentScores) - safeAvg(b.recentScores)`.

---

### WR-02: `guessCategory` article-detection regex matches ordinary English sentences

**Files modified:** `src/services/errorAnalysis.ts`
**Commit:** dd17d4c
**Applied fix:** Removed `'a'` from the fallback article regex, leaving only the unambiguous articles `'an'` and `'the'`. Added a comment explaining the rationale. The keyword branch (line 207) already handles corrections that explicitly mention "article", so removing `'a'` from the fallback does not reduce coverage for genuine article corrections.

---

### WR-03: Non-null assertion after null-safe guard in `recordSessionSnapshot`

**Files modified:** `src/services/errorAnalysis.ts`
**Commit:** f9f4d1c
**Applied fix:** Materialised `const snapshotList = snapshots || []` before the length check, then used `snapshotList` consistently in both the condition and the `.slice(100)` call. This eliminates the fragile `snapshots!` non-null assertion while keeping the same runtime behaviour.

---

_Fixed: 2026-04-11T20:04:20Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
