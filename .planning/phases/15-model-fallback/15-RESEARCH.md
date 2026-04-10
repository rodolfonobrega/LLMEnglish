# Phase 15: Model Fallback - Research

**Researched:** 2026-04-09
**Domain:** AI model fallback configuration and resilience
**Confidence:** HIGH

## Summary

The app already has a working fallback pattern for three AI service types (chat, STT, TTS) but is missing fallback for two others (image generation, live roleplay). The existing fallback infrastructure is solid: `ModelConfig` in `src/types/settings.ts` defines optional fallback fields (`chatFallbackModel/Source`, `sttFallbackModel/Source`, `ttsFallbackModel/Source/Voice`), `src/services/openai.ts` implements try-primary/catch-fallback logic for all three, and `SettingsPage.tsx` exposes `FallbackSection` UI components for users to configure them.

The gaps are: (1) **Image generation** has no fallback fields in `ModelConfig` and no fallback logic in `generateImage()`, (2) **Live roleplay** is hardcoded to `GeminiLiveSession` in `LiveSession.tsx` with no provider switching, (3) `chatCompletionWithImage()` has no fallback logic despite being a distinct code path from `chatCompletion()`. Additionally, the `withFallback()` function in `aiProxy.ts` is a dead function (SEC-04 eliminated direct API calls).

**Primary recommendation:** Add `imageFallbackModel/Source` fields to `ModelConfig`, add fallback logic to `generateImage()` and `chatCompletionWithImage()`, and refactor `LiveSession.tsx` to use a factory pattern that selects the live provider based on `liveSource` config. Do NOT add live fallback (WebSocket connections cannot meaningfully fail over mid-session).

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.2 | UI framework | Project standard |
| Vitest | 4.0 | Test runner | Already configured in vite.config.ts |
| TypeScript | 5.9 | Type safety | Project standard |

### No new dependencies needed
This phase is entirely about extending existing patterns. All required libraries are already installed.

## Architecture Patterns

### Current Fallback Pattern (existing, extend it)
**What:** Try primary model, on failure try fallback model, re-throw original error if both fail.
**Where:** `src/services/openai.ts` lines 42-69 (chat), 91-123 (TTS), 127-149 (STT).
**Pattern:**
```typescript
// Source: src/services/openai.ts [VERIFIED: codebase read]
try {
  return await proxyCall({ source, model, ...params });
} catch (primaryError) {
  if (config.XXXFallbackModel && config.XXXFallbackSource) {
    console.warn('Primary XXX failed, trying fallback:', primaryError);
    try {
      return await proxyCall({ source: config.XXXFallbackSource, model: config.XXXFallbackModel, ...params });
    } catch {
      throw primaryError;
    }
  }
  throw primaryError;
}
```

### Live Session Factory Pattern (needed)
**What:** Create the correct `ILiveSession` implementation based on `liveSource` config.
**Where:** `src/components/live-roleplay/LiveSession.tsx` line 60 (currently hardcoded `new GeminiLiveSession`).
**Current code (broken):**
```typescript
// Source: src/components/live-roleplay/LiveSession.tsx line 60
const session = new GeminiLiveSession({ ... });
```
**Should be:**
```typescript
const session = liveSource === 'openai'
  ? new OpenAIRealtimeLiveSession(callbacks)
  : new GeminiLiveSession(callbacks);
```

### Anti-Patterns to Avoid
- **Do NOT add live fallback (mid-session WebSocket failover):** WebSocket connections are stateful and long-lived. If the primary live provider fails at connect time, a retry with a different provider is possible, but mid-session failover would lose conversation state. Limit live "fallback" to initial connection failure only, and even that is complex. Better to just fix the provider selection first.
- **Do NOT revive `withFallback()`:** The function in `aiProxy.ts` is intentionally dead code (SEC-04). All calls go through the proxy. Fallback should happen at the `openai.ts` service level (switching model/source), not at the transport level.
- **Do NOT modify the edge function:** The edge function (`supabase/functions/ai-proxy/`) is a pass-through proxy. Fallback logic belongs client-side where the model config is available.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice normalization for fallback TTS | Custom voice mapping | `normalizeTtsVoice()` from `src/types/settings.ts` | Already handles cross-source voice normalization |
| Source detection from model ID | Custom prefix matching | `resolveSource()` from `src/services/modelCatalog.ts` | Already handles all providers with catalog + heuristic |

## Common Pitfalls

