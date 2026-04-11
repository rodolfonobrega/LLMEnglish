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
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-11T12:00:00Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Reviewed 24 source files across the SpeakLab retry-exercise phase: React components (LiveSession, ReviewPage, SettingsPage), service modules (openai, geminiLive, errorAnalysis, aiProxy), Edge Function (ai-proxy with 5 provider modules), type definitions, and test files.

Compared to the prior review (2026-04-10), several issues have been resolved: the CORS origin now uses the configured site URL, Vertex JWT encoding uses proper base64url, `JSON.parse` in ReviewPage has try/catch with shape validation, the STT model parameter is passed through, and the React key for chat history uses a stable composite. These fixes are verified.

Two critical security issues were found in the edge function: Gemini API key leaked via URL query parameters in server-side calls (distinct from the known client-side Live API limitation), and an SSRF vulnerability via unsanitized imageUrl fetching. Five warnings include a source-detection bug that misroutes Groq models with `openai/` prefix, an overly broad farewell detection pattern, potential NaN on empty scores, dead provider modules not imported by index.ts, and a missing CORS Content-Type header. Four info items cover error message leakage, debug logging of user IDs, test type assertions, and large-scale code duplication between index.ts and provider modules.

## Critical Issues

### CR-01: Gemini API key leaked in URL query parameter (server-side)

**File:** `supabase/functions/ai-proxy/providers/gemini.ts:9` (also lines 101, 133)
**Issue:** The Gemini API key is appended as a URL query parameter (`?key=${apiKey}`) for chat, image, and predict endpoints. This occurs on the server side in the edge function. URL parameters are logged by web servers, proxies, CDNs, and browser histories. The same pattern is duplicated inline in `index.ts` at lines 256, 1038, 1070. This is distinct from the known CR-01 in the prior review (client-side Live SDK) -- this is the server-side proxy that should be fully protecting keys.
**Fix:**
```typescript
// Instead of:
fetch(`https://...?key=${apiKey}`, { ... })

// Use the x-goog-api-key header:
fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  },
  body: JSON.stringify({ ... }),
})
```

### CR-02: SSRF via unsanitized imageUrl fetch in edge function

**File:** `supabase/functions/ai-proxy/index.ts:1218-1221` and `1241-1244`
**Issue:** When `body.imageUrl` is a regular URL (not data:), the edge function fetches it server-side without validating the hostname or protocol. An authenticated attacker can supply an internal network URL (e.g., `http://169.254.169.254/latest/meta-data/` on AWS/GCP) to read cloud metadata, or `http://localhost:5432/...` to probe internal services. This is a Server-Side Request Forgery vulnerability.
**Fix:**
```typescript
function isSafeImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const hostname = parsed.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') return false
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) return false
    if (hostname.startsWith('172.') && parseInt(hostname.split('.')[1]) >= 16 && parseInt(hostname.split('.')[1]) <= 31) return false
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') return false
    return true
  } catch {
    return false
  }
}
// Then before fetch(body.imageUrl):
if (!isSafeImageUrl(body.imageUrl)) {
  throw new Error('Image URL must be a publicly accessible HTTPS or HTTP URL')
}
```

## Warnings

### WR-01: detectSource misroutes Groq models with openai/ prefix

**File:** `src/services/openai.ts:23-37`
**Issue:** The `detectSource` function uses prefix matching. Groq models `openai/gpt-oss-120b` and `openai/gpt-oss-20b` (listed in `settings.ts` lines 149-150) contain a `/` but do not match the Groq prefixes (`llama-`, `meta-llama/`, `qwen/`, `canopylabs/`, `whisper-large-v3`). They fall through to the `modelId.includes('/')` check which maps them to `'openrouter'` instead of `'groq'`. This causes chat completion calls for these Groq models to be sent to the wrong provider's API key and endpoint.
**Fix:**
```typescript
function detectSource(modelId: string): Source {
  if (modelId.startsWith('gemini')) return 'genai';
  if (
    modelId.startsWith('llama-') ||
    modelId.startsWith('meta-llama/') ||
    modelId.startsWith('qwen/') ||
    modelId.startsWith('canopylabs/') ||
    modelId.startsWith('whisper-large-v3') ||
    modelId.startsWith('openai/gpt-oss')  // Groq-hosted OSS models
  ) {
    return 'groq';
  }
  if (modelId.includes('/')) return 'openrouter';
  return 'openai';
}
```

### WR-02: Farewell detection matches false positives in LiveSession

