# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

### AI Providers (Multi-Provider Architecture)

The app supports three AI providers with fallback capability. Users bring their own API keys, stored encrypted in Supabase.

**Google Gemini (Primary/Default):**
- SDK: `@google/genai` v1.0 in `src/services/openai.ts` and `src/services/geminiLive.ts`
- Used for: Chat completions, TTS, STT, image generation, Live Audio (real-time WebSocket)
- API base: `https://generativelanguage.googleapis.com/v1beta`
- Auth: User-provided API key (stored encrypted via Edge Function or env var `VITE_GEMINI_API_KEY`)
- Default models: `gemini-2.5-flash` (chat), `gemini-2.5-flash-preview-tts` (TTS), `gemini-2.5-flash-image` (image), `gemini-2.5-flash-native-audio-preview-12-2025` (live audio)
- Live Audio uses WebSocket via `@google/genai` SDK's `ai.live.connect()` method in `src/services/geminiLive.ts`
- Gemini Live: bidirectional audio at 16kHz input / 24kHz output, PCM16 encoding

**OpenAI:**
- Direct REST API calls in `src/services/openai.ts`
- Used for: Chat completions, TTS, STT, image generation, Realtime API (WebSocket)
- API base: `https://api.openai.com/v1`
- Auth: User-provided API key (stored encrypted or env var `VITE_OPENAI_API_KEY`)
- Realtime API: WebSocket at `wss://api.openai.com/v1/realtime` in `src/services/openaiRealtimeLive.ts`
- PCM16 audio at 24kHz, semantic VAD turn detection

**Groq:**
- Proxied via Vite dev server (`/api/groq` -> `https://api.groq.com/openai/v1`) in development
- Direct API calls in `src/services/openai.ts` using proxy path
- Used for: Chat completions (Llama, Qwen models), TTS (Orpheus, 200 char limit), STT (Whisper)
- Auth: User-provided API key (stored encrypted or env var `VITE_GROQ_API_KEY`)

### AI Proxy Architecture

Two paths for AI API calls:
1. **Edge Function path** (`src/services/supabase/aiProxy.ts`) - Calls Supabase Edge Function `ai-proxy` which decrypts user's stored API keys server-side and proxies the request. This is the production path.
2. **Direct API path** (`src/services/openai.ts`) - Calls AI providers directly using API keys from runtime state. Used in dev mode or when Edge Function is unavailable.
3. **Fallback mechanism** (`withFallback()` in `src/services/supabase/aiProxy.ts`) - Tries Edge Function first, falls back to direct API.

### Supabase Edge Function: `ai-proxy`

**Location:** `supabase/functions/ai-proxy/index.ts`
**Runtime:** Deno
**Actions supported:**
- `save_key` / `save_keys` - Encrypt and store API keys
- `get_key` - Decrypt and retrieve API keys
- `chat` - Chat completions (OpenAI, Gemini, Groq) with optional image input
- `tts` - Text-to-speech (OpenAI, Gemini, Groq)
- `stt` - Speech-to-text (OpenAI, Gemini, Groq)
- `image` - Image generation (OpenAI, Gemini)
**Auth:** Verifies user JWT from Supabase session
**Encryption:** AES-256-GCM for API keys stored in `encrypted_api_keys` table
**Env vars required:** `ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Data Storage

### Database: Supabase (PostgreSQL 17)

**Connection:**
- Client: `@supabase/supabase-js` v2.99
- Singleton pattern with lazy proxy in `src/services/supabase/client.ts`
- Auth: PKCE flow, session persistence, auto-refresh
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Schema location:** `supabase/migrations/20260324221155_initial_schema.sql`

**Tables (from storage operations in `src/services/supabase/storage.ts`):**
- `profiles` - User profile data (level, interests, goals, conversation tone)
- `cards` - Flashcards with SM-2 spaced repetition data
- `card_reviews` - Review history per card
- `card_evaluations` - Latest evaluation per card (score, corrections, feedback)
- `gamification` - XP, level, streak data
- `badges` - Earned badges
- `live_sessions` - Live roleplay session metadata
- `conversation_turns` - Individual turns within live sessions
- `conversation_analyses` - AI analysis of conversations
- `session_reports` - Practice session summaries
- `path_progress` - Learning path step completion
- `model_config` - Per-user AI model preferences
- `encrypted_api_keys` - AES-256-GCM encrypted API keys

**Row Level Security (RLS):** Enabled on all tables, policies restrict access to `auth.uid() = user_id`

**Supabase config:** `supabase/config.toml`
- Project ID: `llmenglish` / remote ref: `gpmjxqprknkqawlzhoku`
- Local API port: 54321
- Local DB port: 54322
- Site URL: `http://127.0.0.1:5173`

### File Storage: None detected
- No Supabase Storage buckets used
- Audio data stored as base64 in database text columns or localStorage
- Images referenced by URL (AI-generated URLs or data URLs)

