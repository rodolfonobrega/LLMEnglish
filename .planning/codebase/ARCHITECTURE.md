# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Single-Page Application (SPA) with client-side routing

**Key Characteristics:**
- React SPA served by Vite dev server, built to static assets for production
- No server-side rendering; all rendering happens in the browser
- Supabase as Backend-as-a-Service (BaaS) for auth, database, and edge functions
- Proxy-first AI API strategy: all AI calls route through Supabase Edge Function (no direct client-side API calls)
- Runtime state management via a singleton in-memory store (`runtimeState.ts`) with window event emission
- No global state library (no Redux, Zustand, etc.); state lives in React Context (auth) and localStorage/Supabase
- Code splitting via `React.lazy()` for all route-level components
- React Error Boundaries at app root (`AppErrorFallback`) and per-route (`ErrorFallback`)

## Layers

**Presentation Layer:**
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/components/`
- Contains: Page components, shared UI components, domain-specific feature components, error fallback components
- Depends on: `src/hooks/`, `src/services/`, `src/config/`, `src/types/`
- Used by: End user via browser

**Hook Layer:**
- Purpose: Encapsulate reusable stateful logic (audio recording, TTS, theme)
- Location: `src/hooks/`
- Contains: Custom React hooks
- Depends on: `src/services/`, `src/utils/`
- Used by: Presentation layer components

**Service Layer:**
- Purpose: Business logic, AI API orchestration, data persistence, auth
- Location: `src/services/`
- Contains: AI dispatch wrappers (`openai.ts`), Supabase client/storage/auth, gamification logic, error analysis, runtime state
- Depends on: `src/types/`, `src/utils/`, Supabase client SDK
- Used by: Hook layer, some components directly

**Data Access Layer:**
- Purpose: Abstract Supabase and localStorage persistence
- Location: `src/services/supabase/storage.ts` (Supabase), `src/services/storage.ts` (localStorage fallback/dev-mode facade)
- Contains: CRUD functions for cards, gamification, sessions, path progress, model config, API keys, conversation tone
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

1. User navigates to `/practice` or `/exercises` via React Router (lazy-loaded)
2. Page component calls `chatCompletion()` from `src/services/openai.ts`
3. `openai.ts` reads model config from `src/services/runtimeState.ts` and delegates to `src/services/supabase/aiProxy.ts`
4. AI proxy sends request to Supabase Edge Function (`supabase/functions/ai-proxy/index.ts`)
5. User records audio via `useAudioRecorder` hook
6. Audio sent to STT service (`speechToText()` in `openai.ts`) via proxy
7. Transcription evaluated via `chatCompletion()` using prompts from `src/utils/prompts.ts` (with conversation tone)
8. Evaluation result saved as Card via `src/services/supabase/storage.ts`
9. XP/gamification updated via `src/services/gamification.ts`
10. Error patterns extracted and saved via `src/services/errorAnalysis.ts`

**Live Roleplay Flow:**

1. User navigates to `/live`, selects scenario in `ScenarioSetup` component
2. Scenario generated via AI using `getScenarioGenerationPrompt()` from `src/utils/prompts.ts` (with conversation tone)
3. Live session established via `GeminiLiveSession` (`src/services/geminiLive.ts`) or `OpenAIRealtimeLiveSession` (`src/services/openaiRealtimeLive.ts`)
4. Both implement `ILiveSession` interface from `src/services/liveSession.ts`
5. Bidirectional audio streamed via WebRTC/WebSocket
6. Session saved to Supabase via `src/services/supabase/storage.ts`
7. Post-session analysis generated via AI and displayed in `ConversationAnalysis`

**State Management:**
- Auth state: React Context (`AuthContext`) wrapping Supabase auth
- Runtime state: Singleton module (`src/services/runtimeState.ts`) hydrated from Supabase on login, emits `window` events on change. Stores: model config, conversation tone, gamification state, API keys
- UI state: Local component state (`useState`)
- Theme: `useTheme` hook, persisted to localStorage, applied via `<html>` class
- No external state management library used

**Conversation Tone Flow:**
- User sets tone in Settings (`src/components/settings/SettingsPage.tsx`)
- Saved to Supabase via `saveConversationTone()` in `src/services/supabase/storage.ts`
- Stored in runtime state via `setRuntimeConversationTone()` in `src/services/runtimeState.ts`
- All prompt functions in `src/utils/prompts.ts` accept an optional `tone?: ConversationTone` parameter
- `getToneInstruction(tone)` generates the tone-specific instruction block included in every prompt

## Key Abstractions

**ILiveSession Interface:**
- Purpose: Abstract real-time audio conversation across providers (Gemini Live, OpenAI Realtime)
- Examples: `src/services/liveSession.ts`, `src/services/geminiLive.ts`, `src/services/openaiRealtimeLive.ts`
- Pattern: Strategy pattern -- both providers implement the same interface with `connect()`, `startMicrophone()`, `stopMicrophone()`, `sendTextMessage()`, `disconnect()`

**Proxy-First AI Calls:**
- Purpose: Route ALL AI requests through Supabase Edge Function; no direct client-side API calls
- Examples: `src/services/openai.ts` (thin orchestrator), `src/services/supabase/aiProxy.ts` (Edge Function client)
- Pattern: `openai.ts` reads model config from runtime state, selects provider/model, delegates to `aiProxy.ts` which calls the Edge Function. Fallback logic (primary -> fallback model) remains in `openai.ts`. `detectProvider()` infers provider from model ID string.

**Runtime State with Event Emission:**
- Purpose: Central in-memory store for model config, API keys, conversation tone, gamification -- hydrated from Supabase, updated reactively
- Examples: `src/services/runtimeState.ts`
- Pattern: Module-level singleton with getter/setter functions; `setRuntime*()` calls `emitRuntimeUpdate()` which dispatches `window` events (`runtime-state-update`, `gamification-update`). Components listen via `useEffect`.

**Dual Storage (Supabase + localStorage):**
- Purpose: Supabase for authenticated users, localStorage for legacy/fallback
- Examples: `src/services/supabase/storage.ts` (primary), `src/services/storage.ts` (facade for dev mode + Supabase)
- Pattern: `src/services/storage.ts` is now a facade that reads runtime state for sync reads and delegates to Supabase storage for async writes. It handles dev-mode gracefully by skipping writes.

**Error Boundary System:**
- Purpose: Graceful error handling at app level and per-route level
- Examples: `src/components/errors/AppErrorFallback.tsx`, `src/components/errors/ErrorFallback.tsx`, `src/components/errors/ChunkErrorFallback.tsx`
- Pattern: `react-error-boundary` library wraps `<BrowserRouter>` in `App.tsx` with `AppErrorFallback`. Each `<Route>` has `errorElement={<ErrorFallback />}` which detects chunk load errors and offers retry without full reload.

## Entry Points

**Browser Entry:**
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` which loads this module
- Responsibilities: Creates React root, renders `<App />` in StrictMode

