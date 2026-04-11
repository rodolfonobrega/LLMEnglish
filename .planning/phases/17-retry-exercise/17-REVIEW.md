---
phase: 17-retry-exercise
reviewed: 2026-04-11T12:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - package.json
  - src/components/live-roleplay/LiveSession.tsx
  - src/components/review/ReviewPage.tsx
  - src/components/settings/SettingsPage.tsx
  - src/config/images.test.ts
  - src/hooks/useAudioRecorder.test.ts
  - src/hooks/useAudioRecorder.ts
  - src/services/errorAnalysis.test.ts
  - src/services/geminiLive.test.ts
  - src/services/geminiLive.ts
  - src/services/openai.test.ts
  - src/services/openai.ts
  - src/services/supabase/aiProxy.test.ts
  - src/services/supabase/storage.test.ts
  - src/test/setup.ts
  - src/types/settings.ts
  - supabase/functions/ai-proxy/crypto.ts
  - supabase/functions/ai-proxy/index.ts
  - supabase/functions/ai-proxy/providers/gemini.ts
  - supabase/functions/ai-proxy/providers/groq.ts
  - supabase/functions/ai-proxy/providers/openai.ts
  - supabase/functions/ai-proxy/providers/openrouter.ts
  - supabase/functions/ai-proxy/providers/vertex.ts
  - supabase/functions/ai-proxy/utils.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed 24 source files across the SpeakLab codebase covering live roleplay, review exercises, settings, audio recording, AI proxy services, and Supabase Edge Function providers. The codebase shows solid engineering: good fallback patterns, proper retry logic, well-structured provider modules, and comprehensive test coverage.

Compared to the prior review (2026-04-10), several issues have been resolved: the CORS origin now uses the configured site URL (not wildcard), Vertex JWT encoding uses proper base64url, the plaintext key migration is now awaited with error logging, `JSON.parse` in ReviewPage has try/catch with shape validation, the STT model parameter is now passed through, and the React key for chat history uses a stable composite. These are verified fixes.

One critical issue remains: the Gemini API key is exposed client-side in network URLs for the Live API (an architectural limitation). New warnings include potential race conditions in audio recording and a LiveSession effect that could cause unnecessary reconnections.

## Critical Issues

### CR-01: Gemini API key exposed in browser network requests (architectural)

**File:** `src/services/geminiLive.ts:86`
**Issue:** The Gemini Live session creates a `GoogleGenAI({ apiKey: key })` client directly in the browser using the raw API key from `getGeminiKey()`. The SDK's WebSocket connection URL will contain the API key as a query parameter, making it visible in browser DevTools, network logs, and potentially referrer headers. The project's own `SEC-04` policy states "API keys are never exposed client-side." All other AI calls correctly route through the Supabase Edge Function proxy. This is an architectural limitation of the Gemini Live API which requires a persistent WebSocket and cannot be proxied through the edge function, but the deviation from the security policy is not documented.
**Fix:** This cannot be fully resolved without a WebSocket proxy (significant infrastructure change). Recommended mitigations:
1. Add a clear warning in the Live Roleplay UI that the Gemini API key is used directly from the browser
2. Document the architectural exception in the codebase security documentation
3. Consider using short-lived API key restrictions (Google API key restrictions to only Gemini API)

## Warnings

### WR-01: Race condition between stopRecording safety-net and onstop handler

**File:** `src/hooks/useAudioRecorder.ts:67-80,94-102`
**Issue:** `stopRecording` (line 97-100) stops stream tracks immediately as a safety net before calling `mediaRecorder.stop()`. The `onstop` handler (line 79) also calls `stream.getTracks().forEach(t => t.stop())`. If the safety-net stop causes the MediaRecorder to emit an incomplete final data chunk (stream killed before the final `ondataavailable` event), the recorded audio could be truncated or empty. The timing depends on browser implementation -- some browsers deliver the final data event before `onstop`, others may not.
**Fix:** Defer stream track cleanup to the `onstop` handler only, or add a guard:
```typescript
// In onstop handler (line 79), check track state before stopping:
const tracks = stream.getTracks();
if (tracks.some(t => t.readyState === 'live')) {
  tracks.forEach(t => t.stop());
}
```

### WR-02: LiveSession useEffect may trigger unnecessary session reconnections

**File:** `src/components/live-roleplay/LiveSession.tsx:64-97`
**Issue:** The `useEffect` that creates the live session depends on `[scenario, checkForFarewell]`. The `checkForFarewell` callback is memoized with `useCallback([], ...)`, which is stable. However, `scenario` is an object prop -- if the parent re-renders and creates a new `scenario` object reference (even with identical content), the effect re-runs, disconnecting the live session and creating a new one. This would disrupt an active conversation. The `onEnd` prop is correctly handled via `onEndRef`, but `scenario` is not.
**Fix:** Either memoize `scenario` in the parent, or extract primitive identifiers as dependencies:
```typescript
// Replace [scenario, ...] with stable primitive deps:
useEffect(() => {
  // ... session creation using scenario
}, [scenario.systemPrompt, scenario.suggestedVoice, scenario.theme, checkForFarewell]);
```

