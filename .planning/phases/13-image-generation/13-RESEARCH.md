# Phase 13: Image Generation - Research

**Researched:** 2026-04-08
**Domain:** Image generation across Gemini (Imagen + native) and OpenAI (GPT Image) via Supabase Edge Function proxy
**Confidence:** MEDIUM (web tools rate-limited; codebase findings are HIGH confidence, API correctness is MEDIUM)

## Summary

This phase addresses three merged backlog items: (1) verifying dialog/screen image creation works end-to-end, (2) fixing Gemini image generation model API calls, and (3) optimizing image resolution to reduce token usage and cost. Codebase investigation reveals a **critical option-forwarding bug** between the client proxy layer and the edge function -- most image generation options (quality, format, compression, background, moderation, imageSize, personGeneration) are silently dropped. Additionally, the edge function's default image model is stale (`gemini-2.5-flash-image`) while the client default is `gemini-3.1-flash-image-preview`.

The image generation pipeline has three consumer contexts: `imageMode` (discovery page), `exerciseMode` (mixed exercises), and `scenarioThumbnail` (live roleplay). Each has its own config in `src/config/images.ts` with provider-specific parameters, but most never reach the edge function.

**Primary recommendation:** Fix the option-forwarding pipeline first (client -> proxy -> edge function -> provider), then verify each Gemini model variant's API endpoint, then optimize resolution/format for cost reduction.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| 999.5 | Verify dialog screen image creation works correctly | Image generation flow traced from UI components through proxy to edge function; critical forwarding bugs found |
| 999.6 | Fix Gemini image generation models -- API call errors | Two Gemini code paths identified (Imagen `:predict` vs native `:generateContent`); default model mismatch found |
| 999.7 | Optimize resolution to reduce token usage and cost | Current config uses PNG at 1024x1024; JPEG/WebP with compression would reduce base64 payload significantly |

## Architecture Overview

### Image Generation Pipeline

```
UI Component (ImageMode / ScenarioSetup)
  -> src/services/openai.ts::generateImage(prompt, options)
    -> src/services/supabase/aiProxy.ts::generateImage(options)  // DROPS most options
      -> callAIProxy({ action: 'image', prompt, model, source, size, aspectRatio, numberOfImages })
        -> Edge Function index.ts::handleImage(body, uid)
          -> Extracts: { size, aspectRatio, imageSize, numberOfImages }  // STILL incomplete
            -> providers/gemini.ts::image() or providers/openai.ts::image()
```

### Three Consumer Contexts

| Context | Component | Config Key | Purpose |
|---------|-----------|------------|---------|
| `imageMode` | `src/components/discovery/ImageMode.tsx` | `IMAGE_CONFIG.imageMode` | Discovery page visual challenge |
| `exerciseMode` | `src/components/discovery/ExerciseMode.tsx` | `IMAGE_CONFIG.exerciseMode` | Mixed exercises with image type |
| `scenarioThumbnail` | `src/components/live-roleplay/ScenarioSetup.tsx` | `IMAGE_CONFIG.scenarioThumbnail` | Roleplay scene thumbnails |

### Configured Image Models (from `src/types/settings.ts`)

**Gemini (Google AI Studio):**
- `gemini-3.1-flash-image-preview` (default) -- "Nano Banana 2"
- `gemini-3-pro-image-preview` -- "Nano Banana Pro"
- `gemini-2.5-flash-image` -- "Nano Banana"

**Gemini (Vertex AI):** Same three models with `vertex` source

**OpenAI:**
- `gpt-image-1.5` -- "Best"
- `gpt-image-1-mini` -- "Fast & Affordable"
- `gpt-image-1` -- "Balanced"

**OpenRouter:**
- `google/gemini-3.1-flash-image-preview`
- `google/gemini-2.5-flash-image`
- `openai/gpt-5-image-mini`
- `openai/gpt-5-image`

### Default Config (from `src/types/settings.ts` line 74-75)

```
imageModel: 'gemini-3.1-flash-image-preview',
imageSource: 'genai',
```

