---
phase: 17-retry-exercise
reviewed: 2026-04-10T12:00:00Z
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
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed 24 source files spanning client-side components (LiveSession, ReviewPage, SettingsPage), service modules (openai.ts, geminiLive.ts, aiProxy tests), hooks (useAudioRecorder), type definitions (settings.ts), tests, and the Supabase Edge Function (ai-proxy) with its extracted provider modules. The codebase is generally well-structured with solid fallback patterns and good test coverage. The modularization of the edge function into provider modules is clean, though index.ts still retains full inline copies (noted in prior review).

Key concerns: CORS wildcard origin in production, insecure JWT base64 encoding in Vertex auth, and an unsafe plaintext API key migration path that can expose keys. Client-side issues include stale closures in LiveSession and an unchecked JSON.parse in ReviewPage.

## Critical Issues

### CR-01: CORS wildcard origin in production edge function

**File:** `supabase/functions/ai-proxy/index.ts:13-15`
**Issue:** The CORS headers use `Access-Control-Allow-Origin: *` which allows any origin to call the edge function. Since this function handles encrypted API keys and authenticated requests, a wildcard origin is a security risk. An attacker's page could potentially make authenticated cross-origin requests if a user visits it while logged in, though the Bearer token requirement mitigates this partially.
**Fix:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```
Replace the wildcard with the configured site URL from environment variables.

### CR-02: Insecure JWT construction using btoa in Vertex auth

**File:** `supabase/functions/ai-proxy/providers/vertex.ts:19-20` (also `supabase/functions/ai-proxy/index.ts:621-622`)
**Issue:** JWT header and payload are constructed using `btoa()` which produces standard base64 with `+/` characters and `=` padding, not URL-safe base64 (`-_` characters, no padding) as required by JWT spec (RFC 7519 section 2). While Google's token endpoint may tolerate this currently, it violates the JWT standard and could break with stricter validators or future API changes.
**Fix:**
```typescript
function base64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
const payload = base64urlEncode(JSON.stringify({
  iss: sa.client_email,
  scope: 'https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
}))
```

### CR-03: Plaintext API key exposed during auto-migration

**File:** `supabase/functions/ai-proxy/index.ts:153-169`
**Issue:** The `getApiKey` function falls back to treating the stored value as plaintext when it doesn't match the encrypted format. It then returns this plaintext value directly and triggers a background re-encryption via `saveApiKey`. This means if a database read occurs for a legacy plaintext key, the raw key is returned in the function response AND a background write starts -- both operations with the unencrypted key in memory. Additionally, any error in the background `saveApiKey` call is silently ignored (no await, no catch).
**Fix:** At minimum, await the `saveApiKey` call and handle errors. Consider also logging the migration event for auditing:
```typescript
// Plaintext key (or old client-side encrypted) — auto-migrate
const plaintextValue = encryptedKey
try {
  await saveApiKey(userId, source, plaintextValue)
  console.log(`Migrated plaintext key for user ${userId}, source ${source}`)
} catch (err) {
  console.error(`Failed to migrate key for user ${userId}:`, err)
}
return plaintextValue
```

## Warnings

### WR-01: Stale closure in LiveSession useEffect callback

**File:** `src/components/live-roleplay/LiveSession.tsx:62-95`
**Issue:** The `useEffect` that creates the live session captures `onEnd` in its closure. Since `onEnd` is a prop that may get a new reference on parent re-renders, the `onTurnComplete` callback at line 72 uses `onEnd` from the effect closure which may be stale. The dependency array includes `onEnd` but this causes the entire session to be recreated (disconnect + reconnect) whenever `onEnd` changes, which is likely unintentional and disruptive to active conversations.
**Fix:** Use a ref to hold the latest `onEnd` callback and remove it from the effect dependencies:
```typescript
const onEndRef = useRef(onEnd);
useEffect(() => { onEndRef.current = onEnd; }, [onEnd]);
// Inside onTurnComplete, use onEndRef.current instead of onEnd
// Remove onEnd from the useEffect dependency array
```

### WR-02: Race condition in useAudioRecorder stopRecording

**File:** `src/hooks/useAudioRecorder.ts:91-99`
**Issue:** `stopRecording` reads `state.isRecording` from the React state closure, but state is captured at render time. If `stopRecording` is called rapidly or during a state transition, the stale `state.isRecording` value could cause a double-stop or missed stop. The callback dependency `[state.isRecording]` means a new function reference is created on each recording state change, but between renders the ref-based check would be safer.
**Fix:** Use a ref to track the MediaRecorder instance state for synchronous access:
```typescript
const isRecordingRef = useRef(false);
// Set isRecordingRef.current = true/false alongside setState calls
// In stopRecording, check isRecordingRef.current instead of state.isRecording
```

### WR-03: Unchecked JSON.parse in ReviewPage evaluation handler

**File:** `src/components/review/ReviewPage.tsx:76`
**Issue:** `JSON.parse(evalResponse)` is called without a dedicated try/catch. If the AI returns malformed JSON (common with LLM responses), this throws a generic error that reaches the outer catch at line 96 but provides no diagnostic context. The parsed object is also cast directly to `EvaluationResult` without validating its shape, so a partial or incorrect response could cause downstream errors when accessing `evalResult.score` or `evalResult.corrections`.
**Fix:**
```typescript
let evalResult: EvaluationResult;
try {
  evalResult = JSON.parse(evalResponse);
} catch {
  throw new Error('AI returned invalid JSON for evaluation. Please try again.');
}
if (typeof evalResult.score !== 'number' || !Array.isArray(evalResult.corrections)) {
  throw new Error('AI returned an incomplete evaluation. Please try again.');
}
```

### WR-04: GeminiSTT in edge function ignores model parameter

**File:** `supabase/functions/ai-proxy/providers/gemini.ts:62` (also `supabase/functions/ai-proxy/index.ts:413-417`)
**Issue:** The `stt` function in the Gemini provider hardcodes `model: 'gemini-2.5-flash'` instead of using the `model` parameter passed by the caller. At index.ts line 1316, `geminiSTT(apiKey, body.audio, body.mimeType)` is called without passing the user's configured model at all. This means user-configured STT model selection has no effect for the Gemini source.
**Fix:** Update the function signature to accept `model` and pass it through:
```typescript
// providers/gemini.ts
export async function stt(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> {
  const response = await ai.models.generateContent({ model, /* ... */ })
}
// index.ts call site
text = await geminiSTT(apiKey, body.audio, body.mimeType, model)
```

### WR-05: Index used as React key in chat history rendering

**File:** `src/components/live-roleplay/LiveSession.tsx:244`
**Issue:** The chat history rendering uses `key={i}` (array index) for turn elements. While this works for append-only lists, if the turns array is ever reordered or items are removed, React will mismatch DOM elements. Since conversation turns are append-only in practice this is low risk, but it remains an anti-pattern.
**Fix:** Use a stable unique key combining role and timestamp:
```typescript
key={`${turn.role}-${turn.timestamp}-${i}`}
```

### WR-06: Duplicate code between index.ts and extracted provider modules

**File:** `supabase/functions/ai-proxy/index.ts` (lines 216-1054) vs `supabase/functions/ai-proxy/providers/*.ts`
**Issue:** The edge function `index.ts` contains full inline implementations of all provider functions (openaiChat, geminiChat, groqChat, openaiTTS, etc.) that are duplicated almost verbatim in the extracted provider modules. The `index.ts` does not import from the provider modules. Any bug fix must be applied in two places, increasing drift risk. This was previously noted as IN-01 and has not been addressed.
**Fix:** Have `index.ts` import from the provider modules:
```typescript
import { chat as openaiChat, tts as openaiTTS, /* ... */ } from './providers/openai.ts';
import { chat as geminiChat, /* ... */ } from './providers/gemini.ts';
// Remove all inline provider function declarations
```

## Info

### IN-01: SettingsPage vertexProjectId and vertexRegion not loaded from storage

**File:** `src/components/settings/SettingsPage.tsx:81-82, 89-103`
**Issue:** The `vertexProjectId` and `vertexRegion` state values are initialized as empty/`'us-central1'` but the `useEffect` that loads settings on mount only calls `getModelConfig()` and `getConversationTone()`. There is no code to load the stored Vertex config (projectId/region). The `handleSave` function also does not persist these values -- `saveApiKeys` receives `openai`, `genai`, `groq`, `openrouter` keys but no `vertex` config. Vertex settings appear non-functional in the UI.
**Fix:** Load Vertex config from storage in the mount effect and include it in the save handler.

### IN-02: Unused `_base64` parameter in ReviewPage

**File:** `src/components/review/ReviewPage.tsx:66`
**Issue:** The `handleAudioReady` callback receives `_base64` (underscore-prefixed, intentionally unused). The function calls `speechToText(blob)` directly. The AudioRecorder component computes base64 unnecessarily for this consumer. This is a minor inefficiency, not a bug.

### IN-03: Non-null assertions on Supabase env vars in index.ts

**File:** `supabase/functions/ai-proxy/index.ts:25-26`
**Issue:** `Deno.env.get('SUPABASE_URL')!` and `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!` use non-null assertions. If these env vars are missing, the code passes `undefined` to `createClient` which will fail with an obscure error later. The `ENCRYPTION_KEY` check at line 20 correctly validates immediately; these two should follow the same pattern. This was previously noted as WR-02 and has not been addressed.
**Fix:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set')
}
```

---

_Reviewed: 2026-04-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
