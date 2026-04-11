---
phase: 18-fix-student-data-flow
reviewed: 2026-04-11T15:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/services/errorAnalysis.ts
  - src/components/discovery/ExerciseMode.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-04-11T15:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files were reviewed: the error analysis service (`errorAnalysis.ts`) and the exercise mode component (`ExerciseMode.tsx`). The service introduces new data flow paths for recording and querying student error patterns stored in Supabase. The component integrates those paths into the exercise evaluation flow.

The most serious issue is a logic bug in `ExerciseMode.tsx` where the evaluation result is gated behind background persistence tasks — if `recordErrorPatterns` or `addXP` fails (e.g. network error, unauthenticated), the user loses their evaluation result entirely even though transcription and scoring already succeeded. Additionally, `getCardsForWeakArea` for category `'other'` returns all cards with a low score without a size limit, which can be a large unbounded set. There are also a division-by-zero risk in the `criticalErrors` sort, a regex over-matching issue in `guessCategory`, and a misleading non-null assertion in `recordSessionSnapshot`.

---

## Critical Issues

### CR-01: Evaluation result discarded when background persistence fails

**File:** `src/components/discovery/ExerciseMode.tsx:178-192`

**Issue:** `setEvaluation(evalResult)` is called on line 180, before `recordErrorPatterns` and `addXP`. However, both of those calls are inside the same `try` block. If either throws (network failure, unauthenticated user, Supabase error), the `catch` block fires, sets the error string, and — because `setEvaluation` was already called — the evaluation IS visible. **However**, if `extractErrorPatterns` itself throws (e.g. `getUserId()` throws `'User not authenticated'`), the exception surfaces before `setEvaluation` on line 183, meaning the user receives an error message but zero evaluation display, even though speech transcription and AI scoring both completed successfully.

The deeper issue: `extractErrorPatterns` calls nothing that can throw in the current implementation, but `recordErrorPatterns` calls `getUserId()` which throws when unauthenticated (errorAnalysis.ts line 30-35). In dev mode (no auth), this crashes the entire evaluation path.

**Fix:** Move `setEvaluation(evalResult)` before the persistence calls, and wrap the background tasks (error patterns + XP) in a separate try/catch that logs but does not surface as a UI error:

```typescript
const handleAudioReady = async (blob: Blob, base64: string) => {
  setIsEvaluating(true);
  setError(null);
  setUserAudioBase64(base64);
  try {
    const transcription = await speechToText(blob);
    const evalPrompt = getEvaluationPrompt(prompt, transcription, config.evalType, tone);
    const evalResponse = await chatCompletion(
      'You are an expert English language evaluator. Respond only with valid JSON.',
      evalPrompt,
    );
    const cleanResponse = cleanJson(evalResponse);
    const evalResult: EvaluationResult = JSON.parse(cleanResponse);
    evalResult.userTranscription = transcription;

    // Show evaluation immediately — user should always see their result
    setEvaluation(evalResult);

    // Background persistence: do not block or replace the evaluation on failure
    try {
      const exerciseSessionId = `exercise_${Date.now()}`;
      const patterns = await extractErrorPatterns(evalResult, prompt, exerciseSessionId);
      await recordErrorPatterns(patterns);
      let xp = XP_PER_EXERCISE;
      if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
      await addXP(xp);
      await syncGamificationState();
    } catch (persistErr) {
      console.warn('Background persistence failed (evaluation still shown):', persistErr);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Evaluation failed');
  } finally {
    setIsEvaluating(false);
  }
};
```

---

## Warnings

### WR-01: Division-by-zero when `recentScores` is empty in `criticalErrors` sort

**File:** `src/services/errorAnalysis.ts:124-128`

**Issue:** `criticalErrors` sorts by average of `recentScores`, but `recentScores` can be an empty array (e.g. a pattern loaded from DB where the column is empty/null). Division by zero produces `NaN`, and `NaN - NaN` in the comparator returns `0`, causing an unstable sort that silently produces incorrect ordering.

```typescript
const aAvg = a.recentScores.reduce((x, y) => x + y, 0) / a.recentScores.length  // NaN if length === 0
const bAvg = b.recentScores.reduce((x, y) => x + y, 0) / b.recentScores.length  // NaN
```

**Fix:**
```typescript
const safeAvg = (scores: number[]) =>
  scores.length > 0 ? scores.reduce((x, y) => x + y, 0) / scores.length : 0;

.sort((a, b) => safeAvg(a.recentScores) - safeAvg(b.recentScores))
```

