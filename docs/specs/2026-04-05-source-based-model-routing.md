# Source-Based Model Routing

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Expand AI provider system from 3 fixed providers to a flexible source-based routing architecture supporting OpenRouter and Vertex AI.

---

## Problem

SpeakLab currently supports 3 providers (`openai`, `gemini`, `groq`) with hardcoded dispatch logic. Users want:

1. Access to hundreds of models via **OpenRouter** (Claude, Llama, Mistral, etc.) through a single API key
2. **Vertex AI** for Gemini models (enterprise requirements: VPC, compliance, data residency)
3. Explicit visibility into **where** each model comes from (GenAI vs Vertex vs OpenRouter)
4. User-managed API keys (same pattern as today)

## Design Decision

**Approach:** "Source" as a first-class concept — separate from the model identity itself.

Introduce a `Source` type that represents **where** a model is accessed from. Each model slot in `ModelConfig` references a source explicitly. The UI shows sources as grouped sections in model dropdowns.

---

## 1. Types & Data Model

**File:** `src/types/settings.ts`

```ts
/** Where a model is accessed from. */
export type Source = 'genai' | 'vertex' | 'openrouter' | 'openai' | 'groq';

/** All configurable model slots in the app. */
export interface ModelConfig {
  // --- Text generation (prompts, evaluation, scenario generation) ---
  chatModel: string;
  chatSource: Source;

  // --- Speech-to-text ---
  sttModel: string;
  sttSource: Source;

  // --- Text-to-speech ---
  ttsModel: string;
  ttsVoice: string;
  ttsSource: Source;

  // --- Image generation ---
  imageModel: string;
  imageSource: 'genai' | 'openai' | 'openrouter';

  // --- Live Roleplay (real-time audio) ---
  liveModel: string;
  liveVoice: string;
  liveSource: 'genai' | 'openai';  // OpenRouter does not support live audio

  // --- Fallbacks (optional -- undefined means no fallback) ---
  chatFallbackModel?: string;
  chatFallbackSource?: Source;
  sttFallbackModel?: string;
  sttFallbackSource?: Source;
  ttsFallbackModel?: string;
  ttsFallbackSource?: Source;
  ttsFallbackVoice?: string;
}
```

**Key changes:**
- `Provider` type renamed to `Source`
- All `*Provider` fields become `*Source` fields
- `imageSource` and `liveSource` are restricted unions (not all sources support all capabilities)
- `Provider` type is removed entirely, replaced by `Source`

---

## 2. Model Lists & UI Data

**File:** `src/types/settings.ts`

```ts
export interface ModelOption {
  value: string;    // model ID (e.g., 'gemini-3.1-flash-lite-preview')
  label: string;    // display name (e.g., 'Gemini 3.1 Flash Lite')
  source: Source;   // where to access it
}
```

Each model list (`CHAT_MODELS`, `STT_MODELS`, `TTS_MODELS`, `IMAGE_MODELS`, `LIVE_MODELS`) is an array of `ModelOption[]` grouped by source.

The same model can appear under multiple sources. For example, Gemini 3.1 Flash Lite appears under `genai`, `vertex`, and `openrouter` — the combination of `source + value` is unique.

**Dropdown rendering:** `<select>` uses `<optgroup>` elements, one per source. Since HTML selects cannot have duplicate values, dropdown values use a composite format: `source:model` (e.g., `genai:gemini-3.1-flash-lite-preview`).

Handlers parse the composite:
```ts
const handleChatModelChange = (composite: string) => {
  const [source, ...rest] = composite.split(':');
  const model = rest.join(':');
  updateConfig({ chatModel: model, chatSource: source as Source });
};
```

**Source display labels:**
```ts
const SOURCE_LABELS: Record<Source, string> = {
  genai: 'Google AI Studio',
  vertex: 'Vertex AI',
  openai: 'OpenAI',
  openrouter: 'OpenRouter',
  groq: 'Groq',
};
```

---

## 3. API Keys & Auth

**File:** `src/types/settings.ts`

