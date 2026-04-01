# Architecture

**Analysis Date:** 2026-04-01

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side routing

**Key Characteristics:**
- React SPA served by Vite dev server, built to static assets for production
- No server-side rendering; all rendering happens in the browser
- Supabase as Backend-as-a-Service (BaaS) for auth, database, and edge functions
- Dual API strategy: direct client-side AI API calls (with user keys) AND proxy through Supabase Edge Function
- Runtime state management via a singleton in-memory store (`runtimeState.ts`) with window event emission
- No global state library (no Redux, Zustand, etc.); state lives in React Context (auth) and localStorage/Supabase

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/components/`
- Contains: Page components, shared UI components, domain-specific feature components
- Depends on: `src/hooks/`, `src/services/`, `src/config/`, `src/types/`
- Used by: End user via browser

**Hook Layer:**
- Purpose: Encapsulate reusable stateful logic (audio recording, TTS, theme)
- Location: `src/hooks/`
- Contains: Custom React hooks
- Depends on: `src/services/`, `src/utils/`
- Used by: Presentation layer components

**Service Layer:**
- Purpose: Business logic, AI API calls, data persistence, auth
- Location: `src/services/`
- Contains: API wrappers, Supabase client/storage/auth, gamification logic, error analysis, runtime state
- Depends on: `src/types/`, `src/utils/`, Supabase client SDK
- Used by: Hook layer, some components directly

**Data Access Layer:**
- Purpose: Abstract Supabase and localStorage persistence
- Location: `src/services/supabase/storage.ts` (Supabase), `src/services/storage.ts` (localStorage fallback)
- Contains: CRUD functions for cards, gamification, sessions, path progress, model config, API keys
- Depends on: `src/services/supabase/client.ts`, `src/types/`
- Used by: Service layer functions (`gamification.ts`, `errorAnalysis.ts`, `runtimeState.ts`)

**Type Layer:**
- Purpose: TypeScript type definitions shared across all layers
- Location: `src/types/`
- Contains: Domain type definitions (Card, Scenario, Gamification, Settings, Errors, Supabase DB types)
- Depends on: Nothing (leaf layer)
- Used by: All other layers

**Configuration Layer:**
- Purpose: Static configuration, navigation structure, practice mode definitions, image config
- Location: `src/config/`
- Contains: Navigation items, mode definitions, practice setup steps, image generation config
- Depends on: `src/types/`
- Used by: Presentation layer for rendering navigation/modes

**Utility Layer:**
- Purpose: Pure helper functions with no side effects
- Location: `src/utils/`
- Contains: Tailwind class merging (`cn`), JSON cleaning, audio conversion, encryption, prompts, roleplay trail data
- Depends on: `src/types/` (for prompts and trails)
- Used by: All layers

## Data Flow

**Exercise Flow (typical user interaction):**

1. User navigates to `/practice` or `/exercises` via React Router
2. Page component calls `chatCompletion()` from `src/services/openai.ts` or `src/services/supabase/aiProxy.ts`
3. Service reads API key from `src/services/runtimeState.ts` (hydrated from Supabase on login)
4. API call goes to OpenAI/Gemini/Groq directly (using user's key) or via Supabase Edge Function (`supabase/functions/ai-proxy/index.ts`)
5. User records audio via `useAudioRecorder` hook
6. Audio sent to STT service (`speechToText()` in `openai.ts`)
7. Transcription evaluated via `chatCompletion()` using prompts from `src/utils/prompts.ts`
8. Evaluation result saved as Card via `src/services/supabase/storage.ts`
9. XP/gamification updated via `src/services/gamification.ts`
10. Error patterns extracted and saved via `src/services/errorAnalysis.ts`

**Live Roleplay Flow:**

1. User navigates to `/live`, selects scenario in `ScenarioSetup` component
2. Scenario generated via AI using `getScenarioGenerationPrompt()` from `src/utils/prompts.ts`
3. Live session established via `GeminiLiveSession` (`src/services/geminiLive.ts`) or `OpenAIRealtimeLiveSession` (`src/services/openaiRealtimeLive.ts`)
4. Both implement `ILiveSession` interface from `src/services/liveSession.ts`
5. Bidirectional audio streamed via WebRTC/WebSocket
6. Session saved to Supabase via `src/services/supabase/storage.ts`
7. Post-session analysis generated via AI and displayed in `ConversationAnalysis`

**State Management:**
- Auth state: React Context (`AuthContext`) wrapping Supabase auth
- Runtime state: Singleton module (`src/services/runtimeState.ts`) hydrated from Supabase on login, emits `window` events on change
- UI state: Local component state (`useState`)
- Theme: `useTheme` hook, persisted to localStorage, applied via `<html>` class
- No external state management library used

## Key Abstractions

**ILiveSession Interface:**
- Purpose: Abstract real-time audio conversation across providers (Gemini Live, OpenAI Realtime)
- Examples: `src/services/liveSession.ts`, `src/services/geminiLive.ts`, `src/services/openaiRealtimeLive.ts`
- Pattern: Strategy pattern -- both providers implement the same interface with `connect()`, `startMicrophone()`, `stopMicrophone()`, `sendTextMessage()`, `disconnect()`

**Provider-Agnostic AI Calls:**
- Purpose: Route AI requests (chat, STT, TTS, image) to the correct provider based on user's model config
- Examples: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Pattern: Internal dispatch helpers (`callChat`, `callSTT`, `callTTS`) that switch on provider type, with automatic fallback to secondary models

**Runtime State with Event Emission:**
- Purpose: Central in-memory store for model config, API keys, user context, gamification -- hydrated from Supabase, updated reactively
- Examples: `src/services/runtimeState.ts`
- Pattern: Module-level singleton with getter/setter functions; `setRuntime*()` calls `emitRuntimeUpdate()` which dispatches `window` events (`runtime-state-update`, `gamification-update`). Components listen via `useEffect`.

**Dual Storage (Supabase + localStorage):**
- Purpose: Supabase for authenticated users, localStorage for legacy/fallback
- Examples: `src/services/supabase/storage.ts` (primary), `src/services/storage.ts` (legacy)
- Pattern: Supabase storage module mirrors localStorage storage module's API. Runtime state module (`runtimeState.ts`) bridges both -- reads from Supabase on auth, falls back to localStorage/env vars.

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` which loads this module
- Responsibilities: Creates React root, renders `<App />` in StrictMode

