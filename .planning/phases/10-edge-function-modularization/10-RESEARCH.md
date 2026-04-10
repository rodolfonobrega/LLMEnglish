# Phase 10: Edge Function Modularization - Research

**Researched:** 2026-04-07
**Domain:** Deno TypeScript / Supabase Edge Functions / AI API proxy refactoring
**Confidence:** HIGH

## Summary

The `ai-proxy` Edge Function is a 1364-line monolith in `supabase/functions/ai-proxy/index.ts` that handles encrypted API key management, AI API proxying for 6 providers (OpenAI, Gemini/GenAI, Groq, OpenRouter, Vertex AI), and 4 action types (chat, TTS, STT, image). The function uses Deno-style URL imports (`esm.sh`, `deno.land/std`) and runs on Deno runtime via Supabase Edge Functions. The modularization is a pure code-splitting exercise -- no behavior changes, no new dependencies, no API contract changes.

The function decomposes cleanly into 8 modules plus a thin router. The main handler (lines 1081-1364, 284 lines) is itself the largest single section and contains the routing logic that dispatches to provider-specific functions. After extracting all helpers, the router can be reduced to ~100 lines. The key technical constraint is that Supabase Edge Functions support relative imports within the function directory using standard Deno/ES module syntax (`import { x } from './module.ts'`), and `supabase functions deploy` bundles them via esbuild.

**Primary recommendation:** Split into 8 files within `supabase/functions/ai-proxy/` using relative Deno imports. No import_map needed. Each provider module exports functions with identical signatures so the router dispatches by lookup table instead of if/else chains.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
All implementation choices.

### Deferred Ideas (OUT OF SCOPE)
None -- infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EF-01 | `ai-proxy/index.ts` split into ~8 modules: `crypto.ts`, `api-keys.ts`, `providers/openai.ts`, `providers/gemini.ts`, `providers/groq.ts`, `providers/openrouter.ts`, `providers/vertex.ts`, `utils.ts` | Section analysis below maps every line to a target module; `utils.ts` absorbs pcm16ToWav, writeString, str2ab |
| EF-02 | Main `index.ts` becomes thin router (~100 lines) delegating to provider modules | Router refactoring pattern documented; dispatch table approach reduces if/else chains |
| EF-03 | No behavior changes -- all existing API contracts (request/response shapes, error codes) remain identical | Client contract captured from `aiProxy.ts`; response shapes documented per action |
| EF-04 | Modularized function passes local testing via `supabase functions serve` for all action types (chat, TTS, STT, image) | Supabase CLI not installed locally -- plan must include install step or manual deploy test |
| EF-05 | Structured logging with request ID and provider context in a `log.ts` utility | Logging pattern documented; `crypto.randomUUID()` available in Deno runtime |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Deno std `http/server` | 0.168.0 | HTTP server for Edge Function | [VERIFIED: import in index.ts line 9] Already imported |
| `@supabase/supabase-js` | 2.x | Supabase client | [VERIFIED: import in index.ts line 10] Already imported |
| `@google/generative-ai` | 0.21.0 | Gemini SDK for TTS/STT | [VERIFIED: dynamic import in index.ts lines 327-328, 412] Already imported |
| Web Crypto API | built-in | AES-256-GCM encryption | [VERIFIED: usage in deriveKey/encrypt/decrypt] Deno built-in |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `esm.sh` | CDN | NPM package CDN for Deno | Used for @supabase/supabase-js, @google/generative-ai |
| `deno.land/std` | CDN | Deno standard library | Used for `serve()` HTTP handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deno URL imports | import_map.json | import_map adds config file; URL imports already work and are the established pattern in this function |
| Single utils.ts | Separate utils per provider | Single utils.ts is simpler; only 3 shared helpers (pcm16ToWav, writeString, str2ab) |

**Installation:**
No new packages needed. This is a pure refactoring phase using existing imports.

## Architecture Patterns

### Current Structure (Monolith)
```
supabase/functions/ai-proxy/
├── index.ts    # 1364 lines - everything in one file
└── .env.example
```

