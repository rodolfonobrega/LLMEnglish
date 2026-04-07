# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
LLMEnglish/                       # Project root
├── src/                          # Application source code
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with routing, error boundaries, lazy loading
│   ├── index.css                 # Global styles (Tailwind)
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── components/               # React components organized by domain
│   │   ├── auth/                 # Authentication pages
│   │   ├── discovery/            # Home/discovery page
│   │   ├── errors/               # Error fallbacks and analytics dashboard
│   │   │   └── __tests__/        # Error component tests
│   │   ├── exercises/            # Exercise practice pages
│   │   ├── history/              # Session history
│   │   ├── layout/               # App shell (header, sidebar, nav, dev banner)
│   │   ├── library/              # Card library browser
│   │   ├── live-roleplay/        # Live audio roleplay feature
│   │   ├── paths/                # Learning trails/paths
│   │   ├── practice/             # Practice hub and script mode
│   │   ├── review/               # Spaced repetition review
│   │   ├── settings/             # User settings
│   │   ├── shared/               # Cross-feature shared components
│   │   └── ui/                   # Primitive UI components + custom domain widgets
│   │       └── custom/           # Domain-specific composite widgets
│   ├── config/                   # Static configuration and mode definitions
│   ├── contexts/                 # React contexts (AuthContext)
│   ├── hooks/                    # Custom React hooks
│   ├── services/                 # Business logic and API layer
│   │   └── supabase/             # Supabase-specific service modules
│   ├── test/                     # Test setup and configuration
│   ├── types/                    # TypeScript type definitions
│   └── utils/                    # Pure utility functions and data
├── supabase/                     # Supabase backend
│   ├── functions/                # Edge Functions
│   │   └── ai-proxy/             # AI proxy and key management
│   └── migrations/               # Database migration SQL files
├── public/                       # Static assets served as-is
│   └── images/                   # Mode thumbnails, backgrounds, trail images
├── scripts/                      # Build/utility scripts
├── docs/                         # Documentation
├── .planning/                    # GSD workflow planning artifacts
│   ├── codebase/                 # Codebase analysis documents (this file)
│   ├── milestones/               # Archived milestone docs (v1.0)
│   │   └── v1.0-phases/          # Archived v1.0 phase documents
│   ├── phases/                   # Active phase documents (currently empty)
│   ├── research/                 # Initial codebase research docs
│   ├── MILESTONES.md             # Milestone tracking
│   ├── PROJECT.md                # Project overview
│   ├── ROADMAP.md                # Roadmap
│   ├── STATE.md                  # Current state tracking
│   └── config.json               # GSD configuration
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite + Vitest configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript root config
├── tsconfig.app.json             # TypeScript app config
├── tsconfig.node.json            # TypeScript node config
├── eslint.config.js              # ESLint flat config
├── CLAUDE.md                     # AI assistant instructions
├── AGENTS.md                     # Agent instructions
├── Dockerfile                    # Production container config
├── nginx.conf                    # Production server config
└── Makefile                      # Build/dev commands
```

## Directory Purposes

**`src/components/auth/`:**
- Purpose: Login and data migration pages
- Contains: `LoginPage.tsx`, `MigrationPage.tsx`
- Key files: `LoginPage.tsx` -- OAuth login UI with Google/GitHub buttons

**`src/components/discovery/`:**
- Purpose: Main home/dashboard page after login
- Contains: `DiscoveryPage.tsx`, `ExerciseMode.tsx`, `ImageMode.tsx`
- Key files: `DiscoveryPage.tsx` -- Landing page showing all practice modes and gamification stats

**`src/components/errors/`:**
- Purpose: Error fallback components and error analytics dashboard
- Contains: `AppErrorFallback.tsx`, `ChunkErrorFallback.tsx`, `ErrorDashboard.tsx`, `ErrorFallback.tsx`, `__tests__/`
- Key files: `AppErrorFallback.tsx` -- App-level error boundary fallback (full page); `ErrorFallback.tsx` -- Route-level error boundary with chunk error detection; `ErrorDashboard.tsx` -- Error pattern analytics

**`src/components/exercises/`:**
- Purpose: Exercise practice flow
- Contains: `ExercisesPage.tsx`
- Key files: `ExercisesPage.tsx` -- Handles phrase/text/situation/image exercise generation, recording, evaluation

**`src/components/history/`:**
- Purpose: Session history view
- Contains: `HistoryPage.tsx`

**`src/components/layout/`:**
- Purpose: Application shell and navigation
- Contains: `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Navigation.tsx`, `DevBanner.tsx`
- Key files: `Layout.tsx` -- Wraps all authenticated routes with Header, Sidebar (desktop), Navigation (mobile), and `<Outlet />`; `DevBanner.tsx` -- Dev mode indicator banner

**`src/components/library/`:**
- Purpose: Card library browser
- Contains: `LibraryPage.tsx`, `CardDetail.tsx`

**`src/components/live-roleplay/`:**
- Purpose: Live audio conversation feature
- Contains: `LiveRoleplayPage.tsx`, `ScenarioSetup.tsx`, `LiveSession.tsx`, `ConversationAnalysis.tsx`
- Key files: `ScenarioSetup.tsx` -- Stepped flow for selecting scenario parameters; `LiveSession.tsx` -- Active real-time conversation UI

**`src/components/paths/`:**
- Purpose: Learning trails/paths
- Contains: `PathsPage.tsx`

**`src/components/practice/`:**
- Purpose: Practice hub and script reading mode
- Contains: `PracticeHubPage.tsx`, `PracticePage.tsx`, `PracticeHubPage.test.tsx`

**`src/components/review/`:**
- Purpose: Spaced repetition review session
- Contains: `ReviewPage.tsx`

**`src/components/settings/`:**
- Purpose: User settings (model config, API keys, conversation tone)
- Contains: `SettingsPage.tsx`

**`src/components/shared/`:**
- Purpose: Cross-feature reusable components
- Contains: `AudioRecorder.tsx`, `EvaluationResults.tsx`, `FeedbackPanel.tsx`, `ModeCard.tsx`, `ModeTooltip.tsx`, `PracticeModeCard.tsx`, `ScoreDisplay.tsx`, `SelectionDot.tsx`, `ThemeSelector.tsx`
- Key files: `PracticeModeCard.tsx` -- Practice mode card variant

**`src/components/ui/`:**
- Purpose: Primitive UI building blocks (design system)
- Contains: `AlertDialog.tsx`, `Badge.tsx`, `Button.tsx`, `card.tsx`, `Dialog.tsx`, `Input.tsx`, `PageSkeleton.tsx`, `Select.tsx`, `Skeleton.tsx`, `Textarea.tsx`, `Tooltip.tsx`
- Key files: These are generic, reusable primitives (similar to shadcn/ui pattern). `PageSkeleton.tsx` -- Loading skeleton for page-level lazy loading.

**`src/components/ui/custom/`:**
- Purpose: Domain-specific composite UI widgets
- Contains: `ExerciseCard.tsx`, `MicrophoneButton.tsx`, `PathCard.tsx`, `ProgressBar.tsx`, `WordChip.tsx`, `XPBadge.tsx`, `index.ts`
- Key files: `index.ts` -- barrel export for all custom widgets

**`src/config/`:**
- Purpose: Static configuration and mode definitions
- Contains: `navigation.ts`, `modes.ts`, `practice.ts`, `images.ts`, `modes.test.ts`, `navigation.test.ts`, `practice.test.ts`, `README.md`
- Key files: `modes.ts` -- Defines all practice modes (exercise, conversation, trails) with routes, icons, images; `navigation.ts` -- Primary nav items; `images.ts` -- Image generation parameters per context

**`src/contexts/`:**
- Purpose: React context providers
- Contains: `AuthContext.tsx`
- Key files: `AuthContext.tsx` -- Provides `user`, `profile`, `loading`, auth methods, and `ProtectedRoute` component

**`src/hooks/`:**
- Purpose: Custom React hooks
- Contains: `useAudioRecorder.ts`, `useLocalStorage.ts`, `useTTS.ts`, `useTheme.ts`
- Key files: `useAudioRecorder.ts` -- Manages MediaRecorder for voice capture; `useTTS.ts` -- Wraps TTS service with loading/error state

**`src/services/`:**
- Purpose: Business logic, API calls, data persistence
- Contains: `openai.ts`, `geminiLive.ts`, `openaiRealtimeLive.ts`, `liveSession.ts`, `storage.ts`, `gamification.ts`, `errorAnalysis.ts`, `spacedRepetition.ts`, `runtimeState.ts`
- Key files: `openai.ts` -- Thin AI dispatcher that delegates all calls to proxy (174 lines); `runtimeState.ts` -- In-memory singleton state for model config, conversation tone, gamification, API keys (121 lines); `gamification.ts` -- XP/level/streak/badge logic

**`src/services/supabase/`:**
- Purpose: Supabase-specific client, auth, storage, and AI proxy
- Contains: `client.ts`, `auth.ts`, `storage.ts` (916 lines), `aiProxy.ts` (224 lines), `index.ts`
- Key files: `client.ts` -- Singleton Supabase client with Proxy for lazy init; `storage.ts` -- Full CRUD for all Supabase tables; `aiProxy.ts` -- Edge Function client for proxied AI calls and key management; `index.ts` -- Barrel re-export of all Supabase services

**`src/types/`:**
- Purpose: TypeScript type definitions
- Contains: `card.ts`, `scenario.ts`, `gamification.ts`, `settings.ts`, `review.ts`, `errors.ts`, `supabase.ts`
- Key files: `supabase.ts` -- Full database schema types (Database interface with all tables); `card.ts` -- Card and EvaluationResult types; `settings.ts` -- ModelConfig, ConversationTone, and all model/voice option lists (no UserContext -- removed)

**`src/utils/`:**
- Purpose: Pure utility functions and static data
- Contains: `cn.ts`, `cleanJson.ts`, `audio.ts`, `encryption.ts`, `prompts.ts` (438 lines), `roleplayTrails.ts`, `migrateToSupabase.ts` (462 lines)
- Key files: `prompts.ts` -- All AI system/user prompts for exercise generation, evaluation, live roleplay, conversation analysis. All prompt functions accept optional `tone?: ConversationTone` parameter; `roleplayTrails.ts` -- Trail/step definitions for guided learning paths; `cn.ts` -- Tailwind class merge utility

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, loads `src/main.tsx`, includes theme flash prevention script
- `src/main.tsx`: React root creation, renders `<App />`
- `src/App.tsx`: ErrorBoundary + BrowserRouter setup, AuthProvider, all lazy-loaded route definitions with per-route error elements

**Routing:**
- `src/App.tsx`: All routes defined inline (React Router v7). All page components loaded via `React.lazy()`. `ProtectedApp` guards the index route.

**Configuration:**
- `vite.config.ts`: Vite build config with Tailwind plugin, Vitest setup, Groq proxy
- `src/config/navigation.ts`: Primary nav items (Inicio, Praticar, Biblioteca, etc.)
- `src/config/modes.ts`: Practice mode definitions with routes and metadata
- `src/config/images.ts`: Image generation parameters per context and provider

**Core Logic (Services):**
- `src/services/runtimeState.ts`: In-memory singleton state with event emission (model config, conversation tone, gamification, API keys)
- `src/services/openai.ts`: Thin AI dispatcher -- reads config, delegates to proxy (174 lines)
- `src/services/supabase/client.ts`: Supabase singleton client with lazy Proxy
- `src/services/supabase/storage.ts`: Full CRUD for all Supabase tables (cards, gamification, sessions, conversation tone, etc.)
- `src/services/supabase/aiProxy.ts`: Edge Function client for proxied AI calls (224 lines)
- `src/services/supabase/auth.ts`: OAuth sign-in/sign-out, session, profile management
- `src/services/gamification.ts`: XP, leveling, streaks, badge awarding
- `src/services/errorAnalysis.ts`: Error pattern extraction, tracking, analytics (532 lines)
- `src/services/geminiLive.ts`: Gemini Live API WebSocket session class
- `src/services/liveSession.ts`: `ILiveSession` interface and callback types

**Types:**
- `src/types/supabase.ts`: Full database schema types
- `src/types/card.ts`: Card, EvaluationResult, ReviewEntry
- `src/types/scenario.ts`: LiveScenario, LiveSession, RoleplayTrail, PathProgress
- `src/types/settings.ts`: ModelConfig, ConversationTone, all model/voice option arrays (UserContext removed)

**Prompts:**
- `src/utils/prompts.ts`: All AI prompts for exercise generation, evaluation, live roleplay, conversation analysis, tutor explanations, custom dialogues. Every prompt function accepts optional `tone?: ConversationTone`.

**Error Handling:**
- `src/components/errors/AppErrorFallback.tsx`: App-level error boundary fallback
- `src/components/errors/ErrorFallback.tsx`: Route-level error fallback with chunk error detection
- `src/components/errors/ChunkErrorFallback.tsx`: Specialized chunk load error fallback

**Backend:**
- `supabase/functions/ai-proxy/index.ts`: Edge Function (784 lines) -- AI proxy, API key encryption/decryption
- `supabase/migrations/20260324221155_initial_schema.sql`: Initial database schema

## Route Map

| Path | Component | Guard | Lazy | Description |
|------|-----------|-------|------|-------------|
| `/login` | `LoginPage` | Public | No | OAuth login (Google/GitHub) |
| `/migrate` | `MigrationPage` | Public | No | Data migration from localStorage to Supabase |
| `/` | `ProtectedApp` -> `DiscoveryPage` | Auth check | Yes | Home/dashboard with practice modes |
| `/practice` | `PracticeHubPage` | Layout wrapper | Yes | Practice mode selector hub |
| `/exercises` | `ExercisesPage` | Layout wrapper | Yes | Exercise flow (phrases, texts, situations, visual) |
| `/scripts` | `PracticePage` | Layout wrapper | Yes | Script reading/acting mode |
| `/live` | `LiveRoleplayPage` | Layout wrapper | Yes | Live audio roleplay |
| `/paths` | `PathsPage` | Layout wrapper | Yes | Learning trails |
| `/library` | `LibraryPage` | Layout wrapper | Yes | Card library browser |
| `/review` | `ReviewPage` | Layout wrapper | Yes | Spaced repetition review |
| `/errors` | `ErrorDashboard` | Layout wrapper | Yes | Error analytics |
| `/history` | `HistoryPage` | Layout wrapper | Yes | Session history |
| `/settings` | `SettingsPage` | Layout wrapper | Yes | Model config, API keys, conversation tone |

**Route structure:** Public routes (`/login`, `/migrate`) render standalone with `errorElement`. All other routes nest under `<Layout />` which provides Header, Sidebar (desktop), Navigation (mobile). Each route has `errorElement={<ErrorFallback />}` for route-level error handling that preserves Layout/sidebar. The `ProtectedApp` component at `/` checks auth state and redirects to `/login` if unauthenticated.

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` (e.g., `DiscoveryPage.tsx`, `ModeCard.tsx`)
- Services: camelCase `.ts` (e.g., `gamification.ts`, `errorAnalysis.ts`)
- Hooks: camelCase with `use` prefix `.ts` (e.g., `useAudioRecorder.ts`, `useTTS.ts`)
- Types: camelCase `.ts` (e.g., `card.ts`, `scenario.ts`, `supabase.ts`)
- Utils: camelCase `.ts` (e.g., `cleanJson.ts`, `roleplayTrails.ts`)
- Config: camelCase `.ts` (e.g., `navigation.ts`, `modes.ts`)
- Tests: `.test.ts`/`.test.tsx` suffix -- either co-located with source or in `__tests__/` subdirectory
- UI primitives: PascalCase `.tsx` in `components/ui/` (e.g., `Button.tsx`, `Dialog.tsx`)
- Barrel exports: `index.ts` (e.g., `components/ui/custom/index.ts`, `services/supabase/index.ts`)