```ts
export interface SourceCredentials {
  genai?: string;       // Google AI Studio API key
  openai?: string;      // OpenAI API key
  groq?: string;        // Groq API key
  openrouter?: string;  // OpenRouter API key
  vertex?: {            // Vertex AI — no API key, uses ADC
    projectId: string;
    region: string;
  };
}
```

**Settings UI — API Keys section:**

| Source | Field type | Notes |
|--------|-----------|-------|
| Google AI Studio | API key text input | Same as today |
| Vertex AI | Project ID + Region dropdown | No key — auth via Edge Function service account |
| OpenAI | API key text input | Same as today |
| OpenRouter | API key text input | New field |
| Groq | API key text input | Same as today |

**Auth flow per source in the Edge Function:**

| Source | Authentication method |
|--------|----------------------|
| `genai` | API key from `credentials.genai` |
| `vertex` | ADC via Edge Function service account; user provides project ID + region |
| `openai` | API key from `credentials.openai` |
| `openrouter` | API key from `credentials.openrouter` |
| `groq` | API key from `credentials.groq` |

All credentials remain encrypted (AES-256-GCM) in Supabase — same pattern as today.

**Vertex AI setup:** The Edge Function must have a GCP service account configured via `supabase secrets set`. The user only provides project ID and region. The service account needs the `Vertex AI User` role on the target project.

**Live audio via Vertex:** Instead of `getGeminiKeyForLive()` (which returns a GenAI API key for client-side WebSocket), Vertex uses a server-generated temporary token. A new proxy endpoint (`action: 'get_vertex_live_token'`) returns a short-lived token for the client-side WebSocket connection.

---

## 4. Proxy Dispatch

### Client-side (`src/services/openai.ts`)

`detectProvider()` becomes `detectSource()`:
```ts
function detectSource(modelId: string): Source {
  // OpenRouter models use provider/model format
  if (modelId.includes('/')) return 'openrouter';
  if (modelId.startsWith('gemini')) return 'genai';
  if (modelId.startsWith('llama-') || modelId.startsWith('meta-llama/')) return 'groq';
  if (modelId.startsWith('gpt-')) return 'openai';
  return 'openrouter';  // unknown models default to OpenRouter
}
```

All proxy calls pass `source` instead of `provider`.

### Proxy client (`src/services/supabase/aiProxy.ts`)

All interfaces change `provider` to `source`:
```ts
export interface ChatCompletionOptions {
  systemPrompt: string;
  userMessage: string;
  model?: string;
  source?: Source;        // was: provider?: 'openai' | 'gemini' | 'groq'
  temperature?: number;
}
```

Same for `TextToSpeechOptions`, `SpeechToTextOptions`, `ImageGenerationOptions`.

### Edge Function (`supabase/functions/ai-proxy/index.ts`)

The main dispatch switches on `source`:

| Source | Base URL | Request format |
|--------|---------|----------------|
| `genai` | `generativelanguage.googleapis.com/v1beta` | Gemini REST API |
| `vertex` | `{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}` | Vertex AI Predict API |
| `openai` | `api.openai.com/v1` | OpenAI Chat Completions |
| `openrouter` | `openrouter.ai/api/v1` | OpenAI-compatible format |
| `groq` | `api.groq.com/openai/v1` | OpenAI-compatible format |

New action: `get_vertex_live_token` — generates a short-lived token for Vertex AI live audio WebSocket connections.

---

## 5. Settings UI Component Changes

### Handlers

All model change handlers use `source` from the `ModelOption` entry:
```ts
const handleChatModelChange = (composite: string) => {
  const [source, ...rest] = composite.split(':');
  const model = rest.join(':');
  updateConfig({ chatModel: model, chatSource: source as Source });
};
```

Fallback handlers follow the same pattern.

### Dropdowns

Reusable helper groups models by source:
```ts
function groupBySource(models: ModelOption[]): Record<string, ModelOption[]> {
  return models.reduce((acc, m) => {
    (acc[m.source] ??= []).push(m);
    return acc;
  }, {} as Record<string, ModelOption[]>);
}
```