### Recommended Target Structure
```
supabase/functions/ai-proxy/
├── index.ts              # ~100 lines - thin router + serve()
├── crypto.ts             # ~65 lines - deriveKey, encrypt, decrypt, constants
├── api-keys.ts           # ~110 lines - getApiKey, saveApiKey, sourceToDbColumn, normalizeSource
├── log.ts                # ~30 lines - structured logging with request ID
├── utils.ts              # ~55 lines - pcm16ToWav, writeString, str2ab
├── providers/
│   ├── openai.ts         # ~110 lines - openaiChat, openaiTTS, openaiSTT, openaiImage
│   ├── gemini.ts         # ~130 lines - geminiChat, geminiTTS, geminiSTT, geminiImage + dynamic import
│   ├── groq.ts           # ~95 lines - groqChat, groqTTS, groqSTT
│   ├── openrouter.ts     # ~145 lines - openrouterChat, openrouterTTS, openrouterSTT, openrouterImage
│   └── vertex.ts         # ~310 lines - vertexChat, vertexTTS, vertexSTT, vertexImage, vertexChatWithImage, getVertexAccessToken, getVertexConfig
└── .env.example          # unchanged
```

### Pattern 1: Thin Router with Action Dispatch
**What:** `index.ts` contains only the `serve()` handler, CORS, auth verification, and a switch/case that delegates to action handlers.
**When to use:** Main entry point pattern.
**Example:**
```typescript
// index.ts (target structure)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getApiKey, saveApiKey, normalizeSource } from './api-keys.ts'
import { logRequest, logError } from './log.ts'
import * as openai from './providers/openai.ts'
import * as gemini from './providers/gemini.ts'
import * as groq from './providers/groq.ts'
import * as openrouter from './providers/openrouter.ts'
import * as vertex from './providers/vertex.ts'

const corsHeaders = { ... }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  // auth check, body parse, then switch on action
  // delegate to provider modules
})
```
[ASSUMED] Pattern based on Deno ES module support; Supabase CLI bundles relative imports via esbuild.

### Pattern 2: Provider Module with Consistent Exports
**What:** Each provider module exports functions with consistent signatures grouped by action type.
**When to use:** Each provider file.
**Example:**
```typescript
// providers/openai.ts
export async function chat(apiKey: string, model: string, systemPrompt: string, userMessage: string, temperature?: number): Promise<string> { ... }
export async function tts(apiKey: string, text: string, voice: string, model: string): Promise<string> { ... }
export async function stt(apiKey: string, audioBase64: string, mimeType: string, model: string): Promise<string> { ... }
export async function image(apiKey: string, prompt: string, model: string, options: Record<string, unknown>): Promise<string> { ... }
```

### Pattern 3: Structured Logging
**What:** A `log.ts` module that generates request IDs and logs structured entries.
**When to use:** Every request entering the handler.
**Example:**
```typescript
// log.ts
export function createRequestLogger(requestId?: string) {
  const id = requestId || crypto.randomUUID()
  return {
    info: (action: string, provider: string, details: Record<string, unknown>) => {
      console.log(JSON.stringify({ level: 'info', requestId: id, action, provider, ...details }))
    },
    error: (action: string, provider: string, error: unknown) => {
      console.error(JSON.stringify({ level: 'error', requestId: id, action, provider, error: String(error) }))
    },
    getRequestId: () => id,
  }
}
```
[ASSUMED] `crypto.randomUUID()` is available in Deno runtime (Web Crypto API standard).

### Anti-Patterns to Avoid
- **Barrel files (index.ts re-exports):** The project convention explicitly avoids barrel files. Each module should be imported directly.
- **Shared mutable state across modules:** The current pattern initializes `supabase` client at module level in `index.ts`. After refactoring, `api-keys.ts` and `vertex.ts` both need the Supabase client. Pass it as a parameter or export an init function -- do not create multiple clients.
- **Importing from `src/`:** Edge Functions run in Deno, not the Vite bundle. They cannot import from the `src/` directory. All shared types must be duplicated or defined locally.
- **Breaking the dynamic import pattern:** Gemini TTS/STT use `await import('https://esm.sh/@google/generative-ai@0.21.0')` to lazy-load the SDK. This must be preserved exactly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request ID generation | Custom UUID | `crypto.randomUUID()` | Built into Web Crypto API, available in Deno |
| Module bundling | Custom build step | `supabase functions deploy` | CLI uses esbuild internally to bundle local imports |
| Supabase client init | Client per module | Single client, pass as parameter | Avoids multiple connections; Supabase client is stateful |

**Key insight:** This is a pure refactoring. No new behavior, no new dependencies. The only risk is breaking the import chain during the split.

## Common Pitfalls