### Pitfall 1: Forgetting `chatCompletionWithImage` fallback
**What goes wrong:** `generateImage()` gets fallback but `chatCompletionWithImage()` is a separate function that also has no fallback.
**Why it happens:** The function looks similar to `chatCompletion()` but has a different code path (image mode, Groq source override).
**How to avoid:** Check all 5 exported functions in `openai.ts` and add fallback to both image-related functions.
**Warning signs:** Image-based exercises fail silently when primary image model is down.

### Pitfall 2: Live session hardcoded to Gemini
**What goes wrong:** User configures OpenAI as live provider but the app still creates `GeminiLiveSession`.
**Why it happens:** `LiveSession.tsx` line 60 hardcodes `new GeminiLiveSession()`.
**How to avoid:** Import both session classes, select based on `getModelConfig().liveSource`.
**Warning signs:** User changes live provider in Settings but behavior doesn't change.

### Pitfall 3: Fallback voice mismatch in TTS
**What goes wrong:** TTS fallback uses the primary voice name with a different source that doesn't support it.
**Why it happens:** The fallback code already handles this via `normalizeTtsVoice()` but new fallback additions must remember to use it.
**How to avoid:** Any TTS fallback code MUST use `normalizeTtsVoice()` before calling the proxy.

### Pitfall 4: Settings UI missing for new fallback fields
**What goes wrong:** Image fallback fields added to `ModelConfig` but no UI to configure them.
**Why it happens:** The `FallbackSection` component exists but is only rendered for chat/STT/TTS sections.
**How to avoid:** Add `FallbackSection` to the Image section in SettingsPage, add `handleFallbackSourceChange('image', ...)` and `handleFallbackModelChange('image', ...)` handlers.

### Pitfall 5: Migration breaks existing configs
**What goes wrong:** Adding new fallback fields causes `migrateModelConfig()` to strip unknown fields.
**Why it happens:** `migrateModelConfig()` builds a new object from `DEFAULT_MODEL_CONFIG` and copies only known fields.
**How to avoid:** Add the new fields (`imageFallbackModel`, `imageFallbackSource`) to `migrateModelConfig()` so they survive migration.

## Code Examples

### Adding image fallback to ModelConfig (types/settings.ts)
```typescript
// Source: existing pattern from src/types/settings.ts lines 53-61
// Add after ttsFallbackVoice:
imageFallbackModel?: string;
imageFallbackSource?: 'genai' | 'vertex' | 'openai' | 'openrouter';
```

### Adding image fallback to generateImage() (openai.ts)
```typescript
// Source: extending existing pattern from src/services/openai.ts
export async function generateImage(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<string> {
  const config = getRuntimeModelConfig();
  const source = config.imageSource;
  const model = config.imageModel;
  try {
    return await proxyImage({ source, model, prompt, ...options });
  } catch (primaryError) {
    if (config.imageFallbackModel && config.imageFallbackSource) {
      console.warn('Primary image generation failed, trying fallback:', primaryError);
      try {
        return await proxyImage({
          source: config.imageFallbackSource,
          model: config.imageFallbackModel,
          prompt,
          ...options,
        });
      } catch {
        throw primaryError;
      }
    }
    throw primaryError;
  }
}
```

