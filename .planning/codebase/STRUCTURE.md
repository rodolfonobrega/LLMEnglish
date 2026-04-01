# Codebase Structure

**Analysis Date:** 2026-04-01

## Directory Layout

```
LLMEnglish/                       # Project root
├── src/                          # Application source code
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component with routing
│   ├── index.css                 # Global styles (Tailwind)
│   ├── vite-env.d.ts             # Vite type declarations
│   ├── components/               # React components organized by domain
│   │   ├── auth/                 # Authentication pages
│   │   ├── discovery/            # Home/discovery page
│   │   ├── errors/               # Error analytics dashboard
│   │   ├── exercises/            # Exercise practice pages
│   │   ├── history/              # Session history
│   │   ├── layout/               # App shell (header, sidebar, nav)
│   │   ├── library/              # Card library browser
│   │   ├── live-roleplay/        # Live audio roleplay feature
│   │   ├── paths/                # Learning trails/paths
│   │   ├── practice/             # Practice hub and script mode
│   │   ├── review/               # Spaced repetition review
│   │   ├── settings/             # User settings
│   │   ├── shared/               # Cross-feature shared components
│   │   └── ui/                   # Primitive UI components + custom domain widgets
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
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite + Vitest configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript root config
├── tsconfig.app.json             # TypeScript app config
├── tsconfig.node.json            # TypeScript node config
├── eslint.config.js              # ESLint flat config
└── CLAUDE.md                     # AI assistant instructions
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
- Purpose: Error analytics dashboard
- Contains: `ErrorDashboard.tsx`
- Key files: `ErrorDashboard.tsx` -- Displays error patterns, trends, and weak areas

**`src/components/exercises/`:**
- Purpose: Exercise practice flow
- Contains: `ExercisesPage.tsx`
- Key files: `ExercisesPage.tsx` -- Handles phrase/text/situation/image exercise generation, recording, evaluation

**`src/components/history/`:**
- Purpose: Session history view
- Contains: `HistoryPage.tsx`

**`src/components/layout/`:**
- Purpose: Application shell and navigation
- Contains: `Layout.tsx`, `Header.tsx`, `Sidebar.tsx`, `Navigation.tsx`
- Key files: `Layout.tsx` -- Wraps all authenticated routes with Header, Sidebar (desktop), Navigation (mobile), and `<Outlet />`

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
- Contains: `PracticeHubPage.tsx`, `PracticePage.tsx`

**`src/components/review/`:**
- Purpose: Spaced repetition review session
- Contains: `ReviewPage.tsx`

**`src/components/settings/`:**
- Purpose: User settings (model config, API keys, profile)
- Contains: `SettingsPage.tsx`

**`src/components/shared/`:**
- Purpose: Cross-feature reusable components
- Contains: `AudioRecorder.tsx`, `EvaluationResults.tsx`, `FeedbackPanel.tsx`, `ModeCard.tsx`, `ModeTooltip.tsx`, `ScoreDisplay.tsx`, `SelectionDot.tsx`, `ThemeSelector.tsx`

**`src/components/ui/`:**
- Purpose: Primitive UI building blocks (design system)
- Contains: `AlertDialog.tsx`, `Badge.tsx`, `Button.tsx`, `card.tsx`, `Dialog.tsx`, `Input.tsx`, `Select.tsx`, `Skeleton.tsx`, `Textarea.tsx`, `Tooltip.tsx`
- Key files: These are generic, reusable primitives (similar to shadcn/ui pattern)

**`src/components/ui/custom/`:**
- Purpose: Domain-specific composite UI widgets
- Contains: `ExerciseCard.tsx`, `MicrophoneButton.tsx`, `PathCard.tsx`, `ProgressBar.tsx`, `WordChip.tsx`, `XPBadge.tsx`, `index.ts`
- Key files: `index.ts` -- barrel export for all custom widgets

**`src/config/`:**
- Purpose: Static configuration and mode definitions
- Contains: `navigation.ts`, `modes.ts`, `practice.ts`, `images.ts`, `README.md`
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
- Key files: `openai.ts` -- Multi-provider AI dispatcher (chat, STT, TTS, image); `runtimeState.ts` -- In-memory singleton state; `gamification.ts` -- XP/level/streak/badge logic

**`src/services/supabase/`:**
- Purpose: Supabase-specific client, auth, storage, and AI proxy
- Contains: `client.ts`, `auth.ts`, `storage.ts`, `aiProxy.ts`, `index.ts`
- Key files: `client.ts` -- Singleton Supabase client with Proxy for lazy init; `storage.ts` -- Full CRUD for all Supabase tables; `aiProxy.ts` -- Edge Function client for proxied AI calls and key management; `index.ts` -- Barrel re-export of all Supabase services

**`src/types/`:**
- Purpose: TypeScript type definitions
- Contains: `card.ts`, `scenario.ts`, `gamification.ts`, `settings.ts`, `review.ts`, `errors.ts`, `supabase.ts`
- Key files: `supabase.ts` -- Full database schema types (Database interface with all tables); `card.ts` -- Card and EvaluationResult types; `settings.ts` -- ModelConfig, UserContext, and all model/voice option lists

**`src/utils/`:**
- Purpose: Pure utility functions and static data
- Contains: `cn.ts`, `cleanJson.ts`, `audio.ts`, `encryption.ts`, `prompts.ts`, `roleplayTrails.ts`, `migrateToSupabase.ts`
- Key files: `prompts.ts` -- All AI system/user prompts for exercise generation, evaluation, live roleplay, conversation analysis; `roleplayTrails.ts` -- Trail/step definitions for guided learning paths; `cn.ts` -- Tailwind class merge utility

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, loads `src/main.tsx`, includes theme flash prevention script
- `src/main.tsx`: React root creation, renders `<App />`
- `src/App.tsx`: BrowserRouter setup, AuthProvider, all route definitions

**Routing:**
- `src/App.tsx`: All routes defined inline (React Router v6)

**Configuration:**
- `vite.config.ts`: Vite build config with Tailwind plugin, Vitest setup, Groq proxy
- `src/config/navigation.ts`: Primary nav items (Início, Praticar, Biblioteca, etc.)
- `src/config/modes.ts`: Practice mode definitions with routes and metadata
- `src/config/images.ts`: Image generation parameters per context and provider

**Core Logic (Services):**
- `src/services/runtimeState.ts`: In-memory singleton state with event emission
- `src/services/openai.ts`: Multi-provider AI dispatcher (chat, STT, TTS, image generation)
- `src/services/supabase/client.ts`: Supabase singleton client with lazy Proxy
- `src/services/supabase/storage.ts`: Full CRUD for all Supabase tables (cards, gamification, sessions, etc.)
- `src/services/supabase/aiProxy.ts`: Edge Function client for proxied AI calls
- `src/services/supabase/auth.ts`: OAuth sign-in/sign-out, session, profile management
- `src/services/gamification.ts`: XP, leveling, streaks, badge awarding
- `src/services/errorAnalysis.ts`: Error pattern extraction, tracking, analytics
- `src/services/geminiLive.ts`: Gemini Live API WebSocket session class
- `src/services/liveSession.ts`: `ILiveSession` interface and callback types

**Types:**
- `src/types/supabase.ts`: Full database schema types
- `src/types/card.ts`: Card, EvaluationResult, ReviewEntry
- `src/types/scenario.ts`: LiveScenario, LiveSession, RoleplayTrail, PathProgress
- `src/types/settings.ts`: ModelConfig, UserContext, all model/voice option arrays

**Prompts:**
- `src/utils/prompts.ts`: All AI prompts for exercise generation, evaluation, live roleplay, conversation analysis, tutor explanations, custom dialogues

**Backend:**
- `supabase/functions/ai-proxy/index.ts`: Edge Function (743 lines) -- AI proxy, API key encryption/decryption
- `supabase/migrations/20260324221155_initial_schema.sql`: Initial database schema

## Route Map

| Path | Component | Guard | Description |
|------|-----------|-------|-------------|
| `/login` | `LoginPage` | Public | OAuth login (Google/GitHub) |
| `/migrate` | `MigrationPage` | Public | Data migration from localStorage to Supabase |
| `/` | `DiscoveryPage` | ProtectedApp (auth check) | Home/dashboard with practice modes |
| `/practice` | `PracticeHubPage` | Layout wrapper | Practice mode selector hub |
| `/exercises` | `ExercisesPage` | Layout wrapper | Exercise flow (phrases, texts, situations, visual) |
| `/scripts` | `PracticePage` | Layout wrapper | Script reading/acting mode |
| `/live` | `LiveRoleplayPage` | Layout wrapper | Live audio roleplay |
| `/paths` | `PathsPage` | Layout wrapper | Learning trails |
| `/library` | `LibraryPage` | Layout wrapper | Card library browser |
| `/review` | `ReviewPage` | Layout wrapper | Spaced repetition review |
| `/errors` | `ErrorDashboard` | Layout wrapper | Error analytics |
| `/history` | `HistoryPage` | Layout wrapper | Session history |
| `/settings` | `SettingsPage` | Layout wrapper | Model config, API keys, profile |

**Route structure:** Public routes (`/login`, `/migrate`) render standalone. All other routes nest under `<Layout />` which provides Header, Sidebar (desktop), Navigation (mobile). The `ProtectedApp` component at `/` checks auth state but dev mode (`import.meta.env.DEV`) bypasses auth entirely.

## Naming Conventions

**Files:**
- Components: PascalCase `.tsx` (e.g., `DiscoveryPage.tsx`, `ModeCard.tsx`)
- Services: camelCase `.ts` (e.g., `gamification.ts`, `errorAnalysis.ts`)
- Hooks: camelCase with `use` prefix `.ts` (e.g., `useAudioRecorder.ts`, `useTTS.ts`)
- Types: camelCase `.ts` (e.g., `card.ts`, `scenario.ts`, `supabase.ts`)
- Utils: camelCase `.ts` (e.g., `cleanJson.ts`, `roleplayTrails.ts`)
- Config: camelCase `.ts` (e.g., `navigation.ts`, `modes.ts`)
- Tests: `.test.ts` suffix co-located with source (e.g., `modes.test.ts`, `openai.test.ts`)
- UI primitives: PascalCase `.tsx` in `components/ui/` (e.g., `Button.tsx`, `Dialog.tsx`)
- Barrel exports: `index.ts` (e.g., `components/ui/custom/index.ts`, `services/supabase/index.ts`)

**Components:**
- Named exports only (no default exports except `App`)
- Page components suffixed with `Page` (e.g., `DiscoveryPage`, `SettingsPage`)

## Where to Add New Code

**New Page/Route:**
- Component: `src/components/{feature}/{FeatureName}Page.tsx`
- Add route in: `src/App.tsx` inside the `<Route path="/" element={<Layout />}>` block
- Add nav item in: `src/config/navigation.ts` (if it appears in sidebar/nav)

**New Practice Mode:**
- Mode definition: `src/config/modes.ts` (add to `exerciseModes`, `conversationModes`, or create new array)
- Mode card image: `public/images/modes/{mode-id}.png`

**New Exercise Type:**
- Generation prompt: `src/utils/prompts.ts` (add new prompt function)
- Exercise logic: `src/components/exercises/ExercisesPage.tsx` (add handling for new type)
- Card type: `src/types/card.ts` (extend `CardType` union)

**New AI Provider:**
- Service functions: `src/services/openai.ts` (add provider-specific functions + dispatch logic)
- Provider type: `src/types/settings.ts` (extend `Provider` union)
- Model options: `src/types/settings.ts` (add to model arrays)

**New UI Component:**
- Primitive: `src/components/ui/{ComponentName}.tsx`
- Domain-specific widget: `src/components/ui/custom/{ComponentName}.tsx` + export from `index.ts`

**New Database Table:**
- Types: `src/types/supabase.ts` (add interface + TableDefinition + Insert/Update types)
- Storage functions: `src/services/supabase/storage.ts` (add CRUD functions)
- Re-export: `src/services/supabase/index.ts` (add to barrel)
- Migration: `supabase/migrations/{timestamp}_{description}.sql`

**New Hook:**
- File: `src/hooks/use{FeatureName}.ts`

**New Trail/Path Content:**
- Data: `src/utils/roleplayTrails.ts` (add to `ROLEPLAY_TRAILS` record)
- Theme entry: Add to `THEMES_WITH_TRAILS` array
- Trail images: `public/images/trails/`

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

---

*Structure analysis: 2026-04-01*
