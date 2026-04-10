# Phase 16: Recording Logic - Research

**Researched:** 2026-04-10
**Domain:** Audio recording / microphone input / speech-to-text pipeline
**Confidence:** HIGH

## Summary

SpeakLab has **two distinct audio recording pipelines** that serve different exercise modes:

1. **Record-then-submit pipeline** (ExerciseMode, ImageMode, ReviewPage) -- uses `useAudioRecorder` hook with `MediaRecorder` API to capture audio, convert to base64, and submit for STT evaluation. The user records, reviews, and submits.

2. **Live streaming pipeline** (LiveSession / Live Roleplay) -- uses `getUserMedia` + `ScriptProcessorNode` to stream real-time PCM16 audio to either Gemini Live or OpenAI Realtime WebSocket APIs. Microphone is toggled on/off during conversation.

**Primary recommendation:** This phase is a review/verification phase. The code is functionally complete but has several issues discovered during research: (1) Phase 11's AudioWorklet migration was silently reverted in Phase 13, leaving both live session providers on deprecated ScriptProcessorNode, (2) `useAudioRecorder` has no cleanup-on-unmount causing blob URL memory leaks, (3) `ReviewPage.handleAudioReady` has a type mismatch ignoring the base64 parameter, (4) `createPcmBlob` in geminiLive.ts uses simple multiply without clamping (potential NaN issues).

## Two Audio Recording Architectures

### Architecture A: Record-Then-Submit (useAudioRecorder + AudioRecorder)

**Consumers:** ExerciseMode.tsx, ImageMode.tsx, ReviewPage.tsx

**Flow:**
```
User taps Record
  -> useAudioRecorder.startRecording()
  -> navigator.mediaDevices.getUserMedia({ audio: true })
  -> new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
  -> chunks accumulate in ondataavailable
  -> User taps Stop
  -> mediaRecorder.stop() triggers onstop
  -> Blob created from chunks
  -> blobToBase64() converts for API
  -> User can Play/Discard/Submit
  -> onAudioReady(blob, base64) called
  -> Consumer calls speechToText(blob) then chatCompletion for evaluation
```

**Key files:**
- `src/hooks/useAudioRecorder.ts` (91 lines) -- hook with start/stop/discard
- `src/components/shared/AudioRecorder.tsx` (127 lines) -- UI component with Record/Stop/Play/Discard/Submit buttons
- `src/utils/audio.ts` (137 lines) -- blobToBase64, PCM conversion helpers
- `src/services/openai.ts` line 144 -- `speechToText()` with fallback

### Architecture B: Live Streaming (GeminiLiveSession / OpenAIRealtimeLiveSession)

**Consumer:** `src/components/live-roleplay/LiveSession.tsx`

**Flow:**
```
User starts Live Roleplay
  -> LiveSession creates provider (Gemini or OpenAI based on config.liveSource)
  -> provider.connect(systemPrompt) -- opens WebSocket
  -> User taps mic toggle
  -> provider.startMicrophone()
  -> getUserMedia -> AudioContext -> ScriptProcessorNode
  -> onaudioprocess fires ~32 times/sec
  -> Float32 samples converted to PCM16 -> base64
  -> Sent to WebSocket (Gemini sendRealtimeInput or OpenAI input_audio_buffer.append)
  -> AI audio response played via AudioBufferSourceNode scheduling
  -> Transcription callbacks fire for both user and AI text
```

**Key files:**
- `src/services/liveSession.ts` (30 lines) -- ILiveSession interface + callbacks
- `src/services/geminiLive.ts` (299 lines) -- Gemini Live implementation
- `src/services/openaiRealtimeLive.ts` (288 lines) -- OpenAI Realtime implementation
- `src/components/live-roleplay/LiveSession.tsx` (298 lines) -- UI + session management
- `public/worklets/pcm-processor.js` (58 lines) -- EXISTS on disk but NOT USED by current code

## Critical Findings

### Finding 1: Phase 11 AudioWorklet Migration Silently Reverted [VERIFIED: git diff 868fa6e..HEAD]

**Severity:** HIGH
**Status:** Confirmed via git history

Phase 11 (commit `868fa6e`) migrated geminiLive.ts from deprecated `ScriptProcessorNode` to `AudioWorkletNode`. However, commit `5aefc60` (Phase 13 test commit) reverted this change:
- `public/worklets/pcm-processor.js` was deleted from git tracking (file exists on disk but was removed from the commit)
- `geminiLive.ts` was reverted from `AudioWorkletNode` back to `ScriptProcessorNode`
- `createPcmBlob` helper was re-added (was removed in Phase 11)
- `geminiLive.test.ts` was reverted to ScriptProcessorNode mocks

