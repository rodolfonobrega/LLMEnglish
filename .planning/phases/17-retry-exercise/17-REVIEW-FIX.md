---
phase: 17-retry-exercise
fixed_at: 2026-04-11T12:00:00Z
review_path: .planning/phases/17-retry-exercise/17-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 8
skipped: 1
status: partial
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-11T12:00:00Z
**Source review:** .planning/phases/17-retry-exercise/17-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 9
- Fixed: 8
- Skipped: 1

## Fixed Issues

### CR-01: CORS wildcard origin in production edge function

**Files modified:** `supabase/functions/ai-proxy/index.ts`
**Commit:** 5701123
**Applied fix:** Replaced `Access-Control-Allow-Origin: *` with `Deno.env.get('SITE_URL') || 'http://localhost:5173'` to restrict CORS to the configured site URL.

### CR-02: Insecure JWT construction using btoa in Vertex auth

**Files modified:** `supabase/functions/ai-proxy/providers/vertex.ts`, `supabase/functions/ai-proxy/index.ts`
**Commit:** 37262b1
**Applied fix:** Added `base64urlEncode` and `uint8ToBase64url` helpers that convert standard base64 to URL-safe base64 (replacing `+/=` with `-_` and stripping padding). Updated JWT header/payload construction and signature encoding in both vertex.ts and the inline copy in index.ts.

### CR-03: Plaintext API key exposed during auto-migration

**Files modified:** `supabase/functions/ai-proxy/index.ts`
**Commit:** dd6a184
**Applied fix:** Wrapped the `saveApiKey` call in a try/catch with `await`, added logging for successful migration and error reporting for failed migrations. Previously the call was fire-and-forget with no error handling.

### WR-01: Stale closure in LiveSession useEffect callback

**Files modified:** `src/components/live-roleplay/LiveSession.tsx`
**Commit:** 960a74d
**Applied fix:** Added `onEndRef` ref to hold the latest `onEnd` callback. Updated `onTurnComplete` to use `onEndRef.current` instead of the closure-captured `onEnd`. Removed `onEnd` from the useEffect dependency array to prevent session reconnection on every parent re-render.

### WR-02: Race condition in useAudioRecorder stopRecording

**Files modified:** `src/hooks/useAudioRecorder.ts`
**Commit:** 6ecefa5
**Applied fix:** Added `isRecordingRef` ref for synchronous recording state access. Set the ref alongside React state in `startRecording` and `onstop`. Updated `stopRecording` to check `isRecordingRef.current` instead of stale `state.isRecording`, and removed the dependency on `state.isRecording` from the callback.

### WR-03: Unchecked JSON.parse in ReviewPage evaluation handler

**Files modified:** `src/components/review/ReviewPage.tsx`
**Commit:** 7a88d07
**Applied fix:** Wrapped `JSON.parse(evalResponse)` in a dedicated try/catch that throws a user-friendly error on parse failure. Added shape validation to check that `score` is a number and `corrections` is an array before proceeding.

### WR-04: GeminiSTT in edge function ignores model parameter

**Files modified:** `supabase/functions/ai-proxy/providers/gemini.ts`, `supabase/functions/ai-proxy/index.ts`
**Commit:** d5d2b47
**Applied fix:** Added `model` parameter to the `stt` function signature in gemini.ts and to the inline `geminiSTT` in index.ts. Updated the function body to use the passed `model` instead of hardcoded `'gemini-2.5-flash'`. Updated the call site in index.ts to pass the `model` variable.

### WR-05: Index used as React key in chat history rendering

**Files modified:** `src/components/live-roleplay/LiveSession.tsx`
**Commit:** 2091fca
**Applied fix:** Changed `key={i}` to `key={`${turn.role}-${turn.timestamp}-${i}`}` for a stable composite key combining role, timestamp, and index.

## Skipped Issues

### WR-06: Duplicate code between index.ts and extracted provider modules

**File:** `supabase/functions/ai-proxy/index.ts` (lines 216-1054) vs `supabase/functions/ai-proxy/providers/*.ts`
**Reason:** Large-scale refactor requiring careful planning to avoid breaking the edge function. Importing from provider modules and removing 800+ lines of inline code carries significant risk of introducing regressions. This should be addressed as a dedicated refactoring task.
**Original issue:** The edge function index.ts contains full inline implementations of all provider functions duplicated almost verbatim in the extracted provider modules.

---

_Fixed: 2026-04-11T12:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
