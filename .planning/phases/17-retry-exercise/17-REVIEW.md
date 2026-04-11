---
phase: 17-retry-exercise
reviewed: 2026-04-11T14:30:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/discovery/ExerciseMode.tsx
  - src/components/discovery/ImageMode.tsx
  - src/components/live-roleplay/LiveRoleplayPage.tsx
  - src/components/live-roleplay/ConversationAnalysis.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-11T14:30:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed 4 source files added in the retry-exercise phase: `ExerciseMode.tsx` and `ImageMode.tsx` (both in `src/components/discovery/`) and `LiveRoleplayPage.tsx` and `ConversationAnalysis.tsx` (in `src/components/live-roleplay/`). These files implement the "Tentar Novamente" (retry same exercise) flow across all three practice modes.

The retry logic itself (`retrySame` / `handleRetryScenario`) is correctly implemented — state is partially reset while preserving the exercise prompt, image URL, or scenario. The `LiveRoleplayPage` orchestrator cleanly manages phase transitions.

Three warnings were found: a stale closure in `ConversationAnalysis` that misses `tone` in its `useCallback` dependency array, an unhandled `audio.play()` promise that can cause the full-dialogue playback loop to hang permanently under browser autoplay restrictions, and a double-fire of expensive side effects (XP, session save) in React Strict Mode due to `useEffect` calling `analyzeConversation` without an idempotency guard. Three info items cover missing JSON shape validation, a missing accent in a repeated button label, and a minor architectural inconsistency in navigation.

## Warnings

### WR-01: Stale `tone` closure in `analyzeConversation` useCallback

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:80,127`
**Issue:** `analyzeConversation` uses `tone` (line 80: `getConversationAnalysisPrompt(turns, tone)`) but `tone` is not listed in the `useCallback` dependency array (line 127: `}, [scenario, turns]`). If `tone` were ever updated after mount, `analyzeConversation` would capture a stale value. While `tone` is currently initialized once via `useState(() => getConversationTone())` and never updated, the missing dependency is a latent bug: any future change that makes `tone` reactive (e.g., reading from a context or a settings update event) would silently use the wrong value, affecting the quality of the analysis prompt without any error.
**Fix:**
```typescript
}, [scenario, turns, tone]);
```
Add `tone` to the dependency array on line 127.

### WR-02: Unhandled `audio.play()` promise causes infinite hang on autoplay block

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:182`
**Issue:** `audio.play()` returns a Promise that rejects when the browser's autoplay policy blocks playback (common when no recent user interaction has occurred, or in low-power mode). The current code ignores this promise entirely. When the browser blocks autoplay, neither `audio.onended` nor `audio.onerror` is called, so the Promise returned by `playAudioAndWait` never resolves or rejects. The `playFullDialogue` loop `await`s this promise on every line (line 194), causing the UI to permanently freeze in the "playing" state (`isPlayingDialogue=true`) with no way to exit except a page refresh.
**Fix:**
```typescript
const playAudioAndWait = useCallback((url: string): Promise<void> => {
  return new Promise<void>((resolve) => {
    stopCurrentAudio();
    const audio = new Audio(url);
    currentAudioRef.current = audio;
    audio.onended = () => {
      currentAudioRef.current = null;
      resolve();
    };
    audio.onerror = () => {
      currentAudioRef.current = null;
      resolve();
    };
    audio.play().catch(() => {
      // Autoplay blocked — resolve so the caller is not left hanging
      currentAudioRef.current = null;
      resolve();
    });
  });
}, []);
```

### WR-03: Side effects fire twice in React Strict Mode (XP, session save, session report)

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:158-160`
**Issue:** `app/main.tsx` wraps the app in `<StrictMode>`, which intentionally double-invokes effects in development to surface non-idempotent code. The `useEffect` at line 158 calls `analyzeConversation()` unconditionally on every run. `analyzeConversation` awards XP (`addXP`), saves the session (`saveLiveSession`), creates a session report (`createSessionReport`), and records an error snapshot (`recordSessionSnapshot`) — all inside a single async call (lines 89-121). In Strict Mode development builds, this entire side effect sequence fires twice, awarding double XP and writing duplicate session records. Because there is no run-once guard, any re-render that causes the `analyzeConversation` identity to change (e.g., `scenario` or `turns` reference updates from the parent) would also re-trigger this in production.
**Fix:** Add a ref guard to ensure the analysis and its side effects run at most once per component mount:
```typescript
const hasAnalyzedRef = useRef(false);

useEffect(() => {
  if (hasAnalyzedRef.current) return;
  hasAnalyzedRef.current = true;
  analyzeConversation();
}, [analyzeConversation]);
```

## Info

### IN-01: No shape validation after `JSON.parse` on AI evaluation responses

**File:** `src/components/discovery/ExerciseMode.tsx:180`, `src/components/discovery/ImageMode.tsx:70`
**Issue:** Both files cast the result of `JSON.parse(cleanResponse)` directly to `EvaluationResult` without validating that required fields (`score`, `corrections`, `betterAlternatives`, etc.) are present and of the correct type. If the AI returns a valid JSON object that is missing `score` or returns it as a string, code like `evalResult.score >= 9` (ExerciseMode line 189, ImageMode line 75) will silently compare `undefined >= 9` (false) or `"9" >= 9` (true via coercion), producing incorrect XP awards. `EvaluationResults` rendering code that maps over `corrections` and `betterAlternatives` will throw if those fields are missing.
**Fix:** Add a minimal shape guard after parsing:
```typescript
const evalResult = JSON.parse(cleanResponse) as EvaluationResult;
if (typeof evalResult.score !== 'number' || !Array.isArray(evalResult.corrections)) {
  throw new Error('Unexpected evaluation format from AI. Please try again.');
}
```

### IN-02: Typo in button label — missing accent on "Exercício"

**File:** `src/components/discovery/ExerciseMode.tsx:469`, `src/components/discovery/ImageMode.tsx:208`
**Issue:** Both files render the label "Novo Exercicio" (missing the acute accent on the "i"). The correct Portuguese spelling is "Novo Exercício". The project uses proper Portuguese accents elsewhere (e.g., "Exercício" in other UI strings), so this is an inconsistency that is visible to users.
**Fix:**
```tsx
// ExerciseMode.tsx line 469
Novo Exercício

// ImageMode.tsx line 208
Novo Exercício
```

### IN-03: `ConversationAnalysis` navigates directly to `/history` bypassing parent phase state

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:434`
**Issue:** The "Ver Historico" button calls `navigate('/history')` directly inside `ConversationAnalysis`. This bypasses the parent `LiveRoleplayPage` phase state machine, which tracks `phase`, `scenario`, and `turns`. If any cleanup or state reset is expected when leaving the roleplay flow (currently handled by `handleExit`), navigating directly from a child component skips it. This also breaks the parent's assumption that the `analysis` phase is exited only via `onReset` or `onRetry`. The inconsistency is minor now but could cause issues if `LiveRoleplayPage` adds cleanup logic or audio teardown in `handleExit`.
**Fix:** Expose a callback prop (e.g., `onViewHistory?: () => void`) from `ConversationAnalysis` that the parent can handle, then calling `handleExit` followed by `navigate('/history')`.

---

_Reviewed: 2026-04-11T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
