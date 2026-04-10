---
phase: 15-model-fallback
reviewed: 2026-04-10T08:55:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/components/settings/SettingsPage.tsx
  - src/components/discovery/ExerciseMode.tsx
  - src/components/live-roleplay/LiveSession.tsx
  - src/config/images.ts
  - src/services/errorAnalysis.ts
  - src/services/openai.test.ts
  - src/services/openai.ts
  - src/services/supabase/aiProxy.ts
  - src/services/supabase/storage.ts
  - src/types/settings.ts
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-04-10T08:55:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed 10 source files implementing model fallback configuration, AI service dispatch, and supporting UI. The codebase is well-structured overall with a clean fallback pattern in `openai.ts`, comprehensive test coverage for fallback scenarios, and a thorough settings UI for configuring fallback models.

Key concerns: `images.ts` reads model config from localStorage instead of the runtime state module, which can return stale data after Supabase hydration. `LiveSession.tsx` has an unstable `onEnd` reference in its effect dependency array that could cause session reconnection on parent re-renders. `addCard` in Supabase storage mutates its input argument as a side effect.

## Warnings

### WR-01: getImageConfigAuto reads stale localStorage data instead of runtime state

**File:** `src/config/images.ts:166`
**Issue:** `getImageConfigAuto` calls `getModelConfigImport()` which imports `getModelConfig` from `../../services/storage` (the localStorage module). After login, the app hydrates runtime state from Supabase via `runtimeState.ts` and updates it in memory. However, `getImageConfigAuto` bypasses the runtime state entirely and reads directly from localStorage, which may be stale or out of sync with the current in-memory configuration. This means image generation could use the wrong provider/model if the user changed settings in the current session.
**Fix:**
```typescript
// In src/config/images.ts, change the import:
import { getRuntimeModelConfig } from '../services/runtimeState';

// Then in getImageConfigAuto:
export function getImageConfigAuto(context: ImageContext): ImageOptions {
  const config = getRuntimeModelConfig();
  return getImageConfig(context, config.imageSource);
}
```

### WR-02: LiveSession effect re-creates session on every parent re-render

**File:** `src/components/live-roleplay/LiveSession.tsx:86`
**Issue:** The `useEffect` that creates the `GeminiLiveSession` has `onEnd` in its dependency array (line 86). If the parent component does not memoize `onEnd` with `useCallback`, every parent re-render will produce a new function reference, causing the effect to re-run. This disconnects and reconnects the live audio session, losing any in-progress conversation. This is a latent bug that depends on the parent's implementation.
**Fix:** Either memoize `onEnd` at the call site, or refactor the effect to use a ref for the callback:
```typescript
const onEndRef = useRef(onEnd);
onEndRef.current = onEnd;

useEffect(() => {
  // ... create session, using onEndRef.current in callbacks
  return () => session.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [scenario, checkForFarewell]); // remove onEnd from deps
```

### WR-03: addCard mutates input argument as a side effect

**File:** `src/services/supabase/storage.ts:133`
**Issue:** `addCard` assigns `card.id = insertedCard.id` on line 133, mutating the input `Card` object that was passed in. This is a surprising side effect — callers do not expect their object to be modified. If the caller holds a reference and uses it later (e.g., for comparison or display), the mutated ID could cause subtle bugs.
**Fix:**
```typescript
// Return the generated ID instead of mutating the input:
export async function addCard(card: Card): Promise<string> {
  const userId = getUserId();
  const { data: insertedCard, error } = await supabase
    .from('cards')
    .insert({ ... })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to add card: ${error.message}`);
  return insertedCard.id;
}
```

### WR-04: Division by zero in buildErrorStats when recentScores is empty

**File:** `src/services/errorAnalysis.ts:125`
**Issue:** The `criticalErrors` sort comparator divides `a.recentScores.reduce(...) / a.recentScores.length`. While the filter on line 123 requires `occurrences >= 3`, the `recentScores` array could theoretically be empty (e.g., if a pattern was inserted via a code path that sets `recentScores: []`). Division by zero would produce `NaN`, causing the sort to behave unpredictably.
**Fix:**
```typescript
const aAvg = a.recentScores.length > 0
  ? a.recentScores.reduce((x, y) => x + y, 0) / a.recentScores.length
  : 0;
const bAvg = b.recentScores.length > 0
  ? b.recentScores.reduce((x, y) => x + y, 0) / b.recentScores.length
  : 0;
```

## Info

### IN-01: detectSource uses fragile prefix matching for provider routing

**File:** `src/services/openai.ts:23-38`
**Issue:** The `detectSource` function routes models to providers using hardcoded prefix checks. New Groq models with unrecognized prefixes (e.g., a future `mistralai/` model on Groq) would be misrouted to OpenRouter instead. This is fragile and will require updates as providers add new models. The existing tests cover current models correctly, but the pattern is maintenance-heavy.
**Fix:** Consider maintaining a model-to-source lookup table in `settings.ts` alongside the model option lists, or adding a `source` field to model override parameters so callers specify the provider explicitly.

### IN-02: withFallback retains unused parameters for API compatibility

**File:** `src/services/supabase/aiProxy.ts:256-265`
**Issue:** The `withFallback` function accepts `_fallbackCall` and `useFallback` parameters but never executes the fallback. This is explicitly intentional (SEC-04 comment) but the function signature is misleading for new developers. Any caller still passing a fallback function is writing dead code.
**Fix:** Consider marking the function as `@deprecated` with a JSDoc note, or removing it entirely and updating callers to call `proxyCall()` directly.

### IN-03: Direct localStorage reads in SettingsPage for key presence checks

**File:** `src/components/settings/SettingsPage.tsx:381,393,405,417`
**Issue:** The `hint` prop on API key inputs reads directly from `localStorage.getItem(...)` instead of using the `storage.ts` abstraction layer. While this is read-only and does not bypass security, it couples the component to the internal `el_` key prefix convention used by `storage.ts`.
**Fix:** Use the `KEYS` constants from `storage.ts` for the localStorage key names, or better yet, expose a helper function that checks key presence.

### IN-04: guessCategory uses broad substring matching that over-classifies

**File:** `src/services/errorAnalysis.ts:196-220`
**Issue:** The `guessCategory` function matches on very common English words. For example, any correction mentioning "a " or "the " (extremely common in English text) will be classified as `article` errors rather than the actual error type. Similarly, "word" triggers `vocabulary` even in contexts like "word order". This leads to noisy error categorization.
**Fix:** Consider using word-boundary regex patterns (e.g., `/\bthe\b/` instead of `'the '`), or ordering the checks from most specific to least specific, with `article` and `vocabulary` checked last.

---

_Reviewed: 2026-04-10T08:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
