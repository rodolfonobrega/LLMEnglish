---
phase: 13-image-generation
reviewed: 2026-04-08T12:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/config/images.test.ts
  - src/config/images.ts
  - src/services/supabase/aiProxy.test.ts
  - src/services/supabase/aiProxy.ts
  - supabase/functions/ai-proxy/index.ts
  - supabase/functions/ai-proxy/providers/gemini.ts
  - supabase/functions/ai-proxy/providers/openai.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the image generation pipeline: client-side proxy layer (`aiProxy.ts`), image configuration (`images.ts`), edge function (`ai-proxy/index.ts`), and extracted provider modules (`providers/openai.ts`, `providers/gemini.ts`), along with their tests.

The architecture is sound -- the proxy pattern keeps API keys server-side, and the config layer cleanly separates OpenAI vs Gemini parameters. The new image config module and its tests are well-structured with no issues.

One critical issue was found: the `btoa(String.fromCharCode(...Uint8Array))` pattern used across the edge function and providers will crash with a call stack overflow on binary responses larger than ~65KB (TTS audio, images). Several warnings address missing null safety on API response traversal, falsy checks that silently drop valid zero values, and a response shape mismatch between client and server for the Vertex live token endpoint.

## Critical Issues

### CR-01: btoa with spread operator crashes on large binary responses

**File:** `supabase/functions/ai-proxy/index.ts:319`
**Also:** `index.ts:375`, `index.ts:519`, `index.ts:1075`, `providers/gemini.ts:53`, `providers/openai.ts:53`
**Issue:** `btoa(String.fromCharCode(...new Uint8Array(buffer)))` uses the spread operator to convert a `Uint8Array` to function arguments. JavaScript engines limit argument count to ~65,536. TTS audio responses and image payloads routinely exceed this, causing `RangeError: Maximum call stack size exceeded`. This affects OpenAI TTS, Groq TTS, OpenRouter TTS, and the `pcm16ToWav` helper.
**Fix:**
```typescript
// Add a shared utility function:
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// Then replace all instances of:
btoa(String.fromCharCode(...new Uint8Array(buffer)))
// With:
uint8ToBase64(new Uint8Array(buffer))
```

## Warnings

### WR-01: Vertex live token response shape mismatch between client and server

**File:** `supabase/functions/ai-proxy/index.ts:1354-1358` and `src/services/supabase/aiProxy.ts:256-261`
**Issue:** The edge function returns `{ accessToken, projectId, region }` (three fields), but the client casts the response as `{ token: string }` and only reads `.token`. This means `getVertexLiveToken()` returns `undefined` at runtime because the response has no `token` property -- it uses `accessToken` instead.
**Fix:**
```typescript
// Option A (fix client, aiProxy.ts line 256-261):
const result = await callAIProxy({
  action: 'get_vertex_live_token',
}) as { accessToken: string; projectId: string; region: string }
return result.accessToken
```

### WR-02: Falsy checks silently override valid zero values for numeric options

**File:** `supabase/functions/ai-proxy/providers/gemini.ts:94`
**Also:** `providers/gemini.ts:91-93`, `providers/openai.ts:92-97`, `index.ts:930-935`, `index.ts:839`, `index.ts:873`, `index.ts:972-974`, `index.ts:1007`
**Issue:** Image generation options like `compression` are checked with simple truthiness (`if (options.compression)`). The `compression` field accepts values 0-100 per the config documentation (line 23 of `images.ts`), so `0` is a valid value. Passing `compression: 0` would be silently dropped. Similarly, `numberOfImages: 0` would be overridden to `1`.
**Fix:**
```typescript
// Instead of:
if (options.compression) body.compression = options.compression
// Use:
if (options.compression !== undefined) body.compression = options.compression
```

### WR-03: Missing null safety on deeply nested API response traversal

**File:** `supabase/functions/ai-proxy/index.ts:237`
**Also:** `index.ts:263`, `index.ts:293`, `index.ts:491`, `index.ts:712`, `index.ts:755`, `index.ts:824`, `index.ts:1200`, `providers/gemini.ts:27`, `providers/openai.ts:26`
**Issue:** Multiple locations access deeply nested properties like `data.choices[0].message.content` or `data.candidates[0].content.parts[0].text` without null/undefined guards. If an AI provider returns a safety block, empty candidates array, or unexpected format, this throws an unhelpful `TypeError: Cannot read properties of undefined` instead of a meaningful error message.
**Fix:**
```typescript
// Instead of:
return data.choices[0].message.content
// Use:
const content = data.choices?.[0]?.message?.content
if (!content) throw new Error('AI provider returned empty response')
return content
```

## Info

### IN-01: Extracted provider modules are dead code -- not imported by edge function

**File:** `supabase/functions/ai-proxy/providers/openai.ts` and `supabase/functions/ai-proxy/providers/gemini.ts`
**Issue:** These provider modules contain image generation functions with full parameter support, but the edge function (`index.ts`) uses its own inline copies (`openaiImage`, `geminiImage`). The provider modules are not imported anywhere. This creates a maintenance risk since the two copies have already diverged slightly (e.g., the provider modules use `!== undefined` checks in some places while the inline versions use truthiness checks).
**Fix:** Import and use the provider modules in the edge function, removing the duplicated inline implementations.

### IN-02: Redundant ternary in openrouterImage always returns the same value

**File:** `supabase/functions/ai-proxy/index.ts:589`
**Issue:** `imageUrl.startsWith('data:') ? imageUrl : imageUrl` is a no-op ternary that always returns `imageUrl` regardless of the condition.
**Fix:** Replace with `return imageUrl`.

### IN-03: `getImageConfigAuto` lacks runtime validation for `imageSource`

**File:** `src/config/images.ts:165-168`
**Issue:** `getImageConfigAuto` passes `config.imageSource` directly to `getImageConfig`, which only accepts `'genai' | 'vertex' | 'openai' | 'openrouter'`. If `getModelConfig()` returns a different value (e.g., `'groq'` or `undefined`), TypeScript would not catch it at runtime and the function would fall through to the OpenAI path via the else branch, which may not be the intended behavior.
**Fix:** Add a runtime guard or default to a safe fallback:
```typescript
export function getImageConfigAuto(context: ImageContext): ImageOptions {
  const config = getModelConfigImport();
  const source = config.imageSource ?? 'openai';
  return getImageConfig(context, source as Parameters<typeof getImageConfig>[1]);
}
```

---

_Reviewed: 2026-04-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