---

### WR-02: `guessCategory` article-detection regex matches ordinary English sentences

**File:** `src/services/errorAnalysis.ts:229-232`

**Issue:** The fallback regex for article detection matches patterns like `(a|an|the)` combined with `(instead|use|should)`. The word `"a"` is an extremely common English word. A correction like `"Use a simpler structure instead"` or `"You should use a verb here"` will match this regex and be categorised as `'article'`, even though the correction has nothing to do with article usage. This causes systematic mis-categorisation.

```typescript
if (/\b(a|an|the)\b.*\b(instead|use|should)\b/i.test(lower) ||
    /\b(instead|use|should)\b.*\b(a|an|the)\b/i.test(lower)) {
  return 'article'
}
```

**Fix:** Add a minimum specificity requirement — the article must appear adjacent to a noun or be the clear subject of the correction. At minimum, restrict `a` to word-boundary matches that are not sandwiched in other phrases. Alternatively, drop `'a'` from the fallback regex entirely (the keyword branch on line 207 already handles `'article'` when the word "article" appears in the correction):

```typescript
// Only the unambiguous articles 'an' and 'the' in fallback context
if (/\b(an|the)\b.*\b(instead|use|should)\b/i.test(lower) ||
    /\b(instead|use|should)\b.*\b(an|the)\b/i.test(lower)) {
  return 'article'
}
```

---

### WR-03: Non-null assertion after null-safe guard in `recordSessionSnapshot`

**File:** `src/services/errorAnalysis.ts:476-478`

**Issue:** The condition `(snapshots || []).length > 100` guards against `snapshots` being `null`, but inside the branch `snapshots!.slice(100)` uses a non-null assertion. If Supabase returns `null` for `data` and the `|| []` branch fires, the length check passes only when there are >100 items, which requires `snapshots` to be non-null. The non-null assertion is correct in this specific case but fragile — a code reader cannot see why it is safe, and it will silently fail if the condition is ever changed.

```typescript
if ((snapshots || []).length > 100) {
  const toDelete = snapshots!.slice(100).map(snapshot => snapshot.id)  // fragile
```

**Fix:** Use the already-materialised array:

```typescript
const snapshotList = snapshots || [];
if (snapshotList.length > 100) {
  const toDelete = snapshotList.slice(100).map(snapshot => snapshot.id);
```

---

### WR-04: `syncGamificationState` never called after `addXP` in exercise evaluation

**File:** `src/components/discovery/ExerciseMode.tsx:186-188`

**Issue:** `addXP(xp)` is called but `syncGamificationState()` is not. The gamification sync only runs inside `handleSaveToLibrary` (line 213). If the user records an answer but never saves the card to the library, XP is added locally but is never flushed to Supabase. This creates a divergence between in-memory state and the remote database.

**Fix:** Call `syncGamificationState()` immediately after `addXP(xp)` in `handleAudioReady` (as shown in the CR-01 fix block above).

---

## Info

### IN-01: `getCardsForWeakArea` with category `'other'` returns unbounded fallback set

**File:** `src/services/errorAnalysis.ts:368-369`

**Issue:** When `themeKeywords` is empty (category `'other'`), the filter returns `true` for every card with a low score, with no size limit applied before the downstream `.slice(0, 10)`. This is fine for now with the 10-item slice, but the intermediate `matchingCards` array can be very large. The comment `// 'other' returns all low-scoring` confirms intent, but the unbounded intermediate collection is worth noting as the card library grows.

**Suggestion:** Apply the `.slice(0, 10)` limit earlier or document the intentional behavior explicitly to avoid future confusion when the library is large.

---

### IN-02: `Partial<Record<ErrorCategory, string[]>>` is misleading — all keys are populated

**File:** `src/services/errorAnalysis.ts:349`

**Issue:** `categoryToCardThemes` is typed as `Partial<Record<ErrorCategory, string[]>>` but all 10 `ErrorCategory` values are present as keys. The `Partial` annotation implies some keys may be absent, which forces the `|| []` fallback on line 364. In practice the fallback is never needed. The type annotation does not match the actual data structure.

**Suggestion:** Change to `Record<ErrorCategory, string[]>` to make the type accurate and remove the dead fallback:

```typescript
const categoryToCardThemes: Record<ErrorCategory, string[]> = { ... }
// Line 364 becomes:
const themeKeywords = categoryToCardThemes[weakArea];
```

---

_Reviewed: 2026-04-11T15:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
