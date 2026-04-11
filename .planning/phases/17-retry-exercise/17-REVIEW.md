---
phase: 17-retry-exercise
reviewed: 2026-04-11T20:37:10Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/discovery/ExerciseMode.tsx
  - src/components/discovery/ImageMode.tsx
  - src/components/live-roleplay/LiveRoleplayPage.tsx
  - src/components/live-roleplay/ConversationAnalysis.tsx
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-11T20:37:10Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed 4 source files added or modified in the retry-exercise phase: `ExerciseMode.tsx` and `ImageMode.tsx` (discovery exercise modes) and `LiveRoleplayPage.tsx` and `ConversationAnalysis.tsx` (live roleplay flow). All four files implement the retry-same-exercise feature via `retrySame()` / `handleRetryScenario()` handlers that clear evaluation state while preserving the active prompt/scenario.

The retry logic itself is correct in all four components — state resets are complete and consistent. The main issues found are: unguarded async save operations that surface unhandled rejections to users, a missing `syncGamificationState()` call in `ImageMode.handleAudioReady` creating an inconsistency between components, and an XP/persistence block in `ConversationAnalysis.analyzeConversation` that can abort a successful analysis when persistence fails.

No critical (security or data-loss) issues were found in this file set.

## Warnings

### WR-01: Unhandled rejection in ExerciseMode handleSaveToLibrary crashes silently

**File:** `src/components/discovery/ExerciseMode.tsx:221-223`
**Issue:** `handleSaveToLibrary` awaits `addCard(card)` and `syncGamificationState()` without a try/catch. If either throws (e.g., Supabase is offline, localStorage quota exceeded), the promise rejects and the error propagates to the `void handleSaveToLibrary()` call site at line 459. The `void` operator discards the rejection silently — no error is shown to the user, `setSaved(true)` at line 223 is never reached, and the user cannot tell if saving succeeded or failed.
**Fix:**
```typescript
const handleSaveToLibrary = async () => {
  if (!evaluation) return;
  const card = createDefaultCard({ /* ... */ });
  try {
    await addCard(card);
    await syncGamificationState();
    setSaved(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Falha ao salvar na biblioteca');
  }
};
```

### WR-02: Missing syncGamificationState() after addXP in ImageMode.handleAudioReady

**File:** `src/components/discovery/ImageMode.tsx:74-76`
**Issue:** After evaluation succeeds, `ImageMode.handleAudioReady` calls `await addXP(xp)` but does not call `syncGamificationState()`. `ExerciseMode.handleAudioReady` (line 193) calls both. Without `syncGamificationState()`, the gamification state in memory and in storage goes out of sync: `addXP` saves raw XP to storage, but the runtime state singleton is not updated and the `gamification-update` event is not dispatched. The XP bar and streak UI will not reflect the earned XP until the next navigation or sync elsewhere.
**Fix:**
```typescript
let xp = XP_PER_EXERCISE;
if (evalResult.score >= 9) xp += XP_PER_PERFECT_SCORE;
await addXP(xp);
await syncGamificationState(); // add this line — dispatches gamification-update event
```

### WR-03: Unhandled rejection in ImageMode.handleSaveToLibrary crashes silently

**File:** `src/components/discovery/ImageMode.tsx:93-95`
**Issue:** Same pattern as WR-01 in ExerciseMode. `addCard(card)` and `syncGamificationState()` are awaited without try/catch. Errors are silently swallowed by the `void handleSaveToLibrary()` call at line 195.
**Fix:**
```typescript
const handleSaveToLibrary = async () => {
  if (!evaluation) return;
  const card = createDefaultCard({ /* ... */ });
  try {
    await addCard(card);
    await syncGamificationState();
    setSaved(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Falha ao salvar na biblioteca');
  }
};
```

### WR-04: XP/persistence failure in ConversationAnalysis aborts analysis display

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:88-121`
**Issue:** In `analyzeConversation`, `setAnalysis(data)` is called at line 87 (making the analysis available), but then `addXP`, `saveLiveSession`, `createSessionReport`, and `recordSessionSnapshot` are all awaited inside the same try block (lines 89-121). If any of these persistence calls throw, the catch at line 122 sets `setError(...)` and the user sees an error screen — even though `setAnalysis(data)` has already been called with a valid result. The analysis was successful; only the persistence failed. The user loses their conversation analysis entirely due to a background save error.

This is the inverse of how `ExerciseMode.handleAudioReady` handles it (lines 186-197): ExerciseMode explicitly separates the main evaluation from background persistence so that a persistence failure does not replace the shown result with an error.
**Fix:** Move the persistence block into its own try/catch after the main result is set, mirroring the ExerciseMode pattern:
```typescript
const data: AnalysisData = JSON.parse(cleanResponse);
setAnalysis(data); // show result to user immediately

// Background persistence: do not block or replace analysis on failure
try {
  await addXP(XP_PER_LIVE_SESSION);
  const sessionData: LiveSessionData = { /* ... */ };
  await saveLiveSession(sessionData);
  await createSessionReport(/* ... */);
  await recordSessionSnapshot();
} catch (persistErr) {
  console.warn('Background persistence failed (analysis still shown):', persistErr);
}
```

## Info

### IN-01: onRetry prop is optional but "Tentar Novamente" button always renders

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:24,426`
**Issue:** The `ConversationAnalysisProps` interface declares `onRetry?: () => void` (optional). The "Tentar Novamente" button at line 426 is always rendered with `onClick={onRetry}`. If a future call site omits `onRetry`, the button appears but does nothing when clicked. There is no visual differentiation or conditional rendering to hide the button when retry is not supported. The current call site in `LiveRoleplayPage.tsx` always passes `onRetry`, so this is not a current bug.
**Fix:** Either make `onRetry` required (remove the `?`), or conditionally render the button:
```typescript
{onRetry && (
  <Button variant="primary" size="lg" onClick={onRetry} className="w-full rounded-2xl cursor-pointer">
    <RotateCcw size={18} />
    Tentar Novamente
  </Button>
)}
```

### IN-02: analyzeConversation runs unconditionally on mount and re-runs on prop identity change

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:158-160`
**Issue:** `useEffect(() => { analyzeConversation(); }, [analyzeConversation])` triggers whenever the `analyzeConversation` callback reference changes. `analyzeConversation` is memoized with `useCallback` but depends on `[scenario, turns]` (line 127). Since `turns` is an array, a new reference (e.g., from `setTurns([])` in `handleRetryScenario`) will produce a new callback and re-trigger analysis. In the current `handleRetryScenario` flow, the component is unmounted and remounted (phase changes to `'conversation'` first), so re-analysis doesn't happen inadvertently. However, if `ConversationAnalysis` were ever kept mounted across retries, this would silently re-fire the expensive analysis API call. The dependency could be made more explicit.
**Fix:** For robustness, run the effect only on mount:
```typescript
useEffect(() => {
  analyzeConversation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // intentionally runs only on mount; scenario and turns are captured via closure
```

### IN-03: Magic number 7 in ImageMode scene selection

**File:** `src/components/discovery/ImageMode.tsx:45`
**Issue:** `Math.floor(Math.random() * 7)` hardcodes the array length as `7`. If the scene list is extended or shortened, this number must be updated manually. A mismatch causes the last element to never be selected (if too small) or `undefined` to be selected (if too large).
**Fix:**
```typescript
const scenes = [
  'a bustling street market with distinct colorful stalls',
  'a cozy, warm-lit coffee shop interior',
  // ...
];
const scene = scenes[Math.floor(Math.random() * scenes.length)];
```

---

_Reviewed: 2026-04-11T20:37:10Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
