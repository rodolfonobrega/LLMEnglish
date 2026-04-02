# SpeakLab

## Subindo a aplicação

O app usa **Supabase remoto** (credenciais em `.env.local`). Não precisa de Docker local.

```bash
npx vite --port 5173 --host
```

- **Porta 5173** é obrigatória — é a configurada no `supabase/config.toml` (`site_url` e `additional_redirect_urls`).
- **`--host`** é necessário dentro de devcontainers para expor o servidor fora do container.
- Sem `--host`, o Vite escuta só em `localhost` interno e o browser do host não acessa.

## Dev mode (sem Supabase)

Em modo dev (`npx vite`), o app pula autenticação e mostra a UI direto. Não precisa de `.env.local` nem Supabase. Ideal para iterar em UI visual. Features que dependem do backend (auth, DB, AI) não funcionam nesse modo.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**SpeakLab — Hardening & Praticar Redesign**

SpeakLab is an English learning app with scenario-based exercises, live AI roleplay, flashcards, and learning trails. Users practice through multiple modes (phrases, conversation, image-based exercises, live roleplay, trails) powered by AI (Gemini, OpenAI, Groq) with speech recognition and TTS. This milestone focuses on fixing critical architectural concerns and redesigning the Praticar (practice hub) page to match the visual quality of the rest of the app.

**Core Value:** A reliable, polished practice experience — the app shouldn't crash, secrets shouldn't leak, and every page should feel cohesive.

### Constraints