**Components:**
- Named exports only (no default exports except `App`)
- Page components suffixed with `Page` (e.g., `DiscoveryPage`, `SettingsPage`)

## Where to Add New Code

**New Page/Route:**
- Component: `src/components/{feature}/{FeatureName}Page.tsx`
- Add route in: `src/App.tsx` inside the `<Route path="/" element={<Layout />}>` block with `errorElement={<ErrorFallback />}`
- Use lazy loading pattern: `const FeaturePage = lazy(() => import('./components/feature/FeaturePage').then(m => ({ default: m.FeaturePage })))`
- Add nav item in: `src/config/navigation.ts` (if it appears in sidebar/nav)

**New Practice Mode:**
- Mode definition: `src/config/modes.ts` (add to `exerciseModes`, `conversationModes`, or create new array)
- Mode card image: `public/images/modes/{mode-id}.png`

**New Exercise Type:**
- Generation prompt: `src/utils/prompts.ts` (add new prompt function with `tone?: ConversationTone` parameter)
- Exercise logic: `src/components/exercises/ExercisesPage.tsx` (add handling for new type)
- Card type: `src/types/card.ts` (extend `CardType` union)

**New AI Provider:**
- No changes needed in `src/services/openai.ts` -- it delegates to proxy
- Update `detectProvider()` in `src/services/openai.ts` if provider has non-standard model ID patterns
- Provider type: `src/types/settings.ts` (extend `Provider` union)
- Model options: `src/types/settings.ts` (add to model arrays)
- Edge Function: `supabase/functions/ai-proxy/index.ts` (add provider handling)