Select uses composite values (`source:model`) and renders `<optgroup>` per source.

### Validation

When a model is selected whose source has no configured credentials, show an inline warning:
```
No OpenRouter API key configured. Add it in the API Keys section above.
```

### Voice selectors

Voice options depend on the source (not just provider):
- `genai` / `vertex` → `GEMINI_TTS_VOICES` / `GEMINI_LIVE_VOICES`
- `openai` → `OPENAI_TTS_VOICES` / `OPENAI_LIVE_VOICES`
- `openrouter` → limited to models that support TTS natively (if any)
- `groq` → `GROQ_TTS_VOICES`

---

## 6. Migration Strategy

**Backward compatibility:** Existing users with `*Provider` fields in their stored config need migration.

1. **Supabase storage:** On load, if `chatProvider` exists but `chatSource` doesn't, map it:
   - `'gemini'` → `{ chatSource: 'genai', chatModel: keep }`
   - `'openai'` → `{ chatSource: 'openai', chatModel: keep }`
   - `'groq'` → `{ chatSource: 'groq', chatModel: keep }`

2. **localStorage fallback:** Same migration logic in `src/services/storage.ts`.

3. **API keys:** Existing Gemini key becomes `genai` credential. OpenRouter and Vertex fields start empty.

Migration runs once on first load after upgrade, then the old fields are no longer written.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/types/settings.ts` | Add `Source`, `ModelOption`, `SourceCredentials`; update `ModelConfig` with `*Source` fields; update model lists; remove `Provider` |
| `src/components/settings/SettingsPage.tsx` | Composite dropdown values, optgroup rendering, source-based handlers, new API key section, credential validation warnings |
| `src/services/openai.ts` | `detectSource()` instead of `detectProvider()`; pass `source` to proxy calls |
| `src/services/supabase/aiProxy.ts` | `source` instead of `provider` in all interfaces; new `getVertexLiveToken()` |
| `supabase/functions/ai-proxy/index.ts` | Switch on `source`; add Vertex AI and OpenRouter handlers; add `get_vertex_live_token` action |
| `src/services/geminiLive.ts` | Support `vertex` source for live audio via token-based auth |
| `src/services/runtimeState.ts` | Store `SourceCredentials`; migrate `Provider` → `Source` on load |
| `src/services/supabase/storage.ts` | Persist `SourceCredentials`; migration for existing configs |
| `src/services/storage.ts` | localStorage fallback: same migration logic |
| `src/config/images.ts` | Update provider references to source |
| `src/types/supabase.ts` | Update DB types for new source fields |

---

## 8. Testing Strategy

**Unit tests (Vitest):**
- `detectSource()` — verify correct source detection for model IDs from all sources
- Composite value parsing (`source:model` split) — edge cases with colons in model IDs
- Migration logic (`Provider` → `Source` mapping) — existing configs upgrade correctly
- `SourceCredentials` validation — missing key shows warning, Vertex requires project + region

**Integration tests:**
- Proxy client sends `source` correctly in all action types (chat, tts, stt, image)
- Fallback chain respects source — if primary source fails, fallback uses its own source

**Edge Function tests:**
- Each source handler (`genai`, `vertex`, `openrouter`, `openai`, `groq`) routes to correct base URL
- Vertex handler includes project ID and region from credentials
- OpenRouter handler passes correct headers (`HTTP-Referer`, `X-Title`)

**UI tests (React Testing Library):**
- Dropdown renders optgroups for each source
- Selecting a model updates both `model` and `source` in config
- Missing credentials for selected source show warning
- Voice options change correctly when source changes

---

## 9. Out of Scope

- **Model registry / auto-discovery:** Models are hardcoded in lists. Fetching available models from OpenRouter API dynamically is a future enhancement.
- **Cost tracking:** No UI for tracking spend per source.
- **Rate limiting per source:** No client-side rate limit management.
- **Model benchmarking:** No automatic selection of "best" model based on performance.
- **Vertex AI streaming responses:** Initial implementation uses non-streaming; streaming can be added later.
