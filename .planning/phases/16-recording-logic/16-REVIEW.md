---
phase: 16-recording-logic
reviewed: 2026-04-10T22:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/services/geminiLive.ts
  - src/services/geminiLive.test.ts
  - public/worklets/pcm-processor.js
  - src/hooks/useAudioRecorder.ts
  - src/hooks/useAudioRecorder.test.ts
  - src/components/review/ReviewPage.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-04-10T22:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed 6 files changed during phase 16 (recording-logic). The phase delivered a new PCM AudioWorklet processor, blob URL memory leak fixes in useAudioRecorder, and a type signature fix in ReviewPage. The core fixes (blob URL revocation, stream safety net, type correction) are sound and well-tested. Key concerns: geminiLive.ts still uses the deprecated ScriptProcessorNode despite the AudioWorklet file being created (migration appears incomplete), an unvalidated JSON.parse in ReviewPage, and a stale-closure risk pattern in useAudioRecorder's stopRecording dependency.

## Warnings

### WR-01: ScriptProcessorNode still used despite AudioWorklet file being created

**File:** `src/services/geminiLive.ts:238`
**Issue:** Line 238 uses `this.inputAudioCtx.createScriptProcessor(4096, 1, 1)` which is a deprecated API. The new `public/worklets/pcm-processor.js` worklet was created in this phase but is never imported or used in `geminiLive.ts`. The code comment and SUMMARY reference "AudioWorklet migration" but the migration is incomplete -- the worklet exists but the session class still uses the deprecated path. This means the worklet code is dead code until wired up.
**Fix:** Complete the migration by replacing `createScriptProcessor` with `audioContext.audioWorklet.addModule('/worklets/pcm-processor.js')` and creating an `AudioWorkletNode`. Alternatively, if the migration is deferred to a later phase, document this clearly in the file.

### WR-02: Unvalidated JSON.parse of AI response in ReviewPage

**File:** `src/components/review/ReviewPage.tsx:76`
**Issue:** `JSON.parse(evalResponse)` parses an AI-generated string into an `EvaluationResult` object without validating its shape. If the AI returns malformed JSON or an object missing expected fields (e.g., `score`, `corrections`), the parsed result is cast directly to `EvaluationResult` and used downstream, potentially causing runtime errors when accessing undefined properties (e.g., `evalResult.score` on line 81).
**Fix:** Add a runtime check after parsing:
```typescript
const parsed = JSON.parse(evalResponse);
if (typeof parsed.score !== 'number' || !Array.isArray(parsed.corrections)) {
  throw new Error('Invalid evaluation response from AI');
}
const evalResult = parsed as EvaluationResult;
```

### WR-03: stopRecording callback recreated on every isRecording state change

**File:** `src/hooks/useAudioRecorder.ts:91-100`
**Issue:** `stopRecording` has `state.isRecording` in its `useCallback` dependency array (line 100). Since `stopRecording` only reads `state.isRecording` as a guard, every time `isRecording` flips, the callback reference changes. This is functionally correct but causes unnecessary re-renders in any consumer that passes `stopRecording` as a prop or dependency. A ref-based approach would keep the callback stable.
**Fix:** Use a ref to track recording state instead:
```typescript
const isRecordingRef = useRef(false);
// Update isRecordingRef in startRecording and the onstop handler
// Then stopRecording can read isRecordingRef.current with [] deps
```

## Info

### IN-01: PCM worklet file exists but is not consumed by any source file

**File:** `public/worklets/pcm-processor.js`
**Issue:** The worklet is well-written (correct Float32-to-PCM16 conversion, proper Transferable usage, NaN clamping) but no file in the codebase imports or registers it via `audioWorklet.addModule()`. It is dead code until the ScriptProcessorNode migration in `geminiLive.ts` is completed.
**Fix:** Wire up the worklet in `geminiLive.ts` `startMicrophone()` method, or if deferred, add a TODO comment in the worklet file noting the intended consumer.

### IN-02: session property typed as `any` in GeminiLiveSession

**File:** `src/services/geminiLive.ts:68`
**Issue:** `private session: any = null;` uses `any` type (with an eslint-disable comment). While this avoids importing the SDK session type, it disables type checking for all `this.session.*` calls (lines 245, 278, 293).
**Fix:** Consider typing as the SDK's session type, e.g. `ReturnType<GoogleGenAI['live']['connect']> extends Promise<infer T> ? T | null : never` or a minimal interface.

### IN-03: console.error in geminiLive scheduleAudioPlayback

**File:** `src/services/geminiLive.ts:216`
**Issue:** `console.error('Gemini audio playback error:', err)` is acceptable per project conventions (error logging), but the error is silently swallowed -- the user gets no feedback that audio playback failed. The `onAudioResponse` callback on line 194 already fired with the base64 data, so the UI may show a "playing" state with no audio.
**Fix:** Consider calling `this.callbacks.onError(...)` for playback failures that affect user experience, or at minimum ensure the UI handles the case where audio doesn't play.

---

_Reviewed: 2026-04-10T22:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