**App Component:**
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Sets up `BrowserRouter`, `AuthProvider`, defines all routes with `Layout` wrapper

**Supabase Edge Function:**
- Location: `supabase/functions/ai-proxy/index.ts` (743 lines)
- Triggers: HTTP POST from client `callAIProxy()` in `src/services/supabase/aiProxy.ts`
- Responsibilities: Proxies AI API calls (chat, TTS, STT, image), manages encrypted API keys, decrypts keys for sessions

## Error Handling

**Strategy:** Try/catch with fallback providers

**Patterns:**
- All service functions throw `Error` with descriptive messages on failure
- AI calls have built-in fallback: if primary provider fails, `chatFallbackProvider`/`sttFallbackProvider`/`ttsFallbackProvider` are tried
- `withFallback()` in `src/services/supabase/aiProxy.ts` wraps proxy-first with direct-call fallback
- Auth bootstrap has a 4-second timeout to prevent UI blocking (`AuthContext.tsx` line 63)
- Components display error states locally (e.g., `useTTS` returns `error` string)

## Cross-Cutting Concerns

**Logging:** Console logging only (`console.warn`, `console.error`). No structured logging or log levels.

**Validation:** AI responses are expected to be JSON; `cleanJson()` in `src/utils/cleanJson.ts` strips markdown code fences. No Zod/io-ts schema validation on AI responses.

**Authentication:** Supabase Auth with OAuth (Google, GitHub), PKCE flow. Dev mode skips auth entirely. `AuthContext` provides `user`, `profile`, `loading`, auth methods. `ProtectedRoute` component guards routes but is not currently used in routing (dev mode bypasses auth).

**Encryption:** `src/utils/encryption.ts` provides session token storage for key derivation. API keys are encrypted server-side in the Edge Function and stored in `encrypted_api_keys` table.

**Internationalization:** UI is in Brazilian Portuguese (pt-BR). AI prompts instruct English responses with Portuguese feedback. No i18n library -- strings are hardcoded in Portuguese.

---

*Architecture analysis: 2026-04-01*