The worklet file `public/worklets/pcm-processor.js` still exists on disk (58 lines) but is orphaned -- no code references it.

**Impact:** Both live session providers (`geminiLive.ts` and `openaiRealtimeLive.ts`) now use deprecated `ScriptProcessorNode`. This runs audio processing on the main thread, which can cause audio glitches under load.

### Finding 2: Memory Leak in useAudioRecorder [VERIFIED: code analysis]

**Severity:** MEDIUM
**Location:** `src/hooks/useAudioRecorder.ts` line 43

`URL.createObjectURL(blob)` is called in the `onstop` handler but there is no `useEffect` cleanup to call `URL.revokeObjectURL()` when the component unmounts. The `discardRecording` function in `AudioRecorder.tsx` does revoke the URL, but if the user navigates away while a recording exists, the blob URL is never freed.

Additionally, if `startRecording` is called while a previous recording's audioUrl exists, the old URL is not revoked before the new one is created.

**Fix:** Add a `useEffect` return cleanup in `useAudioRecorder.ts` or `AudioRecorder.tsx` that revokes the URL on unmount.

### Finding 3: ReviewPage Type Mismatch [VERIFIED: code analysis]

**Severity:** LOW (works at runtime due to JS permissiveness)
**Location:** `src/components/review/ReviewPage.tsx` line 66

`AudioRecorder` component calls `onAudioReady(blob, base64)` with 2 arguments (type signature: `(blob: Blob, base64: string) => void`). But `ReviewPage` declares:
```typescript
const handleAudioReady = async (blob: Blob) => { ... }
```

This silently drops the `base64` parameter. Unlike `ExerciseMode` and `ImageMode` which both accept `(blob: Blob, base64: string)`, ReviewPage does not save the base64 for card persistence. This is not a runtime error but is inconsistent and may indicate ReviewPage is missing audio blob storage.

### Finding 4: PCM Clamping Difference Between Providers [VERIFIED: code analysis]

**Severity:** LOW
**Location:** `src/services/geminiLive.ts` line 50-53 vs `src/services/openaiRealtimeLive.ts` line 209-212

`geminiLive.ts` `createPcmBlob` uses simple multiply:
```typescript
int16[i] = data[i] * 32768;
```

`openaiRealtimeLive.ts` uses proper clamping:
```typescript
const s = Math.max(-1, Math.min(1, inputData[i]));
pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
```

The unclamped version can produce NaN or overflow values if input data contains out-of-range floats. Phase 11's worklet used the clamped pattern.

### Finding 5: No Tests for useAudioRecorder [VERIFIED: file search]

No test file exists for `src/hooks/useAudioRecorder.ts` or `src/components/shared/AudioRecorder.tsx`. The hook handles microphone access, MediaRecorder lifecycle, and base64 conversion -- all testable with mocks.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| MediaRecorder API | Browser native | Record-then-submit audio capture | Standard Web API, no library needed |
| Web Audio API | Browser native | Live streaming audio processing | Standard Web API for real-time audio |
| @google/genai | 1.0 | Gemini Live WebSocket session | Project's official Gemini SDK |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.0 | Test runner | All audio-related tests |
| jsdom | 28 | DOM environment for tests | Mocking MediaRecorder, AudioContext |

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/useAudioRecorder.ts       # Record-then-submit hook
├── components/shared/AudioRecorder.tsx  # UI for record/submit
├── services/
│   ├── liveSession.ts              # ILiveSession interface
│   ├── geminiLive.ts               # Gemini Live provider
│   └── openaiRealtimeLive.ts       # OpenAI Realtime provider
├── utils/audio.ts                  # Audio conversion utilities
└── components/live-roleplay/
    └── LiveSession.tsx             # Live roleplay UI