**File:** `src/components/live-roleplay/LiveSession.tsx:60-61`
**Issue:** The `checkForFarewell` function uses `text.toLowerCase().trim().includes(f)` for each farewell keyword. The keyword `'bye'` matches inside "by the way" (partial word match), and `'have a good'` matches many non-farewell sentences like "I have a good idea" or "Do you have a good map?". This can prematurely trigger conversation end and call `onEnd` while the user is mid-conversation.
**Fix:**
```typescript
const checkForFarewell = useCallback((text: string) => {
  const lower = text.toLowerCase().trim();
  const farewells = [
    /\bbye\b/i, /\bgoodbye\b/i, /\bsee you\b/i, /\btake care\b/i,
    /\bhave a good\s+(day|night|one|trip|time|evening|morning)\b/i,
    /\bthanks,?\s*bye\b/i, /\bthank you,?\s*bye\b/i,
  ];
  return farewells.some(pattern => pattern.test(lower));
}, []);
```

### WR-03: Potential NaN when computing average score with empty array

**File:** `src/components/review/ReviewPage.tsx:185`
**Issue:** `sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length` produces `NaN` if `sessionScores` is empty (0/0). While the UI guard at line 142 (`currentIndex < dueCards.length - 1`) and the fact that `sessionComplete` is only set after processing at least one card makes this unlikely in practice, there is no explicit guard. If a race condition or state desync caused `sessionComplete` to be true with an empty scores array, this would render `NaN` to the user.
**Fix:**
```typescript
const avgScore = sessionScores.length > 0
  ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length
  : 0;
```

### WR-04: Edge function provider modules are dead code (not imported)

**File:** `supabase/functions/ai-proxy/providers/*.ts` (all 5 files), `supabase/functions/ai-proxy/crypto.ts`, `supabase/functions/ai-proxy/utils.ts`
**Issue:** The provider modules (`gemini.ts`, `groq.ts`, `openai.ts`, `openrouter.ts`, `vertex.ts`) and utility modules (`crypto.ts`, `utils.ts`) are not imported by `index.ts`. The main edge function file still contains all the same logic inline (1434 lines). Any bug fix must be applied in two places, increasing drift risk. This was noted in the prior review (IN-01/WR-06) and has not been addressed. The duplication has now expanded with the addition of provider modules that duplicate the inline code.
**Fix:** Have `index.ts` import from the provider modules and remove all inline function declarations.

### WR-05: CORS response headers missing Content-Type

**File:** `supabase/functions/ai-proxy/index.ts:13-16`
**Issue:** The `corsHeaders` object sets `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers` but does not include `Content-Type: application/json`. Every successful response returns JSON without explicitly setting the Content-Type header in the response. While the body is JSON, the response may be served without a proper MIME type, causing issues with strict CORS configurations or content sniffing.
**Fix:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}
```

## Info

### IN-01: Error handler leaks internal details to client

**File:** `supabase/functions/ai-proxy/index.ts:1426-1432`
**Issue:** The catch-all error handler returns `error.message` directly to the client with status 400. Upstream API error responses may include partial API keys, internal URLs, or stack traces. For example, OpenAI errors include the full request path. Consider sanitizing error messages before returning to the client.

### IN-02: Plaintext user ID logged during key migration

**File:** `supabase/functions/ai-proxy/index.ts:169`
**Issue:** `console.log(\`Migrated plaintext key for user ${userId}, source ${source}\`)` logs the user ID in plaintext. In production, edge function logs are accessible to project administrators. Consider logging only a hashed or truncated user identifier to reduce PII exposure in logs.

### IN-03: Test files use `as any` type assertions extensively

**File:** `src/services/errorAnalysis.test.ts:143,161,176` and `src/services/supabase/storage.test.ts:53`
**Issue:** Several test files use `as any[]` or `as any` to bypass TypeScript checking on mock data. While acceptable in test code, using proper typed factory functions (like the `makeCard` helper already present in `storage.test.ts`) would improve test reliability and catch interface drift.

### IN-04: Duplicate code between index.ts and provider modules (~800 lines)

**File:** `supabase/functions/ai-proxy/index.ts` vs `supabase/functions/ai-proxy/providers/gemini.ts` (and others)
**Issue:** The `geminiChat`, `geminiTTS`, `geminiSTT`, `geminiImage` functions in `index.ts` are character-for-character identical to the exports in `providers/gemini.ts`. The same duplication exists for OpenAI, Groq, OpenRouter, and Vertex providers, as well as `crypto.ts` (encrypt/decrypt/deriveKey) and `utils.ts` (uint8ToBase64, pcm16ToWav, str2ab). This is approximately 800 lines of duplicated code. Related to WR-04 but tracked separately as a maintainability concern.

---

_Reviewed: 2026-04-11T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