### Pitfall 1: Deno Import Extensions
**What goes wrong:** Deno requires explicit `.ts` extensions in relative imports (unlike Node.js/Vite which resolve them).
**Why it happens:** Developers used to Vite/TypeScript omit extensions.
**How to avoid:** Always use `import { x } from './crypto.ts'` (with `.ts`), not `import { x } from './crypto'`.
**Warning signs:** Import resolution errors at `supabase functions serve` time.

### Pitfall 2: Shared Supabase Client
**What goes wrong:** Creating a new Supabase client in each module that needs DB access.
**Why it happens:** Modules import `createClient` independently.
**How to avoid:** Initialize Supabase client once in `index.ts`, pass it to `api-keys.ts` and `vertex.ts` functions as a parameter, or export a `initSupabase()` from a shared module.
**Warning signs:** Multiple Supabase connections in logs, or env vars not available in imported modules.

### Pitfall 3: Dynamic Import Paths
**What goes wrong:** Moving `geminiTTS`/`geminiSTT` to a provider module changes the context for `await import('https://esm.sh/...')`.
**Why it happens:** Dynamic imports are resolved relative to the importing file.
**How to avoid:** URL imports (https://) are absolute, so they work from any file location. No risk here, but verify after the split.
**Warning signs:** `import()` errors for @google/generative-ai.

### Pitfall 4: Vertex AI Module Dependencies
**What goes wrong:** `vertex.ts` needs both the Supabase client (for `getVertexConfig`) and environment variables (for `getVertexAccessToken`).
**Why it happens:** Vertex AI has a unique auth pattern (service account JWT exchange) that mixes DB reads with crypto operations.
**How to avoid:** Keep `getVertexAccessToken()` and `getVertexConfig()` in `vertex.ts`. Pass the Supabase client as parameter to `getVertexConfig`.
**Warning signs:** `Deno.env.get()` returning undefined after modularization.

### Pitfall 5: Action Handler Body Not Extracted from Router
**What goes wrong:** Only extracting provider functions but leaving the key retrieval + dispatch logic inline in the router, making it still 250+ lines.
**Why it happens:** Focusing on provider extraction without also extracting the per-action dispatch logic.
**How to avoid:** Extract action handlers (handleChat, handleTTS, handleStt, handleImage) that encapsulate the full flow: key lookup -> provider dispatch -> response formatting.
**Warning signs:** Router exceeds 120 lines.

### Pitfall 6: Breaking the save_key/save_keys Contract
**What goes wrong:** The `save_key` and `save_keys` actions have subtle difference in body shape. `save_key` uses `body.key` while `save_keys` iterates `body.keys` entries.
**Why it happens:** These are similar but not identical.
**How to avoid:** Keep the key management dispatch logic intact in the router or extract to `api-keys.ts` handler functions.
**Warning signs:** Key save operations fail after refactoring.

## Code Examples

### Supabase Client Sharing Pattern
```typescript
// index.ts - initialize once
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleChat, handleTts, handleStt, handleImage } from './handlers.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Pass to handlers that need it
```

### API Contract (Client-Side) - MUST NOT CHANGE
```typescript
// From src/services/supabase/aiProxy.ts - the client expects these exact response shapes:

// chat action -> { content: string }
// tts action  -> { audio: string }     // base64 encoded
// stt action  -> { text: string }
// image action -> { imageUrl: string } | { imageData: string }  // URL or data:image/...;base64,...
// save_key action -> { success: true }
// save_keys action -> { success: true }
// get_key action -> { key: string | null }
// get_vertex_live_token action -> { accessToken, projectId, region }

// Error response: { error: string } with status 400
```

### File Size Targets After Split
```
index.ts:      ~100 lines  (thin router, CORS, auth, action dispatch)
crypto.ts:     ~70 lines   (deriveKey, encrypt, decrypt, constants PBKDF2_ITERATIONS/SALT_LENGTH/IV_LENGTH/KEY_LENGTH)
api-keys.ts:   ~120 lines  (getApiKey, saveApiKey, sourceToDbColumn, normalizeSource)
log.ts:        ~35 lines   (createRequestLogger, logRequest, logError)
utils.ts:      ~55 lines   (pcm16ToWav, writeString, str2ab)
openai.ts:     ~120 lines  (chat, tts, stt, image)
gemini.ts:     ~140 lines  (chat, tts, stt, image + dynamic imports)
groq.ts:       ~100 lines  (chat, tts, stt)
openrouter.ts: ~150 lines  (chat, tts, stt, image)
vertex.ts:     ~310 lines  (auth, config, chat, chatWithImage, tts, stt, image)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-file edge functions | Multi-file with relative imports | Supabase CLI has supported this for years | Can split without tooling changes |
| `deno.land/std@0.168.0` | Newer std versions available | Ongoing | Existing version works fine; no need to upgrade during refactor |

**Deprecated/outdated:**
- None relevant. The existing import URLs are pinned and working.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase Edge Functions support relative imports (`./module.ts`) within the function directory and `supabase functions deploy` bundles them via esbuild | Architecture Patterns | HIGH -- would require single-file approach or shared module in import_map |
| A2 | `crypto.randomUUID()` is available in the Deno runtime used by Supabase Edge Functions | Architecture Patterns / Logging | LOW -- fallback to timestamp+random is trivial |
| A3 | Deno relative imports require explicit `.ts` extension | Pitfalls | MEDIUM -- build would fail, easy to detect |

## Open Questions

1. **Supabase CLI availability for local testing (EF-04)**
   - What we know: Neither `supabase` CLI nor `deno` runtime are installed on this machine.
   - What's unclear: Whether the user can install them, or whether testing should be done via remote deploy only.
   - Recommendation: Plan should include `npm install -g supabase` step for local testing. EF-04 success criterion requires `supabase functions serve` to work. Alternative: test by deploying to remote Supabase project.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | `supabase functions serve` (local testing) | N/A | - | Deploy to remote for testing |
| Deno runtime | Edge Function runtime | N/A | - | Not needed locally if using Supabase CLI |
| Node.js | Project build | available | - | - |

**Missing dependencies with no fallback:**
- Supabase CLI -- needed for EF-04 local testing criterion. Plan must include install step or scope EF-04 to remote deploy verification.

**Missing dependencies with fallback:**
- Deno runtime -- not needed separately; Supabase CLI bundles its own Deno runtime for `functions serve`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None for Edge Functions (Deno runtime, no test runner configured) |
| Config file | None |
| Quick run command | `supabase functions serve ai-proxy --env-file supabase/.env.local` |
| Full suite command | Manual: curl commands for each action type against local server |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EF-01 | File split into 8 modules | manual-only | Verify files exist in correct paths | N/A |
| EF-02 | index.ts under 120 lines | manual-only | `wc -l supabase/functions/ai-proxy/index.ts` | N/A |
| EF-03 | No behavior changes | integration | curl each action type, compare responses | N/A |
| EF-04 | Local testing passes | integration | `supabase functions serve` + curl tests | N/A |
| EF-05 | Structured logging | manual-only | Verify console output contains requestId, provider, action | N/A |

**Note:** Edge Functions run in Deno, not the project's Vitest test runner. EF-03 and EF-04 require manual or script-based integration testing via `supabase functions serve`. No automated test files are planned for this phase.

### Sampling Rate
- **Per task commit:** Verify file structure is correct (`find supabase/functions/ai-proxy/ -type f`)
- **Per wave merge:** Line count check + import verification
- **Phase gate:** Full action-type testing via curl or `supabase functions serve`

### Wave 0 Gaps
- None -- existing test infrastructure covers client-side. Edge Function testing is manual/integration only.

## Security Domain

> No `security_enforcement` key in config.json; omitting security domain section as this is a pure refactoring phase with no security-relevant changes. All crypto operations are preserved verbatim.

## Sources

### Primary (HIGH confidence)
- `supabase/functions/ai-proxy/index.ts` - Full 1364-line source analyzed line-by-line [VERIFIED: read in session]
- `src/services/supabase/aiProxy.ts` - Client-side contract with exact request/response shapes [VERIFIED: read in session]
- `.planning/REQUIREMENTS.md` - EF-01 through EF-05 requirements [VERIFIED: read in session]
- `supabase/config.toml` - Supabase configuration [VERIFIED: read in session]

### Secondary (MEDIUM confidence)
- Web search for Supabase Edge Function multi-file structure -- rate limited, could not verify [ASSUMED based on Deno standard module behavior]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All dependencies verified from source code
- Architecture: HIGH - Decomposition is mechanical code-splitting of verified source
- Pitfalls: HIGH - Pitfalls identified from direct analysis of the codebase
- Import mechanics: MEDIUM - Based on Deno documentation knowledge, not verified via Context7 this session

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable domain -- Deno module system unlikely to change)