- **Tech Stack**: React 19, Vite, Tailwind CSS, Supabase — no new framework additions
- **Client-side only**: No Supabase migration or backend schema changes
- **Visual consistency**: Must use existing design tokens (CSS variables, Tailwind classes)
- **No breaking changes**: Existing routes, storage APIs, and component contracts must keep working
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9 - All application source code in `src/`, strict mode enabled
- SQL - Supabase database migrations in `supabase/migrations/`
- Deno TypeScript - Supabase Edge Function in `supabase/functions/ai-proxy/index.ts`
## Runtime
- Browser (SPA) - Vite dev server serves the app; no server-side rendering
- ES2022 target, ESNext modules, `react-jsx` transform
- npm (inferred from `package-lock.json` patterns)
- `"type": "module"` - ESM throughout
## Frameworks
- React 19.2 - UI framework, functional components with hooks
- Vite 6.4 - Build tool and dev server, configured in `vite.config.ts`
- React Router DOM 7.13 - Client-side routing via `BrowserRouter` in `src/App.tsx`
- Radix UI (`@radix-ui/react-slot`, `@radix-ui/react-tooltip`) - Accessible primitives
- Base UI (`@base-ui/react`) - Additional accessible primitives
- Custom UI components in `src/components/ui/` following shadcn/ui patterns (Button, Dialog, Input, etc.)
- `motion` 12.33 - Framer Motion successor for animations
- Tailwind CSS 4.1 - Utility-first CSS via `@tailwindcss/vite` plugin
- `tw-animate-css` - Animation utilities for Tailwind
- CSS custom properties for theming in `src/index.css` (light/dark mode via HSL variables)
- `class-variance-authority` (CVA) - Variant-based component styling
- `clsx` + `tailwind-merge` - Conditional class merging via `src/utils/cn.ts`
- `lucide-react` 0.563 - Icon library
- `jspdf` 4.2 - PDF generation in `src/components/practice/PracticePage.tsx`
## State Management
- React Context - `AuthProvider` in `src/contexts/AuthContext.tsx` for auth state
- Local component state via `useState`/`useEffect`
- Custom singleton in `src/services/runtimeState.ts` - In-memory state hydrated from Supabase on login
- Stores model config, API keys, conversation tone, user context, gamification
- Dispatches custom DOM events (`runtime-state-update`, `gamification-update`) for reactive updates
- API key priority: runtime state (from Supabase encrypted storage) > env vars (`VITE_*_API_KEY`)
- LocalStorage-based storage in `src/services/storage.ts` - Used as fallback when Supabase is unavailable
- Prefix `el_` for localStorage keys
## Routing
- `/login` - Public login page
- `/migrate` - Migration page (LocalStorage to Supabase)
- `/` - Protected routes wrapped in `Layout`:
## Build Tools
- `@vitejs/plugin-react` - React Fast Refresh
- `@tailwindcss/vite` - Tailwind CSS 4 integration
- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` - Hooks rules
- `eslint-plugin-react-refresh` - Vite Fast Refresh rules
- Vitest 4.0 - Test runner, configured in `vite.config.ts`
- `jsdom` 28 - DOM environment for tests
- `@vitest/coverage-v8` - Code coverage
- Test setup: `src/test/setup.ts`
## Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.2 | UI framework |
| `react-dom` | 19.2 | React DOM renderer |
| `react-router-dom` | 7.13 | Client-side routing |
| `@supabase/supabase-js` | 2.99 | Supabase client (auth, DB, storage) |
| `@google/genai` | 1.0 | Google Gemini SDK (Live API, chat, TTS) |
| `tailwindcss` | 4.1 | Utility-first CSS framework |
| `motion` | 12.33 | Animation library (Framer Motion successor) |
| `lucide-react` | 0.563 | Icon library |
| `class-variance-authority` | 0.7 | Component variant styling |
| `clsx` | 2.1 | Conditional class names |
| `tailwind-merge` | 3.4 | Intelligent Tailwind class merging |
| `jspdf` | 4.2 | PDF generation |
| `vite` | 6.4 | Build tool and dev server |
| `vitest` | 4.0 | Test runner |
| `typescript` | 5.9 | Type checking |
| `eslint` | 9.39 | Linting |
| `jsdom` | 28 | Test DOM environment |
| `@radix-ui/react-slot` | 1.2 | Polymorphic component primitive |
| `@radix-ui/react-tooltip` | 1.2 | Accessible tooltips |
| `tw-animate-css` | 1.4 | Tailwind animation utilities |
## Configuration Files
| File | Purpose |
|------|---------|
| `vite.config.ts` | Vite + Vitest config, Groq proxy |
| `tsconfig.json` | TypeScript project references |
| `tsconfig.app.json` | App source TS config (ES2022, strict) |
| `tsconfig.node.json` | Node/build TS config |
| `eslint.config.js` | ESLint flat config |
| `package.json` | Dependencies and scripts |
| `src/index.css` | Tailwind imports, CSS custom properties (theming) |
| `supabase/config.toml` | Supabase local config (auth, DB, API ports) |
## Platform Requirements
- Node.js (version compatible with Vite 6.4 and TypeScript 5.9)
- Port 5173 required (Supabase OAuth redirect URL configured for this port)
- `--host` flag needed in devcontainers for external access
- Optional: `.env.local` with Supabase credentials for full-stack dev
- Dev mode works without backend (auth skipped, no Supabase needed)
- Static SPA deployment (Vite build output in `dist/`)
- Requires Supabase remote project for auth and data
- Supabase Edge Function `ai-proxy` must be deployed
- Users configure their own AI API keys (OpenAI, Gemini, Groq) via Settings
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- PascalCase for React components: `Button.tsx`, `ModeCard.tsx`, `PracticeHubPage.tsx`
- camelCase for utility/service modules: `openai.ts`, `storage.ts`, `cn.ts`
- camelCase for hooks: `useLocalStorage.ts`, `useTheme.ts`, `useTTS.ts`
- camelCase for types: `settings.ts`, `gamification.ts`, `supabase.ts`
- Test files mirror source with `.test.ts` suffix: `openai.test.ts`, `modes.test.ts`
- Test files are co-located with source (same directory)
- camelCase for all functions: `getModelConfig()`, `chatCompletion()`, `blobToBase64()`
- Private/internal helper functions prefixed with lowercase provider name: `openaiChat()`, `geminiTTS()`, `groqSTT()`
- `export` only on public API functions; internal helpers are file-scoped (no `export`)
- Boolean getters use `get` prefix: `getOpenAIKey()`, `getGeminiKey()`
- camelCase for all variables: `config`, `base64Audio`, `mediaRecorder`
- UPPER_SNAKE_CASE for constants: `OPENAI_BASE`, `GROQ_BASE`, `MAX_SESSION_REPORTS`
- `KEYS` object for localStorage key constants in `src/services/storage.ts`
- PascalCase for interfaces and types: `ModelConfig`, `PracticeMode`, `AudioRecorderState`
- Export types alongside their usage: `export type Provider = ...`
- `type` keyword preferred over `interface` for simple unions: `type Provider = 'openai' | 'gemini' | 'groq'`
- `interface` keyword for object shapes: `interface ButtonProps`, `interface AuthContextValue`
- Use `readonly` arrays for config data: `export const exerciseModes: readonly PracticeMode[]`
## Code Style
- No Prettier config file detected; formatting follows TypeScript/React community conventions
- 2-space indentation (consistent across all files)
- Single quotes for imports and strings
- Semicolons at end of statements
- Trailing commas in objects and arrays
- ESLint 9 with flat config at `eslint.config.js`
- Extends: `js.configs.recommended`, `tseslint.configs.recommended`, `react-hooks`, `react-refresh`
- Key rules:
- Global ignores: `dist`, `coverage`
- `strict: true` enabled in `tsconfig.app.json`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noUncheckedSideEffectImports: true`
- `verbatimModuleSyntax: true` (requires `import type` for type-only imports)
- `erasableSyntaxOnly: true`
- Target: ES2022 with bundler module resolution
## Import Organization
- Use `import type` for type-only imports (required by `verbatimModuleSyntax`):
- Destructure named imports (no wildcard imports)
- No path aliases configured; all imports use relative paths
## Component Patterns
- All components are function components with named exports
- No class components anywhere in the codebase
- Export pattern: `export function ComponentName()` (named export, not default)
- Exception: `App.tsx` uses `export default App`
- Located in `src/components/ui/`
- Use `React.forwardRef` pattern: `const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(...)`
- Set `displayName`: `Button.displayName = "Button"`
- Use `class-variance-authority` (cva) for variant styling
- Use `cn()` utility (clsx + twMerge) for class composition
- Legacy variant mapping pattern for backward compatibility (see `src/components/ui/Button.tsx`)
- Located in feature directories: `src/components/practice/PracticeHubPage.tsx`
- Named export, no props (pages get data from hooks/context)
- Use `useNavigate()` for navigation
## State Patterns
- `useState` for component-local state
- `useRef` for mutable refs (MediaRecorder, DOM elements)
- State objects use interfaces: `AudioRecorderState`, `AuthContextValue`
- Located in `src/hooks/`
- Prefix with `use`: `useLocalStorage`, `useTheme`, `useTTS`, `useAudioRecorder`
- Return destructurable objects: `return { speak, isLoading, error, stopAudio }`
- Use `useCallback` for memoized functions passed as return values
- React Context via `src/contexts/AuthContext.tsx` for auth
- Runtime state module pattern in `src/services/runtimeState.ts`:
- localStorage for persistence (wrapped in `src/services/storage.ts`)
## Error Handling
- Throw `Error` with descriptive messages for API failures: `throw new Error('OpenAI API key not configured. Go to Settings to add it.')`
- Provider fallback pattern: try primary, catch and try fallback, then re-throw if both fail
- `console.warn` for fallback triggers: `console.warn('Primary chat failed, trying fallback:', primaryError)`
- `console.error` for logged errors: `console.error('Failed to load session:', error)`
- `try/catch` with empty catch blocks for non-critical storage operations
- Error state in hooks: `const [error, setError] = useState<string | null>(null)`
- `src/components/errors/ErrorDashboard.tsx` exists as a dedicated page
- No React Error Boundary component detected (errors handled at page/component level)
## Styling Conventions
- Tailwind CSS v4 (imported via `@tailwindcss/vite` plugin)
- Custom CSS variables defined in `src/index.css` using `@layer base` and `@theme`
- HSL variables for all colors: `--background: 210 33% 97%`
- Light and dark mode variants via `.dark` class
- Semantic color names: `--brand-primary`, `--brand-special`, `--danger`
- Mode-specific color tokens: `--mode-phrases`, `--mode-texts`, `--mode-situations`, etc.
- Each mode has a `-soft` variant for backgrounds: `--mode-phrases-soft`
- Use semantic color classes via `@theme` mapping: `text-foreground`, `bg-card`, `text-muted-foreground`
- Compose classes with `cn()` utility: `cn('base-classes', className)`
- Group related classes with comments: `{/* Sidebar - Desktop Only */}`
- Responsive: `hidden lg:block` for desktop-only, `lg:hidden` for mobile-only
- Breakpoint used: `lg` (1024px) for sidebar/mobile-nav toggle
- `.glass` - frosted glass effect with backdrop blur
- `.gradient-text` - brand gradient text
- `.card-hover` - lift effect on hover
- `.speech-bubble` - chat bubble with arrow
- `.scrollbar-hide` - hide scrollbar
- `.animate-*` - custom animations (float, pulse-glow, wave, message-in, progress-indeterminate)
- Access via inline styles: `style={{ borderLeftColor: 'hsl(var(--mode-phrases))' }}`
- Never hardcode colors in component files
## Git Conventions
- Conventional Commits style: `type: description`
- Types observed: `feat`, `fix`
- Examples:
- Single `main` branch for development
- No feature branch pattern detected in recent history
## Configuration Files
- `tsconfig.json` - project references to app and node configs
- `tsconfig.app.json` - app source config (`src/` include, strict mode, ES2022)
- `tsconfig.node.json` - Node/tooling config
- `eslint.config.js` - flat config with TypeScript, React hooks, React refresh plugins
- `vite.config.ts` - Vite 6 with React, Tailwind CSS plugins, test config, Groq proxy
- No separate Tailwind config file (Tailwind v4 uses CSS-based config)
- `.env` - base env vars (exists, do not read)
- `.env.local` - local overrides (exists, do not read)
- `.env.example` and `.env.local.example` - template files
- Vite env vars use `VITE_` prefix: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY`
- `.gitignore` - standard Node ignores plus `.env`, `.env.local`, `coverage/`
- `Dockerfile` - production container config
- `nginx.conf` - production server config
- `Makefile` - build/dev commands
- `CLAUDE.md` - Claude Code instructions
- `AGENTS.md` - agent instructions
## Environment Setup
- Node.js (version managed by `.nvmrc` or similar)
- npm (lockfile: `package-lock.json` present)
- Port 5173 is required (Supabase redirect URLs configured for this port)
- `--host` flag needed in devcontainers
- Dev mode (`vite`) skips auth if no Supabase env vars -- UI renders directly
- Supabase is remote; no Docker needed for local development
## Module Design
- Named exports preferred: `export function ...`, `export const ...`
- Default export only for `App` in `src/App.tsx`
- No barrel files (index.ts re-exports) in component directories
- `src/services/supabase/index.ts` is the only barrel file detected
- Services in `src/services/` export functions, not classes (except live sessions)
- Live session classes (`GeminiLiveSession`, `OpenAIRealtimeLiveSession`) use constructor + method pattern
- Storage layer abstracts localStorage: `src/services/storage.ts`
- Runtime state module: `src/services/runtimeState.ts` (in-memory + Supabase hydration)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- React SPA served by Vite dev server, built to static assets for production
- No server-side rendering; all rendering happens in the browser
- Supabase as Backend-as-a-Service (BaaS) for auth, database, and edge functions
- Dual API strategy: direct client-side AI API calls (with user keys) AND proxy through Supabase Edge Function
- Runtime state management via a singleton in-memory store (`runtimeState.ts`) with window event emission
- No global state library (no Redux, Zustand, etc.); state lives in React Context (auth) and localStorage/Supabase
## Layers
- Purpose: Render UI, handle user interactions, manage local UI state
- Location: `src/components/`
- Contains: Page components, shared UI components, domain-specific feature components
- Depends on: `src/hooks/`, `src/services/`, `src/config/`, `src/types/`
- Used by: End user via browser
- Purpose: Encapsulate reusable stateful logic (audio recording, TTS, theme)
- Location: `src/hooks/`
- Contains: Custom React hooks
- Depends on: `src/services/`, `src/utils/`
- Used by: Presentation layer components
- Purpose: Business logic, AI API calls, data persistence, auth
- Location: `src/services/`
- Contains: API wrappers, Supabase client/storage/auth, gamification logic, error analysis, runtime state
- Depends on: `src/types/`, `src/utils/`, Supabase client SDK
- Used by: Hook layer, some components directly
- Purpose: Abstract Supabase and localStorage persistence
- Location: `src/services/supabase/storage.ts` (Supabase), `src/services/storage.ts` (localStorage fallback)
- Contains: CRUD functions for cards, gamification, sessions, path progress, model config, API keys
- Depends on: `src/services/supabase/client.ts`, `src/types/`
- Used by: Service layer functions (`gamification.ts`, `errorAnalysis.ts`, `runtimeState.ts`)
- Purpose: TypeScript type definitions shared across all layers
- Location: `src/types/`
- Contains: Domain type definitions (Card, Scenario, Gamification, Settings, Errors, Supabase DB types)
- Depends on: Nothing (leaf layer)
- Used by: All other layers
- Purpose: Static configuration, navigation structure, practice mode definitions, image config
- Location: `src/config/`
- Contains: Navigation items, mode definitions, practice setup steps, image generation config
- Depends on: `src/types/`
- Used by: Presentation layer for rendering navigation/modes
- Purpose: Pure helper functions with no side effects
- Location: `src/utils/`
- Contains: Tailwind class merging (`cn`), JSON cleaning, audio conversion, encryption, prompts, roleplay trail data
- Depends on: `src/types/` (for prompts and trails)
- Used by: All layers
## Data Flow
- Auth state: React Context (`AuthContext`) wrapping Supabase auth
- Runtime state: Singleton module (`src/services/runtimeState.ts`) hydrated from Supabase on login, emits `window` events on change
- UI state: Local component state (`useState`)
- Theme: `useTheme` hook, persisted to localStorage, applied via `<html>` class
- No external state management library used
## Key Abstractions
- Purpose: Abstract real-time audio conversation across providers (Gemini Live, OpenAI Realtime)
- Examples: `src/services/liveSession.ts`, `src/services/geminiLive.ts`, `src/services/openaiRealtimeLive.ts`
- Pattern: Strategy pattern -- both providers implement the same interface with `connect()`, `startMicrophone()`, `stopMicrophone()`, `sendTextMessage()`, `disconnect()`
- Purpose: Route AI requests (chat, STT, TTS, image) to the correct provider based on user's model config
- Examples: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Pattern: Internal dispatch helpers (`callChat`, `callSTT`, `callTTS`) that switch on provider type, with automatic fallback to secondary models
- Purpose: Central in-memory store for model config, API keys, user context, gamification -- hydrated from Supabase, updated reactively
- Examples: `src/services/runtimeState.ts`
- Pattern: Module-level singleton with getter/setter functions; `setRuntime*()` calls `emitRuntimeUpdate()` which dispatches `window` events (`runtime-state-update`, `gamification-update`). Components listen via `useEffect`.
- Purpose: Supabase for authenticated users, localStorage for legacy/fallback
- Examples: `src/services/supabase/storage.ts` (primary), `src/services/storage.ts` (legacy)
- Pattern: Supabase storage module mirrors localStorage storage module's API. Runtime state module (`runtimeState.ts`) bridges both -- reads from Supabase on auth, falls back to localStorage/env vars.
## Entry Points
- Location: `src/main.tsx`
- Triggers: Browser loads `index.html` which loads this module
- Responsibilities: Creates React root, renders `<App />` in StrictMode
- Location: `src/App.tsx`
- Triggers: Mounted by `main.tsx`
- Responsibilities: Sets up `BrowserRouter`, `AuthProvider`, defines all routes with `Layout` wrapper
- Location: `supabase/functions/ai-proxy/index.ts` (743 lines)
- Triggers: HTTP POST from client `callAIProxy()` in `src/services/supabase/aiProxy.ts`
- Responsibilities: Proxies AI API calls (chat, TTS, STT, image), manages encrypted API keys, decrypts keys for sessions
## Error Handling
- All service functions throw `Error` with descriptive messages on failure
- AI calls have built-in fallback: if primary provider fails, `chatFallbackProvider`/`sttFallbackProvider`/`ttsFallbackProvider` are tried
- `withFallback()` in `src/services/supabase/aiProxy.ts` wraps proxy-first with direct-call fallback
- Auth bootstrap has a 4-second timeout to prevent UI blocking (`AuthContext.tsx` line 63)
- Components display error states locally (e.g., `useTTS` returns `error` string)
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