## Critical Bugs Found

### Bug 1: Option Forwarding Gap in Client Proxy

**Location:** `src/services/supabase/aiProxy.ts` lines 197-206

The `generateImage` function in the proxy only forwards these options to the edge function:
- `prompt`, `model`, `source` (always sent)
- `size`, `aspectRatio`, `numberOfImages` (conditional)

**DROPPED options that are configured but never sent:**
- OpenAI: `quality`, `format`, `compression`, `background`, `moderation`
- Imagen: `imageSize`, `personGeneration`

**Impact:** The `quality: 'medium'` in ImageMode config is never applied. The `compression: 85` in scenarioThumbnail config is never applied. All resolution optimization attempts (Bug 3 target) are currently no-ops.

### Bug 2: Edge Function Also Drops Options

**Location:** `supabase/functions/ai-proxy/index.ts` line 72

```typescript
const opts = { size: body.size, aspectRatio: body.aspectRatio, imageSize: body.imageSize, numberOfImages: body.numberOfImages }
```

Even if the proxy forwarded all options, the edge function only reads 4 of them. Missing: `quality`, `format`, `compression`, `background`, `moderation`, `personGeneration`.

### Bug 3: Stale Default Model in Edge Function

**Location:** `supabase/functions/ai-proxy/index.ts` line 71

```typescript
const model = (body.model || (isGlmLike(source) ? 'gemini-2.5-flash-image' : 'gpt-image-1')) as string
```

