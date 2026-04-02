# Phase 4: Secure Storage - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix API key encryption at rest (remove hardcoded fallback, bump PBKDF2, random salts) and route all non-WebSocket AI API calls through the existing Edge Function proxy so keys are never exposed client-side. Client-side encryption code (`encryption.ts`) is replaced with server-side-only encryption managed by the Edge Function.

This phase does NOT:
- Consolidate the dual storage layer (Phase 5)
- Redesign any UI
- Add new API providers

</domain>

<decisions>
## Implementation Decisions

### Encryption Architecture
- **D-01:** Server-side only encryption — Client sends plaintext API keys over HTTPS to the Edge Function, which encrypts with a server-side `ENCRYPTION_KEY` env var. Client never encrypts or decrypts. `encryption.ts` client-side code is removed or gutted.
- **D-02:** Edge Function is the sole encryptor/decryptor. All encrypted key storage and retrieval happens server-side.

### Realtime WebSocket API Handling
- **D-03:** Realtime APIs (Gemini Live, OpenAI Realtime) accept API keys client-side in JS memory for WebSocket connections. Keys are loaded from the Edge Function at runtime (via `get_key` action) and held in memory only — never persisted to localStorage or any client-side storage.
- **D-04:** Non-realtime AI calls (chat, TTS, STT, image) MUST go through the Edge Function proxy. Direct browser-to-provider calls for these are eliminated.

### Key Migration
- **D-05:** Auto-migrate on login — When the Edge Function reads a user's key and finds plaintext (no JSON `{ciphertext, iv}` format), it re-encrypts with the server-side key and writes back to `encrypted_api_keys`. User is unaware this happened.
- **D-06:** Old client-side encrypted keys (using `encryption.ts` with deterministic salt + low iterations) are treated as plaintext by the Edge Function — the client-side encryption is considered broken, so keys encrypted that way are decrypted client-side one last time during migration, then re-sent to the Edge Function for proper server-side encryption.

### Dev Mode Handling
- **D-07:** Dev mode (no Supabase) uses environment variables only (`VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`). No encryption, no key management UI.
- **D-08:** Settings page in dev mode shows a notice: "API keys loaded from environment variables. Sign in to manage your own keys." Key input fields are read-only in dev mode.

### Claude's Discretion
- Exact PBKDF2 iteration count (600K minimum per SEC-02, exact value up to implementation)
- Whether to keep `encryption.ts` as a thin shim or remove entirely
- How to structure the Edge Function `get_key` response for realtime use
- Migration timing (batch on deploy vs. lazy per-user)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Encryption & Security
- `src/utils/encryption.ts` — Current client-side encryption (to be removed/replaced)
- `src/services/supabase/aiProxy.ts` — Client-side Edge Function caller (already routes chat/TTS/STT)
- `supabase/functions/ai-proxy/index.ts` — Existing Edge Function that decrypts keys and proxies AI calls
- `src/services/runtimeState.ts` — In-memory state that loads and holds API keys
- `src/services/storage.ts` — localStorage fallback storage (plaintext keys)
- `src/services/supabase/storage.ts` — Supabase storage (has `getApiKey`, `saveApiKey` functions)

### Direct API Call Sites (must be routed through proxy)
- `src/services/openai.ts` — Direct OpenAI calls (chat, TTS, STT)
- `src/services/geminiLive.ts` — Gemini Live WebSocket (realtime — exempt from proxy)
- `src/services/openaiRealtimeLive.ts` — OpenAI Realtime WebSocket (realtime — exempt from proxy)

### UI
- `src/components/settings/SettingsPage.tsx` — Settings page where users manage keys

### Project Context
- `.planning/REQUIREMENTS.md` — SEC-01 through SEC-04 requirements
- `.planning/PROJECT.md` — Project constraints and architectural context

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/supabase/aiProxy.ts`: Full Edge Function client already exists with `callAIProxy()`, `chatCompletion()`, `textToSpeech()`, `speechToText()`. The `withFallback()` pattern wraps proxy-first with direct-call fallback — the direct-call fallback path is what needs to be removed.
- Edge Function `supabase/functions/ai-proxy/index.ts`: 743 lines, already handles chat/TTS/STT/image/chatWithImage/get_key/save_keys actions. Has encryption/decryption utilities and API key CRUD.
- `src/services/runtimeState.ts`: Singleton state with `getRuntimeApiKeys()` — already loads keys from Supabase on login.

### Established Patterns
- Provider fallback: try primary provider, catch and try fallback. Implemented in `openai.ts` via `chatFallbackProvider` etc.
- `withFallback()` in `aiProxy.ts`: wraps proxy-first with direct-call fallback
- API key priority: runtime state (from Supabase) > env vars (`VITE_*`)

### Integration Points
- `SettingsPage.tsx` calls `setRuntimeApiKey()` to save keys — this needs to route through Edge Function
- `runtimeState.ts` calls `getApiKey()` from Supabase storage — needs to return decrypted keys only for realtime WebSocket use
- Direct calls in `openai.ts` functions (`chatCompletion()`, `textToSpeech()`, `speechToText()`) need to go through `aiProxy.ts` instead

</code_context>

<specifics>
## Specific Ideas

- The `withFallback()` function in `aiProxy.ts` currently tries the proxy first, then falls back to direct calls. For SEC-04 compliance, the fallback must be removed — if the proxy fails, the call fails (no direct key exposure).
- The Edge Function already has `get_key` action that returns decrypted keys. This can serve the realtime WebSocket use case.
- `runtimeState.ts` line ~50: `apiKeys: { ...envKeys }` — env vars are the fallback. In dev mode these ARE the keys (no Supabase). In prod, Supabase keys override env vars.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-secure-storage*
*Context gathered: 2026-04-02*
