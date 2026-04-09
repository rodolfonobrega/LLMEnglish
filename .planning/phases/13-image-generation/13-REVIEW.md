---
phase: 13-image-generation
reviewed: 2026-04-08T12:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/services/supabase/aiProxy.ts
  - src/services/supabase/aiProxy.test.ts
  - src/config/images.ts
  - src/config/images.test.ts
  - supabase/functions/ai-proxy/index.ts
  - supabase/functions/ai-proxy/providers/openai.ts
  - supabase/functions/ai-proxy/providers/gemini.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-04-08T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the image generation pipeline: client-side proxy layer (`aiProxy.ts`), image configuration (`images.ts`), edge function (`ai-proxy/index.ts`), and extracted provider modules (`providers/openai.ts`, `providers/gemini.ts`).

The architecture is sound -- the proxy pattern keeps API keys server-side, and the config layer cleanly separates OpenAI vs Gemini parameters. However, there is a significant bug where the edge function's inline `openaiImage` ignores several image parameters that the client correctly sends. There is also a mismatch between the client and server for the Vertex live token response shape. The extracted provider modules duplicate code from the edge function but are not actually imported by it.

## Warnings

### WR-01: Edge function `openaiImage` drops OpenAI image parameters

**File:** `supabase/functions/ai-proxy/index.ts:927-955`
**Issue:** The inline `openaiImage` function in the edge function only forwards `size` and `quality` from the options object. The client (`aiProxy.ts`) sends `format`, `compression`, `background`, and `moderation` parameters (lines 213-217), and the extracted provider module (`providers/openai.ts`) correctly forwards all of them (lines 93-97). But the actual edge function code ignores these four parameters, meaning OpenAI image generation always uses default values for format, compression, background, and moderation regardless of what the client requests.
**Fix:**
```typescript
// In openaiImage function (index.ts line ~928), add the missing parameter forwarding:
async function openaiImage(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
  const body: Record<string, unknown> = { model, prompt, n: 1 }

  if (options.size) body.size = options.size
  if (options.quality) body.quality = options.quality
  if (options.format) body.format = options.format         // MISSING
  if (options.compression) body.compression = options.compression  // MISSING
  if (options.background) body.background = options.background     // MISSING
  if (options.moderation) body.moderation = options.moderation     // MISSING
  // ... rest unchanged
```

### WR-02: Vertex live token response shape mismatch between client and server

**File:** `supabase/functions/ai-proxy/index.ts:1354-1358` and `src/services/supabase/aiProxy.ts:256-261`
**Issue:** The edge function returns `{ accessToken, projectId, region }` (three fields), but the client casts the response as `{ token: string }` and only reads `.token`. This means `getVertexLiveToken()` on the client will return `undefined` at runtime because the response object has no `token` property -- it uses `accessToken` instead.
**Fix:** Either change the client to match the server:
```typescript
// Option A: Fix client (aiProxy.ts line 256-261)
const result = await callAIProxy({
  action: 'get_vertex_live_token',
}) as { accessToken: string; projectId: string; region: string }
return result.accessToken
```
Or change the server to match the client:
```typescript
// Option B: Fix server (index.ts line 1354-1358)
return new Response(
  JSON.stringify({ token: accessToken }),
  { headers: corsHeaders }
)
```

### WR-03: `generateImage` client uses unsafe type assertion without validation

**File:** `src/services/supabase/aiProxy.ts:222-228`
**Issue:** The `generateImage` function casts the proxy response as `{ imageUrl: string } | { imageData: string }` without any runtime validation. If the edge function returns an unexpected shape (e.g., an error object that somehow passed the `response.ok` check), the `'imageUrl' in result` check would return `false` and the function would return `result.imageData` which would be `undefined`. This would propagate an `undefined` value as a string to callers.
**Fix:**
```typescript
export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  const result = await callAIProxy({
    // ... existing fields
  }) as Record<string, unknown>

  if (result && typeof result === 'object') {
    if (typeof result.imageUrl === 'string') return result.imageUrl
    if (typeof result.imageData === 'string') return result.imageData
  }

  throw new Error('Image generation returned unexpected response format')
}
```

## Info

### IN-01: Extracted provider modules not used by edge function

**File:** `supabase/functions/ai-proxy/providers/openai.ts` and `supabase/functions/ai-proxy/providers/gemini.ts`
**Issue:** These two provider modules contain image generation functions (`image()`) that are complete and support all parameters. However, the edge function (`index.ts`) has its own inline copies of `openaiImage` and `geminiImage` that it actually uses. The provider modules appear to be intended for a future refactor but are currently dead code. This creates a maintenance risk because the two copies have already diverged (e.g., `openaiImage` in `index.ts` is missing parameters that `providers/openai.ts` has).
**Fix:** Import and use the provider modules in the edge function, or remove them if they are not yet intended to be active.

### IN-02: `getImageConfigAuto` not tested

**File:** `src/config/images.test.ts`
**Issue:** The test file covers `IMAGE_CONFIG` values and the `getImageConfig()` function but does not test `getImageConfigAuto()`, which reads the model config from localStorage. This function is the one most likely to be called by UI components and could fail if `getModelConfig()` returns an unexpected `imageSource` value.
**Fix:** Add tests for `getImageConfigAuto` with mocked `getModelConfig` return values, including edge cases where `imageSource` might be an unexpected value.

### IN-03: `getImageConfigAuto` lacks validation for `imageSource`

**File:** `src/config/images.ts:165-168`
**Issue:** `getImageConfigAuto` passes `config.imageSource` directly to `getImageConfig`, which only accepts `'genai' | 'vertex' | 'openai' | 'openrouter'`. If `getModelConfig()` returns a different value (e.g., `'groq'` or `undefined`), TypeScript would not catch it at runtime and the function would fall through to the OpenAI path via the else branch.
**Fix:** Add a runtime check or default:
```typescript
export function getImageConfigAuto(context: ImageContext): ImageOptions {
  const config = getModelConfigImport();
  const validSources = ['genai', 'vertex', 'openai', 'openrouter'] as const;
  const source = validSources.includes(config.imageSource as typeof validSources[number])
    ? (config.imageSource as typeof validSources[number])
    : 'openai'; // safe default
  return getImageConfig(context, source);
}
```

---

_Reviewed: 2026-04-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