### Live session factory (LiveSession.tsx)
```typescript
// Source: refactor of src/components/live-roleplay/LiveSession.tsx line 60
import { GeminiLiveSession } from '../../services/geminiLive';
import { OpenAIRealtimeLiveSession } from '../../services/openaiRealtimeLive';
import { getModelConfig } from '../../services/storage';

// Inside useEffect:
const { liveSource } = getModelConfig();
const session = liveSource === 'openai'
  ? new OpenAIRealtimeLiveSession(callbacks)
  : new GeminiLiveSession(callbacks);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `withFallback()` proxy+direct | Proxy-only (SEC-04) | Phase 10 (Edge Function Modularization) | Fallback now happens at model/source level, not transport level |
| Hardcoded Gemini Live | Configurable live provider | Phase 9 (Model Catalog) added `liveSource` | `liveSource` exists in config but `LiveSession.tsx` ignores it |

**Dead code to note:**
- `withFallback()` in `aiProxy.ts` (line 272-281): intentionally disabled, kept for API compat. Do NOT remove during this phase (out of scope).

## Files to Modify (Inventory)

| File | Change | Risk |
|------|--------|------|
| `src/types/settings.ts` | Add `imageFallbackModel/Source` to `ModelConfig`, update `DEFAULT_MODEL_CONFIG`, update `migrateModelConfig()` | LOW - additive type change |
| `src/services/openai.ts` | Add fallback logic to `generateImage()` and `chatCompletionWithImage()` | LOW - follows existing pattern |
| `src/components/settings/SettingsPage.tsx` | Add `FallbackSection` to Image section, add handlers for image fallback, add `handleFallbackSourceChange('image', ...)` | MEDIUM - UI change, must test rendering |
| `src/components/live-roleplay/LiveSession.tsx` | Factory pattern for live session based on `liveSource` | MEDIUM - live session is user-facing, regression risk |
| `src/services/openai.test.ts` | Add tests for image fallback and chatCompletionWithImage fallback | LOW - tests only |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Live session fallback should be limited to correct provider selection at connect time, not mid-session failover | Architecture Patterns | If user expects mid-session failover, scope increases significantly |
| A2 | No edge function changes needed for this phase | Architecture Patterns | If edge function needs to know about fallback, additional work required |
| A3 | `imageFallbackSource` type should match `imageSource` type (excludes 'groq') | Code Examples | Groq may add image generation support in future |

**Note:** A1 and A2 are LOW risk based on codebase analysis. A3 is VERY LOW risk (Groq currently has no image models).

## Open Questions

1. **Should live roleplay have connect-time fallback?**
   - What we know: Currently hardcoded to Gemini. `liveSource` config exists but is ignored. Both `GeminiLiveSession` and `OpenAIRealtimeLiveSession` implement `ILiveSession`.
   - What's unclear: Should the app try the alternate live provider if the primary fails at connect time?
   - Recommendation: Fix the provider selection first (respect `liveSource`). Connect-time fallback (try source B if source A fails) is a nice-to-have but adds complexity (different WebSocket URLs, different auth). Suggest deferring to a future phase.

2. **Should `chatCompletionWithImage` share fallback config with `generateImage`?**
   - What we know: `chatCompletionWithImage` uses `config.chatModel/chatSource` (not image config). It's a chat completion that happens to include an image.
   - What's unclear: Whether the fallback for image-in-chat should use `chatFallback` or `imageFallback`.
   - Recommendation: `chatCompletionWithImage` already uses chat config + has a Groq-to-Gemini hardcoded fallback. It should use `chatFallbackModel/Source` since it's semantically a chat operation. No new fields needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | Yes | Compatible with Vite 6.4 | - |
| Vitest | Test runner | Yes | 4.0 (in vite.config.ts) | - |
| jsdom | Test environment | Yes | 28 | - |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** N/A

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vite.config.ts (inline test config) |
| Quick run command | `npx vitest run src/services/openai.test.ts -t "fallback"` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMAGE-FALLBACK | generateImage tries fallback when primary fails | unit | `npx vitest run src/services/openai.test.ts -t "image fallback"` | Needs new test |
| IMAGE-CHAT-FALLBACK | chatCompletionWithImage tries fallback when primary fails | unit | `npx vitest run src/services/openai.test.ts -t "image chat fallback"` | Needs new test |
| LIVE-FACTORY | LiveSession creates correct provider based on liveSource | unit | `npx vitest run src/components/live-roleplay/LiveSession.test.tsx` | Needs new test file |
| SETTINGS-UI | Image fallback UI renders correctly | unit | `npx vitest run src/components/settings/SettingsPage.test.tsx` | Needs new test file |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/openai.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Image fallback tests in `src/services/openai.test.ts` - covers IMAGE-FALLBACK, IMAGE-CHAT-FALLBACK
- [ ] LiveSession provider selection test (may be smoke test since it involves WebSocket classes)

## Sources

### Primary (HIGH confidence)
- `src/types/settings.ts` - ModelConfig interface, fallback field definitions, model lists, DEFAULT_MODEL_CONFIG
- `src/services/openai.ts` - All AI service functions with existing fallback patterns
- `src/components/settings/SettingsPage.tsx` - FallbackSection component, handler functions
- `src/components/live-roleplay/LiveSession.tsx` - Hardcoded GeminiLiveSession instantiation
- `src/services/geminiLive.ts` - GeminiLiveSession class implementing ILiveSession
- `src/services/openaiRealtimeLive.ts` - OpenAIRealtimeLiveSession class implementing ILiveSession
- `src/services/supabase/aiProxy.ts` - Proxy layer, dead withFallback()
- `src/services/runtimeState.ts` - Runtime state management, model config getter
- `src/services/storage.ts` - Storage facade
- `src/services/modelCatalog.ts` - Source resolution

### Secondary (MEDIUM confidence)
- `src/services/openai.test.ts` - Existing test patterns for fallback behavior

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns exist in codebase
- Architecture: HIGH - all relevant source files read and analyzed
- Pitfalls: HIGH - identified from direct code inspection

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable - no external dependency changes expected)
