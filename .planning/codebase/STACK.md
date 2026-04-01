# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- TypeScript 5.9 - All application source code in `src/`, strict mode enabled

**Secondary:**
- SQL - Supabase database migrations in `supabase/migrations/`
- Deno TypeScript - Supabase Edge Function in `supabase/functions/ai-proxy/index.ts`

## Runtime

**Environment:**
- Browser (SPA) - Vite dev server serves the app; no server-side rendering
- ES2022 target, ESNext modules, `react-jsx` transform

**Package Manager:**
- npm (inferred from `package-lock.json` patterns)
- `"type": "module"` - ESM throughout

## Frameworks

**Core:**
- React 19.2 - UI framework, functional components with hooks
- Vite 6.4 - Build tool and dev server, configured in `vite.config.ts`
- React Router DOM 7.13 - Client-side routing via `BrowserRouter` in `src/App.tsx`

**UI Component Libraries:**
- Radix UI (`@radix-ui/react-slot`, `@radix-ui/react-tooltip`) - Accessible primitives
- Base UI (`@base-ui/react`) - Additional accessible primitives
- Custom UI components in `src/components/ui/` following shadcn/ui patterns (Button, Dialog, Input, etc.)

**Animation:**
- `motion` 12.33 - Framer Motion successor for animations

**CSS:**
- Tailwind CSS 4.1 - Utility-first CSS via `@tailwindcss/vite` plugin
- `tw-animate-css` - Animation utilities for Tailwind
- CSS custom properties for theming in `src/index.css` (light/dark mode via HSL variables)
- `class-variance-authority` (CVA) - Variant-based component styling
- `clsx` + `tailwind-merge` - Conditional class merging via `src/utils/cn.ts`

**Icons:**
- `lucide-react` 0.563 - Icon library

**PDF:**
- `jspdf` 4.2 - PDF generation in `src/components/practice/PracticePage.tsx`

## State Management

**Primary Pattern:**
- React Context - `AuthProvider` in `src/contexts/AuthContext.tsx` for auth state
- Local component state via `useState`/`useEffect`

**Runtime State:**
- Custom singleton in `src/services/runtimeState.ts` - In-memory state hydrated from Supabase on login
- Stores model config, API keys, conversation tone, user context, gamification
- Dispatches custom DOM events (`runtime-state-update`, `gamification-update`) for reactive updates
- API key priority: runtime state (from Supabase encrypted storage) > env vars (`VITE_*_API_KEY`)

**Legacy Fallback:**
- LocalStorage-based storage in `src/services/storage.ts` - Used as fallback when Supabase is unavailable
- Prefix `el_` for localStorage keys

## Routing

**Router:** React Router DOM v7 in `src/App.tsx`

**Route Structure:**
- `/login` - Public login page
- `/migrate` - Migration page (LocalStorage to Supabase)
- `/` - Protected routes wrapped in `Layout`:
  - `/` (index) - DiscoveryPage (main hub)
  - `/review` - ReviewPage (spaced repetition review)
  - `/live` - LiveRoleplayPage (real-time audio conversation)
  - `/paths` - PathsPage (learning paths)
  - `/exercises` - ExercisesPage
  - `/library` - LibraryPage (card library)
  - `/scripts` - PracticePage (script practice)
  - `/practice` - PracticeHubPage
  - `/settings` - SettingsPage (model config, API keys)
  - `/errors` - ErrorDashboard (error analysis)
  - `/history` - HistoryPage (session history)

**Auth Guard:** In dev mode (`import.meta.env.DEV`), auth is skipped entirely; UI renders directly.

## Build Tools

**Bundler:** Vite 6.4 with plugins:
- `@vitejs/plugin-react` - React Fast Refresh
- `@tailwindcss/vite` - Tailwind CSS 4 integration

**Transpiler:** TypeScript 5.9 (type-checking only via `tsc -b`; Vite handles transpilation)

**Linting:** ESLint 9 with flat config in `eslint.config.js`
- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules
- `eslint-plugin-react-hooks` - Hooks rules
- `eslint-plugin-react-refresh` - Vite Fast Refresh rules

**Testing:**
- Vitest 4.0 - Test runner, configured in `vite.config.ts`
- `jsdom` 28 - DOM environment for tests
- `@vitest/coverage-v8` - Code coverage
- Test setup: `src/test/setup.ts`

**Formatting:** No Prettier or Biome detected; relies on ESLint for style enforcement.

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

**Development:**
- Node.js (version compatible with Vite 6.4 and TypeScript 5.9)
- Port 5173 required (Supabase OAuth redirect URL configured for this port)
- `--host` flag needed in devcontainers for external access
- Optional: `.env.local` with Supabase credentials for full-stack dev
- Dev mode works without backend (auth skipped, no Supabase needed)

**Production:**
- Static SPA deployment (Vite build output in `dist/`)
- Requires Supabase remote project for auth and data
- Supabase Edge Function `ai-proxy` must be deployed
- Users configure their own AI API keys (OpenAI, Gemini, Groq) via Settings

---

*Stack analysis: 2026-04-01*