The client default is `gemini-3.1-flash-image-preview`, but the edge function fallback is `gemini-2.5-flash-image`. This matters only when no model is explicitly sent (which shouldn't happen normally since the client always sends `config.imageModel`), but it's an inconsistency.

## Gemini Image Generation: Two API Paths

The edge function's `providers/gemini.ts` has two distinct code paths:

### Path 1: Imagen Models (model.startsWith('imagen-'))

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predict
Body: { instances: [{ prompt }], parameters: { responseModalities: ['IMAGE'], aspectRatio, imageSize, numberOfImages } }
Response: { predictions: [{ bytesBase64: "..." }] }
```

**IMPORTANT:** None of the currently configured models start with `imagen-`. All Gemini image models in settings are `gemini-*` models. This code path is effectively dead for the current configuration. [VERIFIED: code inspection]

### Path 2: Native Gemini Models (gemini-* prefix)

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], aspectRatio, imageSize } }
Response: { candidates: [{ content: { parts: [{ inlineData: { mimeType, data } }] } }] }
```

This is the active code path for all current Gemini image models. It supports `aspectRatio` and `imageSize` parameters. [VERIFIED: code inspection]

### Potential API Issue (999.6)

The `:generateContent` endpoint with `responseModalities: ['IMAGE']` is the correct approach for Gemini 2.5+ native image generation. However:

1. **`gemini-3.1-flash-image-preview`** and **`gemini-3-pro-image-preview`** are newer models (named in settings) -- these may require the same `:generateContent` endpoint but could have different parameter support or response format. [ASSUMED]
2. **`imageSize` parameter** may not be supported by the `:generateContent` endpoint (it's an Imagen-specific parameter). If the edge function sends it, it could cause errors. [ASSUMED]
3. The **`:predict` endpoint** on `generativelanguage.googleapis.com` (AI Studio) may not work -- this endpoint is designed for Vertex AI Imagen models. [ASSUMED]

## Resolution Optimization Analysis

### Current Configuration

| Context | OpenAI Size | OpenAI Quality | OpenAI Format | Gemini Resolution | Gemini imageSize |
|---------|-------------|----------------|---------------|-------------------|-----------------|
| imageMode | 1024x1024 | medium | png | 1:1 | 1K |
| exerciseMode | 1024x1024 | medium | png | 1:1 | 1K |
| scenarioThumbnail | 1536x1024 | low | jpeg (85%) | 16:9 | 1K |

### Token/Cost Impact

Images are returned as base64 `data:` URIs and displayed in `<img>` tags or passed to `chatCompletionWithImage`. For the ImageMode flow:
1. Image is generated -> returns base64 data URI
2. Image is displayed in `<img>` tag (no token cost for display)
3. Image is passed to `chatCompletionWithImage` -> sent to AI model for question generation

**Key optimization opportunities:**
- **Format:** PNG is uncompressed; switching to JPEG or WebP can reduce base64 payload by 60-80%
- **Quality:** `medium` could be `low` for thumbnails that are small on screen
- **Resolution:** 1K is already the lowest Gemini option; OpenAI could use smaller sizes
- **Scenario thumbnails** already use JPEG with 85% compression -- but this is currently a no-op due to Bug 1

**Note:** The `chatCompletionWithImage` flow sends the full base64 image to the AI model, which counts as input tokens. Smaller/compressed images = fewer tokens = lower cost. [ASSUMED -- token counting varies by provider]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image generation API calls | Custom fetch logic per provider | Existing provider modules in `supabase/functions/ai-proxy/providers/` | Already handles two Gemini paths + OpenAI + Vertex |
| Image config per context | Hardcoded params in components | `src/config/images.ts` + `getImageConfigAuto()` | Already structured with provider-specific config |
| Model-source resolution | Custom model detection | `src/services/modelCatalog.ts` `resolveSource()` | Already handles all models with heuristic fallback |

## Common Pitfalls

### Pitfall 1: Imagen Parameters Sent to Native Gemini Models
**What goes wrong:** The config includes `imageSize` (Imagen parameter) but the native Gemini `:generateContent` endpoint may not support it, causing silent failure or errors.
**Why it happens:** Config types (`ImageOptions`) combine OpenAI + Imagen params into one type, making it easy to mix.
**How to avoid:** Validate that only supported parameters are sent per model/provider combination.
**Warning signs:** 400 errors from Gemini API, or images always at default resolution despite config changes.

### Pitfall 2: Base64 Image Size in Chat Completion
**What goes wrong:** Sending a large PNG base64 image to `chatCompletionWithImage` uses excessive tokens.
**Why it happens:** PNG format has no compression tuning; 1024x1024 PNG can be 1-3MB base64.
**How to avoid:** Use JPEG/WebP format for OpenAI, ensure Gemini returns compressed output, consider resizing before sending to chat model.
**Warning signs:** Slow chat responses, high API costs, rate limiting.

### Pitfall 3: Stale Edge Function Default Model
**What goes wrong:** If model is somehow not sent, edge function falls back to `gemini-2.5-flash-image` which may not exist or have different API behavior.
**Why it happens:** Edge function defaults are not kept in sync with client defaults in `settings.ts`.
**How to avoid:** Always send model explicitly; update edge function defaults to match client defaults.

### Pitfall 4: Option Forwarding Debugging Black Hole
**What goes wrong:** Options appear to be configured correctly in `images.ts` but never take effect, with no error or warning.
**Why it happens:** Options are silently dropped at the proxy layer -- no validation, no warning.
**How to avoid:** Fix the forwarding chain to pass all options through; add validation/logging.

## Code Examples

### Fix: Proxy Option Forwarding (aiProxy.ts)

```typescript
// Current (BROKEN -- drops most options):
export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'image',
    prompt: options.prompt,
    model: options.model,
    source: options.source,
    size: options.size,
    aspectRatio: options.aspectRatio,
    numberOfImages: options.numberOfImages,
  }) as { imageUrl: string } | { imageData: string }
  // ...
}

// Fixed (forward ALL options):
export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  const result = await callAIProxy({
    action: 'image',
    prompt: options.prompt,
    model: options.model,
    source: options.source,
    size: options.size,
    quality: options.quality,
    format: options.format,
    compression: options.compression,
    background: options.background,
    moderation: options.moderation,
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize,
    personGeneration: options.personGeneration,
    numberOfImages: options.numberOfImages,
  }) as { imageUrl: string } | { imageData: string }
  // ...
}
```

### Fix: Edge Function Option Extraction (index.ts)

```typescript
// Current (incomplete):
const opts = { size: body.size, aspectRatio: body.aspectRatio, imageSize: body.imageSize, numberOfImages: body.numberOfImages }

// Fixed (extract all options):
const opts = {
  size: body.size, quality: body.quality, format: body.format,
  compression: body.compression, background: body.background,
  moderation: body.moderation,
  aspectRatio: body.aspectRatio, imageSize: body.imageSize,
  personGeneration: body.personGeneration,
  numberOfImages: body.numberOfImages,
}
```

### Fix: OpenAI Provider (pass all options)

```typescript
// providers/openai.ts -- current only uses size and quality
export async function image(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> {
  const body: Record<string, unknown> = { model, prompt, n: 1 }
  if (options.size) body.size = options.size
  if (options.quality) body.quality = options.quality
  // ADD: format, compression, background, moderation
  if (options.format) body.format = options.format
  if (options.compression) body.compression = options.compression
  if (options.background) body.background = options.background
  if (options.moderation) body.moderation = options.moderation
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imagen 3 via `:predict` endpoint | Gemini native image via `:generateContent` | 2025 | Gemini 2.5+ models generate images natively via generateContent with `responseModalities: ['IMAGE']` |
| DALL-E 3 separate API | GPT Image unified API | 2025 | OpenAI now uses `gpt-image-*` models with `/v1/images/generations` endpoint supporting quality, format, compression |
| Fixed PNG output | Configurable format (PNG/JPEG/WebP) | 2025 | Can now choose output format and compression level |

**Potentially outdated:**
- `imagen-4.0-generate-001` models referenced in `config/images.ts` comments are NOT in the active model catalog -- only `gemini-*` models are configured [VERIFIED: settings.ts inspection]
- The Imagen code path (`:predict` endpoint) may not work with Google AI Studio API keys [ASSUMED]

## Files Involved

### Client-Side (UI + Config)
- `src/config/images.ts` -- Image configuration per context (imageMode, exerciseMode, scenarioThumbnail)
- `src/components/discovery/ImageMode.tsx` -- Discovery page image challenge UI
- `src/components/live-roleplay/ScenarioSetup.tsx` -- Roleplay scenario thumbnail generation
- `src/components/discovery/ExerciseMode.tsx` -- Uses ImageMode component

### Client-Side (Service Layer)
- `src/services/openai.ts` -- Facade that routes to proxy (lines 169-177)
- `src/services/supabase/aiProxy.ts` -- Proxy client (generateImage, lines 197-212)
- `src/services/runtimeState.ts` -- Provides model config (imageModel, imageSource)
- `src/services/modelCatalog.ts` -- Model-to-source resolution

### Edge Function (Server)
- `supabase/functions/ai-proxy/index.ts` -- Request handler (handleImage, line 69-77)
- `supabase/functions/ai-proxy/providers/gemini.ts` -- Gemini image generation (lines 83-158)
- `supabase/functions/ai-proxy/providers/openai.ts` -- OpenAI image generation (lines 89-117)

### Type Definitions
- `src/types/settings.ts` -- Model options, default config, IMAGE_MODELS array

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `:generateContent` with `responseModalities: ['IMAGE']` works for `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview` | Gemini API Paths | API calls fail for newer models; need different endpoint or parameters |
| A2 | `imageSize` parameter is not supported by `:generateContent` (Imagen-only) | Gemini API Paths | imageSize is silently ignored (low risk) or causes error (needs testing) |
| A3 | `:predict` endpoint on `generativelanguage.googleapis.com` may not work for Imagen via AI Studio keys | Gemini API Paths | Imagen models would fail; only relevant if user configures Imagen models |
| A4 | Smaller/compressed images reduce token count for `chatCompletionWithImage` calls | Resolution Optimization | If providers tokenize images differently, optimization may not reduce cost as expected |
| A5 | OpenAI GPT Image API supports `format`, `compression`, `background`, `moderation` parameters | OpenAI Provider Fix | If these params are rejected, need to handle gracefully |

## Open Questions

1. **Which Gemini image models actually work?**
   - What we know: The codebase lists 3 Gemini image models per source (genai, vertex, openrouter)
   - What's unclear: Whether `gemini-3.1-flash-image-preview` and `gemini-3-pro-image-preview` actually exist and work with the `:generateContent` endpoint
   - Recommendation: Manual testing of each model via the edge function is required; the phase should include a verification step

2. **Does `imageSize` work with `:generateContent`?**
   - What we know: `imageSize` is an Imagen parameter, but the code sends it to `:generateContent` too
   - What's unclear: Whether the API silently ignores it or returns an error
   - Recommendation: Test and remove from `:generateContent` path if not supported

3. **What is the actual token impact of image format/resolution?**
   - What we know: Larger base64 images mean more data over the wire
   - What's unclear: How each provider counts image tokens (per pixel? per byte? flat rate?)
   - Recommendation: Check provider docs; start with format optimization (PNG -> JPEG) which is always a win for transfer size

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Edge Function | Image generation via proxy | Remote only | Deployed | -- |
| Google AI Studio API key | Gemini image generation | User-configured | -- | OpenAI as fallback |
| OpenAI API key | GPT Image generation | User-configured | -- | Gemini as fallback |
| Node.js | Build/dev | Yes | -- | -- |

**Missing dependencies with no fallback:**
- None (all external dependencies are user-configured API keys)

**Missing dependencies with fallback:**
- Web search tools rate-limited -- relied on codebase inspection rather than external verification

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 999.5 | Image generation flow works end-to-end | integration | Manual testing only (requires API keys) | N/A |
| 999.5 | Options forwarded correctly through proxy | unit | `npx vitest run src/services/supabase/aiProxy.test.ts` | Needs creation |
| 999.6 | Gemini image model API calls succeed | integration | Manual testing only (requires API keys) | N/A |
| 999.6 | Edge function extracts all image options | unit | `npx vitest run supabase/functions/ai-proxy/index.test.ts` | Needs creation |
| 999.7 | Config produces optimized resolution params | unit | `npx vitest run src/config/images.test.ts` | Needs creation |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/config/images.test.ts` -- covers image config correctness (999.7)
- [ ] `src/services/supabase/aiProxy.test.ts` (image section) -- covers option forwarding (999.5)
- [ ] `supabase/functions/ai-proxy/index.test.ts` (image section) -- covers edge function option extraction (999.6)
- [ ] Note: End-to-end image generation testing requires live API keys and is manual-only

## Sources

### Primary (HIGH confidence)
- Codebase inspection of `src/config/images.ts`, `src/services/openai.ts`, `src/services/supabase/aiProxy.ts` -- full pipeline traced
- Codebase inspection of `supabase/functions/ai-proxy/index.ts`, `providers/gemini.ts`, `providers/openai.ts` -- server-side handling traced
- `src/types/settings.ts` -- model catalog and defaults verified
- Package registry: `@google/genai` current version is 1.49.0 (project uses ^1.0.0)

### Secondary (MEDIUM confidence)
- Gemini `:generateContent` with `responseModalities: ['IMAGE']` is the documented approach for Gemini 2.5+ native image generation [CITED: training knowledge of Google AI docs]

### Tertiary (LOW confidence)
- Web search unavailable (rate-limited); all external API claims marked [ASSUMED] in assumptions log
- Model availability (`gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`) not verified against live API [ASSUMED]

## Metadata

**Confidence breakdown:**
- Option forwarding bugs: HIGH -- verified by code inspection of all 4 layers
- Gemini API correctness: MEDIUM -- endpoint structure verified in code, but model compatibility not tested against live API
- Resolution optimization: MEDIUM -- format change is always beneficial for transfer size, but token cost impact varies by provider
- Pitfalls: HIGH -- based on direct code analysis

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable -- codebase findings; sooner if API models change)