### Caching:
- TTS audio cache in localStorage (`el_audio_cache`) in `src/services/storage.ts`
- Key format: `tts_{voice}_{text_first_100_chars}`
- Cleared when storage quota exceeded

## Authentication & Identity

### Auth Provider: Supabase Auth

**Implementation:** `src/services/supabase/auth.ts`, `src/contexts/AuthContext.tsx`

**Supported Methods:**
- Google OAuth - `signInWithGoogle()`, requires `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_SECRET`
- GitHub OAuth - `signInWithGithub()`, requires `SUPABASE_AUTH_GITHUB_CLIENT_ID` / `SUPABASE_AUTH_GITHUB_SECRET`
- PKCE flow type with `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

**Auth Flow:**
1. User clicks OAuth button on `LoginPage` (`src/components/auth/LoginPage.tsx`)
2. Supabase redirects to provider, then back to site URL
3. `onAuthStateChange` listener in `AuthProvider` catches `SIGNED_IN` event
4. Profile auto-created via `getOrCreateProfile()` if not exists
5. `hydrateRuntimeState()` loads model config, API keys, gamification from Supabase
6. Session token stored for key derivation via `src/utils/encryption.ts`

**Dev Mode Bypass:**
- When `import.meta.env.DEV` and no Supabase env vars set, auth is completely skipped
- `ProtectedApp` renders `DiscoveryPage` directly without checking user state

## Monitoring & Observability

**Error Tracking:** None detected

**Logs:**
- Console warnings and errors throughout services
- Auth state change logging in `AuthContext.tsx`
- Fallback warnings when primary AI provider fails

## CI/CD & Deployment

**Hosting:** Not configured in repository (static SPA build)

**Build command:** `tsc -b && vite build` (type-check then bundle)

**CI Pipeline:** None detected (no `.github/workflows/` or similar)

**Supabase Deployment:**
- `supabase:functions:deploy` script deploys `ai-proxy` Edge Function
- `supabase:link` connects to remote project `gpmjxqprknkqawlzhoku`
- `supabase:db:push` pushes schema changes

## Environment Configuration

### Frontend (.env.local)

| Variable | Purpose | Required |
|----------|---------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (prod) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes (prod) |
| `VITE_OPENAI_API_KEY` | OpenAI API key | Optional (dev only) |
| `VITE_GEMINI_API_KEY` | Gemini API key | Optional (dev only) |
| `VITE_GROQ_API_KEY` | Groq API key | Optional (dev only) |

### Supabase Edge Function

| Variable | Purpose | Required |
|----------|---------|----------|
| `ENCRYPTION_KEY` | 32-byte hex for AES-256-GCM | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Yes (auto-set) |

### Supabase Local Auth (.env)

| Variable | Purpose | Required |
|----------|---------|----------|
| `SUPABASE_AUTH_GITHUB_CLIENT_ID` | GitHub OAuth app client ID | For GitHub login |
| `SUPABASE_AUTH_GITHUB_SECRET` | GitHub OAuth app secret | For GitHub login |
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID | For Google login |
| `SUPABASE_AUTH_GOOGLE_SECRET` | Google OAuth client secret | For Google login |

### Secrets Location:
- `.env.local` - Frontend Supabase credentials and optional dev API keys
- `supabase/functions/.env` - Edge Function secrets (ENCRYPTION_KEY)
- Supabase project secrets - Managed via `supabase secrets set`

## Webhooks & Callbacks

**Incoming:** None

**Outgoing:** None (all API calls are request/response, including WebSocket for Live Audio)

## Key Architecture Patterns

### Dual Storage Pattern
The app maintains two storage implementations:
- `src/services/storage.ts` - LocalStorage-based (legacy/fallback)
- `src/services/supabase/storage.ts` - Supabase-based (primary)

Both expose identical function signatures. The Supabase services are async; the localStorage services are sync. Components import from the appropriate module.

### Runtime State Hydration
On login, `hydrateRuntimeState()` in `src/services/runtimeState.ts` fetches all user data from Supabase in parallel (model config, API keys, conversation tone, gamification, user context) and stores it in a singleton. This avoids repeated async fetches during the session.

### Multi-Provider AI Dispatch
Each AI capability (chat, TTS, STT, image) follows a dispatch pattern:
1. Read `ModelConfig` from runtime state
2. Determine provider (openai/gemini/groq) and model
3. Call provider-specific function
4. If primary fails, try fallback provider/model if configured

### Live Audio Sessions
Two implementations of `ILiveSession` interface (`src/services/liveSession.ts`):
- `GeminiLiveSession` - Uses `@google/genai` SDK WebSocket
- `OpenAIRealtimeLiveSession` - Uses raw WebSocket to OpenAI Realtime API
Both handle microphone input (PCM16 encoding) and audio playback (scheduled AudioBuffer sources).

---

*Integration audit: 2026-04-01*