**App Component:**
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Sets up `ErrorBoundary`, `BrowserRouter`, `AuthProvider`, defines all routes with `Layout` wrapper, lazy-loads all page components via `React.lazy()`

**Supabase Edge Function:**
- Location: `supabase/functions/ai-proxy/index.ts` (784 lines)
- Triggers: HTTP POST from client via `src/services/supabase/aiProxy.ts`
- Responsibilities: Proxies AI API calls (chat, TTS, STT, image), manages encrypted API keys, decrypts keys for sessions

## Error Handling

**Strategy:** Multi-layer error boundaries with proxy fallback

**Patterns:**
- `react-error-boundary` at app root (`AppErrorFallback`) catches unhandled errors in the entire app
- Per-route `errorElement={<ErrorFallback />}` catches route-level errors, preserving Layout/sidebar navigation
- `ErrorFallback` detects chunk load errors and offers soft retry (re-navigate) vs full reload
- AI calls have built-in fallback: if primary provider fails, configured fallback model is tried
- All service functions throw `Error` with descriptive messages on failure
- Auth bootstrap has a 4-second timeout to prevent UI blocking (`AuthContext.tsx`)

## Cross-Cutting Concerns

**Logging:** Console logging only (`console.warn`, `console.error`). No structured logging or log levels.

**Validation:** AI responses are expected to be JSON; `cleanJson()` in `src/utils/cleanJson.ts` strips markdown code fences. No Zod/io-ts schema validation on AI responses.

**Authentication:** Supabase Auth with OAuth (Google, GitHub), PKCE flow. Dev mode skips auth entirely. `AuthContext` provides `user`, `profile`, `loading`, auth methods. `ProtectedApp` component redirects unauthenticated users to `/login`.

**Encryption:** `src/utils/encryption.ts` provides session token storage for key derivation. API keys are encrypted server-side in the Edge Function and stored in `encrypted_api_keys` table.

**Internationalization:** UI is in Brazilian Portuguese (pt-BR). AI prompts instruct English responses with Portuguese feedback. No i18n library -- strings are hardcoded in Portuguese.

**Conversation Tone:** `ConversationTone` type (`'casual' | 'balanced' | 'formal'`) defined in `src/types/settings.ts`. All prompt functions in `src/utils/prompts.ts` accept an optional `tone` parameter. `getToneInstruction()` generates tone-specific instruction blocks. Stored in runtime state and persisted to Supabase.

---

*Architecture analysis: 2026-04-05*