```

### Pattern: Strategy for Live Providers
Both `GeminiLiveSession` and `OpenAIRealtimeLiveSession` implement the same `ILiveSession` interface (`connect`, `startMicrophone`, `stopMicrophone`, `sendTextMessage`, `disconnect`). The `LiveSession.tsx` component selects which to instantiate based on `config.liveSource`.

### Pattern: Fallback in STT
`speechToText()` in `openai.ts` tries the primary STT model, then falls back to `sttFallbackModel`/`sttFallbackSource` if configured.

### Anti-Patterns to Avoid
- **ScriptProcessorNode for production audio:** Deprecated, runs on main thread. AudioWorkletNode is the replacement.
- **Missing cleanup for blob URLs:** `URL.createObjectURL()` must be paired with `URL.revokeObjectURL()` in cleanup/unmount.
- **Unclamped PCM conversion:** Float32 to Int16 without clamping can produce NaN/garbage audio.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PCM16 conversion | Custom float-to-int16 without clamping | `Math.max(-1, Math.min(1, s))` pattern | Handles NaN and out-of-range |
| Audio playback scheduling | Custom queue with setTimeout | AudioBufferSourceNode with scheduled start times | Gapless playback via Web Audio API |
| WAV container wrapping | Manual byte manipulation | `pcm16Base64ToWavBase64()` in `src/utils/audio.ts` | Already exists and tested |

## Common Pitfalls

### Pitfall 1: ScriptProcessorNode Deprecation
**What goes wrong:** Audio processing on main thread causes glitches under load; Chrome shows deprecation warnings.
**Why it happens:** Both live providers still use `createScriptProcessor()`.
**How to avoid:** Migrate to AudioWorkletNode using the pattern in `public/worklets/pcm-processor.js` (already exists).
**Warning signs:** Console warnings about ScriptProcessorNode deprecation; audio dropouts during heavy UI updates.

### Pitfall 2: Blob URL Memory Leaks
**What goes wrong:** Memory grows as users record audio across multiple exercises.
**Why it happens:** `URL.createObjectURL()` without `URL.revokeObjectURL()` on unmount or re-record.
**How to avoid:** Add cleanup in `useAudioRecorder` or `AudioRecorder` component.
**Warning signs:** Increasing memory in DevTools after multiple recordings.

### Pitfall 3: MediaRecorder mimeType Support
**What goes wrong:** Falls back to `audio/webm` without codec specification on some browsers.
**Why it happens:** `audio/webm;codecs=opus` is not universally supported (Safari has limited WebM support).
**How to avoid:** Current code already handles fallback; consider adding `audio/mp4` as secondary fallback for Safari.
**Warning signs:** Empty audio blobs on Safari/iOS.

### Pitfall 4: Stream Not Released After Recording
**What goes wrong:** Microphone indicator stays active after recording stops.
**Why it happens:** `stream.getTracks().forEach(t => t.stop())` is called in `onstop` handler, which is correct for normal flow. But if `stopRecording` is called and MediaRecorder is in `inactive` state, `onstop` may not fire.
**How to avoid:** Add explicit stream cleanup in `stopRecording` as a safety net.
**Warning signs:** Browser tab shows microphone icon after recording session ends.

## Code Examples

### Correct PCM16 Conversion with Clamping (from openaiRealtimeLive.ts)
```typescript
// Source: src/services/openaiRealtimeLive.ts lines 209-212
const pcm16 = new Int16Array(inputData.length);
for (let i = 0; i < inputData.length; i++) {
  const s = Math.max(-1, Math.min(1, inputData[i]));
  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
}
```

### AudioWorklet Pattern (from public/worklets/pcm-processor.js -- currently orphaned)
```javascript
// Source: public/worklets/pcm-processor.js
// This file exists on disk but is NOT imported by any current code
// Phase 11 created it, Phase 13 accidentally reverted the import
class PCMProcessor extends AudioWorkletProcessor {
  // Buffers 128-sample render quantum to target size (default 4096)
  // Converts Float32 -> PCM16 with clamping off-main-thread
  // Posts via Transferable ArrayBuffer
}
registerProcessor('pcm-processor', PCMProcessor);
```

### Proper Cleanup Pattern for useAudioRecorder (recommended fix)
```typescript
// Add to useAudioRecorder hook
useEffect(() => {
  return () => {
    // Revoke blob URL on unmount
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    // Stop any active MediaRecorder
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
}, []); // eslint-disable-line react-hooks/exhaustive-deps
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode | AudioWorkletNode | Chrome 66+ (2018) | Main thread blocking eliminated |
| Manual PCM scheduling | Scheduled AudioBufferSourceNode | Project pattern | Gapless playback |

**Deprecated/outdated:**
- `ScriptProcessorNode`: Deprecated in favor of `AudioWorkletNode`. Both `geminiLive.ts` and `openaiRealtimeLive.ts` still use it.
- `onaudioprocess` event: Runs on main thread. Should be replaced with AudioWorklet processor.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PCM clamping difference is a bug, not intentional | Finding 4 | LOW -- simple multiply works for most inputs |
| A2 | ReviewPage missing base64 is an oversight, not by design | Finding 3 | LOW -- ReviewPage works fine without it |

**Note:** Most findings were verified directly from source code (HIGH confidence). Only the intent behind design choices is assumed.

## Open Questions

1. **Should Phase 16 re-apply the Phase 11 AudioWorklet migration?**
   - What we know: The migration was accidentally reverted. The worklet file exists on disk. Phase 11 verified it worked.
   - What's unclear: Whether the revert was intentional (e.g., the worklet caused issues) or purely accidental.
   - Recommendation: Re-apply the AudioWorklet migration as part of this phase since it's a review/verification of recording logic.

2. **Should openaiRealtimeLive.ts also be migrated to AudioWorkletNode?**
   - What we know: Phase 11 explicitly scoped this out. Both providers now use ScriptProcessorNode.
   - What's unclear: Whether the user wants both migrated in this phase.
   - Recommendation: Migrate both for consistency; the pattern is already established.

3. **Is the phase purely review/verification, or should it include fixes?**
   - What we know: Phase description says "Review and verify that the audio recording logic is working correctly."
   - What's unclear: Whether bugs found during review should be fixed in this phase or filed as separate phases.
   - Recommendation: This phase should fix identified issues since they directly relate to recording logic correctness.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | Yes | 20.x | -- |
| npm | Package management | Yes | 10.x | -- |
| vitest | Tests | Yes | 4.0 | -- |
| jsdom | Test DOM | Yes | 28 | -- |
| Browser microphone | Manual testing | N/A | -- | Dev mode works without |

**Missing dependencies with no fallback:** None -- all tooling available.

**Missing dependencies with fallback:** Browser microphone access requires manual testing (cannot be automated in CI).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/services/geminiLive.test.ts src/services/openaiRealtimeLive.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req Area | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| useAudioRecorder | Start/stop/discard recording lifecycle | unit | `npx vitest run src/hooks/useAudioRecorder.test.ts` | No -- Wave 0 |
| useAudioRecorder | Blob URL cleanup on unmount | unit | `npx vitest run src/hooks/useAudioRecorder.test.ts` | No -- Wave 0 |
| geminiLive | AudioWorkletNode mic input | unit | `npx vitest run src/services/geminiLive.test.ts` | Yes (needs update) |
| openaiRealtimeLive | Microphone start/stop | unit | `npx vitest run src/services/openaiRealtimeLive.test.ts` | Yes |
| ReviewPage | handleAudioReady type consistency | unit | `npx vitest run src/components/review/ReviewPage.test.tsx` | No -- Wave 0 |
| Cross-mode | MediaRecorder mimeType fallback | unit | `npx vitest run src/hooks/useAudioRecorder.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/geminiLive.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/hooks/useAudioRecorder.test.ts` -- covers start/stop/discard/cleanup/mimeType
- [ ] `src/components/shared/AudioRecorder.test.tsx` -- covers UI rendering and onAudioReady callback
- [ ] Update `src/services/geminiLive.test.ts` -- if AudioWorklet migration re-applied

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | no | -- |
| V5 Input Validation | yes | Audio mimeType validation in MediaRecorder |
| V6 Cryptography | no | -- |

### Known Threat Patterns for Audio Recording

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Microphone permission abuse | Elevation of Privilege | getUserMedia requires explicit user grant |
| Audio data leak via blob URL | Information Disclosure | Revoke blob URLs after use (currently missing) |

## Sources

### Primary (HIGH confidence)
- `src/hooks/useAudioRecorder.ts` -- full file read, recording hook implementation
- `src/components/shared/AudioRecorder.tsx` -- full file read, UI component
- `src/services/geminiLive.ts` -- full file read, Gemini Live provider
- `src/services/openaiRealtimeLive.ts` -- full file read, OpenAI Realtime provider
- `src/services/liveSession.ts` -- full file read, interface definition
- `src/components/live-roleplay/LiveSession.tsx` -- full file read, live session UI
- `src/components/discovery/ExerciseMode.tsx` -- full file read, exercise consumer
- `src/components/discovery/ImageMode.tsx` -- full file read, image mode consumer
- `src/components/review/ReviewPage.tsx` -- full file read, review consumer
- `src/utils/audio.ts` -- full file read, audio utilities
- `public/worklets/pcm-processor.js` -- exists on disk (verified)
- Git history: `868fa6e..HEAD` diff on geminiLive.ts -- confirmed Phase 11 reversion
- `.planning/phases/11-audioworklet-migration/11-01-SUMMARY.md` -- Phase 11 execution record
- `.planning/phases/11-audioworklet-migration/11-VERIFICATION.md` -- Phase 11 verification

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- phase descriptions and status
- `.planning/STATE.md` -- current project state

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code read directly, verified via git history
- Architecture: HIGH -- both pipelines fully understood from source
- Pitfalls: HIGH -- issues found in actual code, not theoretical
- Fixes: MEDIUM -- recommended fixes are sound but not yet tested

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain -- browser APIs change slowly)