### WR-03: Unprotected nested property access in Edge Function API responses

**File:** `supabase/functions/ai-proxy/index.ts:244,270,299,498`
**Issue:** Multiple API response parsers access deeply nested properties without null checks. Examples: `data.choices[0].message.content` (line 244), `data.candidates[0].content.parts[0].text` (line 270), `data.choices[0].message.content` (line 299, 498). If the API returns an unexpected shape (e.g., content filtered by safety, empty candidates due to moderation), these throw `TypeError: Cannot read properties of undefined` which surfaces as a generic 400 error with no useful context for the client.
**Fix:** Use optional chaining with descriptive fallback errors:
```typescript
const content = data.choices?.[0]?.message?.content;
if (!content) throw new Error(`OpenAI returned unexpected response format: ${JSON.stringify(data).slice(0, 300)}`);
return content;
```
Note: The provider modules in `supabase/functions/ai-proxy/providers/` have the same issue and should be fixed in tandem.

### WR-04: Plaintext key migration retries indefinitely on every request

**File:** `supabase/functions/ai-proxy/index.ts:166-173`
**Issue:** The `getApiKey` function attempts to migrate plaintext keys on every call. If the `saveApiKey` call fails (e.g., DB permissions issue), the error is logged but the plaintext key is returned. On the next request for the same key, migration is attempted again (because the DB still has the plaintext value). This creates persistent retry spam in logs and adds latency to every request for that key. The prior review noted this was fixed (now awaited), but the indefinite retry behavior remains.
**Fix:** Add a migration marker or timestamp to prevent repeated attempts, or rate-limit migration attempts:
```typescript
// After failed migration, at minimum add a clear persistent-warning log:
console.error(`PERSISTENT: Migration failed for user ${userId}, source ${source}. Will retry next request.`);
```

## Info

### IN-01: Massive code duplication between index.ts and provider modules

**File:** `supabase/functions/ai-proxy/index.ts` (1410 lines) vs `supabase/functions/ai-proxy/providers/*.ts`
**Issue:** The edge function `index.ts` contains full inline implementations of all provider functions (`openaiChat`, `geminiChat`, `groqChat`, `openaiTTS`, `geminiTTS`, `groqTTS`, `openaiSTT`, `geminiSTT`, `groqSTT`, `openaiImage`, `geminiImage`, `openrouterChat`, `openrouterTTS`, `openrouterSTT`, `openrouterImage`, `vertexChat`, `vertexChatWithImage`, `vertexTTS`, `vertexSTT`, `vertexImage`) that are duplicated almost verbatim in the extracted provider modules. `index.ts` does not import from any provider module. Any bug fix must be applied in two places, increasing drift risk. This was noted in the prior review (WR-06) and has not been addressed.
**Fix:** Have `index.ts` import from the provider modules and remove all inline function declarations.

### IN-02: Vertex settings not loaded or saved in SettingsPage

**File:** `src/components/settings/SettingsPage.tsx:81-82,89-103,217-244`
**Issue:** The `vertexProjectId` and `vertexRegion` state values are initialized as empty/`'us-central1'` but the mount `useEffect` (line 89-103) only loads `getModelConfig()` and `getConversationTone()`. There is no code to load stored Vertex config. The `handleSave` function (line 217-244) also does not persist Vertex config -- `saveApiKeys` receives `openai`, `genai`, `groq`, `openrouter` keys but no `vertex` config. Vertex settings appear to be non-functional in the UI -- users can type values but they are never loaded or saved. This was noted in the prior review (IN-01) and has not been addressed.
**Fix:** Load Vertex config from storage in the mount effect and include it in the save handler.

### IN-03: Non-null assertions on Supabase env vars in index.ts

**File:** `supabase/functions/ai-proxy/index.ts:25-26`
**Issue:** `Deno.env.get('SUPABASE_URL')!` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` use non-null assertions. If these env vars are missing, the code passes `undefined` to `createClient` which fails with an obscure error later. The `ENCRYPTION_KEY` check at line 20 correctly validates immediately; these two should follow the same pattern. This was noted in the prior review (IN-03) and has not been addressed.
**Fix:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set')
}
```

### IN-04: Magic numbers for audio sample rates in geminiLive.ts

**File:** `src/services/geminiLive.ts:183,189,220`
**Issue:** The output sample rate `24000` (lines 183, 189) and input sample rate `16000` (line 220) are hardcoded. These are Gemini Live API constants that are unlikely to change, but naming them improves readability.
**Fix:**
```typescript
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;
```

### IN-05: `as any` type assertions in test mocks

**File:** `src/services/errorAnalysis.test.ts:143,157,162,176`
**Issue:** Several `as any[]` type assertions are used when creating mock card objects. While common in tests, these bypass TypeScript's structural checking, meaning the mock data may drift from the actual `Card` interface without compiler warnings.
**Fix:** Use `Partial<Card>[]` or explicit typed mock factory functions.

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