**New UI Component:**
- Primitive: `src/components/ui/{ComponentName}.tsx`
- Domain-specific widget: `src/components/ui/custom/{ComponentName}.tsx` + export from `index.ts`

**New Database Table:**
- Types: `src/types/supabase.ts` (add interface + TableDefinition + Insert/Update types)
- Storage functions: `src/services/supabase/storage.ts` (add CRUD functions)
- Re-export: `src/services/supabase/index.ts` (add to barrel)
- Runtime state: `src/services/runtimeState.ts` (if state needs in-memory caching)
- Migration: `supabase/migrations/{timestamp}_{description}.sql`

**New Hook:**
- File: `src/hooks/use{FeatureName}.ts`

**New Trail/Path Content:**
- Data: `src/utils/roleplayTrails.ts` (add to `ROLEPLAY_TRAILS` record)
- Theme entry: Add to `THEMES_WITH_TRAILS` array
- Trail images: `public/images/trails/`

**New Error Boundary/Fallback:**
- Component: `src/components/errors/{Name}Fallback.tsx`
- Wire into `src/App.tsx` at appropriate level
- Add test: `src/components/errors/__tests__/{Name}Fallback.test.tsx`

## Special Directories

**`public/images/`:**
- Purpose: Static image assets (mode thumbnails, backgrounds, trail images, theme images)
- Generated: Partially -- some images generated by AI, some are static
- Committed: Yes

**`supabase/migrations/`:**
- Purpose: Database migration SQL files
- Generated: No (hand-written)
- Committed: Yes

**`supabase/functions/ai-proxy/`:**
- Purpose: Deno-based Supabase Edge Function
- Generated: No
- Committed: Yes
- Deployed to: Supabase Edge Functions runtime

**`src/test/`:**
- Purpose: Test setup file (`setup.ts`)
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD workflow planning artifacts
- Contains: Codebase analysis docs, archived milestones (v1.0), active phases, research docs, project config
- Generated: Partially (codebase docs generated by `/gsd:map-codebase`)
- Committed: Yes

**`.planning/milestones/`:**
- Purpose: Archived milestone documentation
- Contains: `v1.0-REQUIREMENTS.md`, `v1.0-ROADMAP.md`, `v1.0-phases/` subdirectory
- Generated: Yes (by GSD workflow)
- Committed: Yes

**`.planning/phases/`:**
- Purpose: Active phase documents for current work
- Currently: Empty (no active phases)
- Generated: Yes (by `/gsd:plan-phase`)
- Committed: Yes

---

*Structure analysis: 2026-04-05*
