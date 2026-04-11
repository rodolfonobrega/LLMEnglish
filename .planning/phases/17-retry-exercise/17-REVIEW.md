---
phase: 17-retry-exercise
reviewed: 2026-04-10T12:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/discovery/ExerciseMode.tsx
  - src/components/discovery/ImageMode.tsx
  - src/components/live-roleplay/LiveRoleplayPage.tsx
  - src/components/live-roleplay/ConversationAnalysis.tsx
findings:
  critical: 0
  warning: 6
  info: 1
  total: 7
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed four components related to exercise modes (phrase/text/roleplay), image-based exercises, and live roleplay with conversation analysis. The retry exercise pattern is well-implemented across all modes. The main concerns are: (1) missing semicolons on async await lines that risk compilation failures under strict TypeScript, (2) a dead-code validation guard in ExerciseMode, (3) an optional callback passed to onClick without null-checking in ConversationAnalysis, and (4) unguarded JSON.parse calls that produce generic error messages masking parse failures.

## Warnings

### WR-01: Missing semicolons on async calls in ExerciseMode

**File:** `src/components/discovery/ExerciseMode.tsx:187,191`
**Issue:** Lines `await recordErrorPatterns(patterns)` and `await addXP(xp)` are missing trailing semicolons. Under `strict: true` with `noUncheckedSideEffectImports` and ASI rules, this can cause parsing ambiguity or unexpected behavior when statements are on consecutive lines.
**Fix:**
```typescript
await recordErrorPatterns(patterns);  // line 187
// ...
await addXP(xp);  // line 191
```

### WR-02: Missing semicolons on async calls in ImageMode

**File:** `src/components/discovery/ImageMode.tsx:77,94`
**Issue:** Lines `await addXP(xp)` (77) and `await addCard(card)` (94) are missing trailing semicolons. Same ASI risk as WR-01.
**Fix:**
```typescript
await addXP(xp);  // line 77
// ...
await addCard(card);  // line 94
```

### WR-03: Missing semicolons on async calls in ConversationAnalysis

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:89,107,121`
**Issue:** Lines `await addXP(XP_PER_LIVE_SESSION)` (89), `await saveLiveSession(sessionData)` (107), and `await recordSessionSnapshot()` (121) are missing trailing semicolons.
**Fix:**
```typescript
await addXP(XP_PER_LIVE_SESSION);     // line 89
await saveLiveSession(sessionData);    // line 107
await recordSessionSnapshot();         // line 121
```

### WR-04: Dead-code validation guard in ExerciseMode

**File:** `src/components/discovery/ExerciseMode.tsx:143-147`
**Issue:** The check `if (!theme && !context?.trim())` can never trigger because `theme` is initialized to `'random'` (line 111) and `ThemeSelector` does not expose a way to set it to a falsy value. This dead guard gives false confidence that empty inputs are validated. If `ThemeSelector` behavior changes, this could silently break.
**Fix:** Either remove the dead guard or validate against `'random'` explicitly if the intent is to require a specific theme:
```typescript
// If the intent is to require user input:
if (theme === 'random' && !context?.trim()) {
  setError('Selecione um tema ou escreva um topico especifico.');
  setIsGenerating(false);
  return;
}
```

### WR-05: Optional onRetry callback passed to onClick without null check

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:426`
**Issue:** `onRetry` is typed as `onRetry?: () => void` (optional), but is passed directly as `onClick={onRetry}` on line 426. If the parent does not supply `onRetry`, the button renders but does nothing on click. The button should either be hidden when `onRetry` is undefined, or the prop should be required.
**Fix:**
```typescript
{onRetry && (
  <Button variant="primary" size="lg" onClick={onRetry} className="w-full rounded-2xl cursor-pointer">
    <RotateCcw size={18} />
    Tentar Novamente
  </Button>
)}
```

### WR-06: Unguarded JSON.parse produces generic error messages

**File:** `src/components/discovery/ExerciseMode.tsx:181`, `src/components/discovery/ImageMode.tsx:71`, `src/components/live-roleplay/ConversationAnalysis.tsx:86`
**Issue:** `JSON.parse(cleanResponse)` is called without a dedicated try/catch around the parse step. If the AI returns malformed JSON that `cleanJson` cannot fix, the error caught by the outer catch will be a generic SyntaxError displayed as "Evaluation failed" or "Analysis failed" -- hiding the actual cause. This makes debugging harder for users and developers.
**Fix:** Wrap the parse in its own try/catch with a descriptive message:
```typescript
let evalResult: EvaluationResult;
try {
  evalResult = JSON.parse(cleanResponse);
} catch {
  throw new Error('AI returned invalid evaluation format. Please try again.');
}
```

## Info

### IN-01: Zero-duration session when turns array is empty

**File:** `src/components/live-roleplay/ConversationAnalysis.tsx:104`
**Issue:** When `turns` is empty, `startedAt` falls back to `Date.now()` and `endedAt` is also `Date.now()`, creating a zero-duration session record. This is a minor data quality issue rather than a bug, since `ConversationAnalysis` is only rendered after a conversation with turns.
**Fix:** Consider adding a guard: `if (turns.length === 0) { onReset(); return; }` at the top of `analyzeConversation`.

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
