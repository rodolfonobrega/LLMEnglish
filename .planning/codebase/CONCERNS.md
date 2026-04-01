# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Dual storage layer (localStorage + Supabase):**
- Issue: Two parallel storage implementations exist -- `src/services/storage.ts` (localStorage-based) and `src/services/supabase/storage.ts` (Supabase-based). Both export identical function names (e.g., `getCards`, `saveCards`). The localStorage version is still imported by `src/services/runtimeState.ts` which hydrates from Supabase storage, creating a confusing indirection chain.
- Files: `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/runtimeState.ts`
- Impact: New developers may import from the wrong module. Bug fixes must be applied in two places. The localStorage layer is technically dead code in the Supabase-authenticated path.
- Fix approach: Audit all imports, remove the localStorage `storage.ts` layer, and ensure everything goes through `src/services/supabase/storage.ts` via `src/services/runtimeState.ts`.

**Pronunciation feedback disabled (TODO):**
- Issue: Pronunciation feedback feature is stubbed out with TODO comments across three files. The feature was attempted with Whisper but the phonemic analysis was unreliable.
- Files: `src/utils/prompts.ts` (line 395), `src/types/card.ts` (line 9), `src/components/shared/EvaluationResults.tsx` (line 102)
- Impact: Users cannot receive pronunciation-specific feedback, which is a core value proposition for a language learning app.
- Fix approach: Integrate a dedicated phoneme-level model or service (e.g., Google Speech-to-Text with word-level confidence, or a custom phoneme comparison pipeline).

**Oversized files:**
- Issue: Several files exceed 400 lines, indicating they may have too many responsibilities.
  - `src/services/supabase/storage.ts` (962 lines) -- CRUD for cards, gamification, sessions, paths, reports, model config, user context, API keys
  - `src/services/openai.ts` (803 lines) -- multi-provider dispatch, chat, TTS, STT, image generation
  - `src/components/settings/SettingsPage.tsx` (566 lines) -- settings UI with multiple concerns inline
  - `src/services/errorAnalysis.ts` (532 lines) -- analysis logic
  - `src/utils/migrateToSupabase.ts` (492 lines) -- migration utility (likely one-time use)
- Impact: Harder to navigate, test, and maintain. Higher risk of merge conflicts.
- Fix approach: Split `storage.ts` into domain-specific modules (`cardStorage.ts`, `gamificationStorage.ts`, etc.). Extract provider-specific logic from `openai.ts` into `openaiProvider.ts`, `geminiProvider.ts`, `groqProvider.ts`.

**Sequential card saves (N+1 pattern):**
- Issue: `saveCards` in Supabase storage iterates and calls `updateCard` individually in a `for` loop.
- Files: `src/services/supabase/storage.ts` (lines 98-104)
- Impact: Saving N cards results in N separate database round-trips, plus each `updateCard` call makes 1-2 additional queries (card update + evaluation upsert check). This is O(3N) queries for a bulk save.
- Fix approach: Use Supabase batch insert/upsert with `.upsert()` for cards and evaluations.

**`getCardById` fetches all cards:**
- Issue: `getCardById` calls `getCards()` which fetches ALL cards with joins, then filters client-side with `.find()`.
- Files: `src/services/supabase/storage.ts` (lines 205-208)
- Impact: Fetching a single card loads the entire card collection with all reviews and evaluations.
- Fix approach: Query by ID directly with `.eq('id', id).single()`.

## Known Bugs

**Dev mode bypasses all auth without guard:**
- Symptoms: In `src/App.tsx`, the `ProtectedApp` component checks `import.meta.env.DEV` and renders `DiscoveryPage` directly, skipping the router Layout entirely. This means in dev mode, navigation, sidebar, and all protected routes are inaccessible -- only the discovery page renders.
- Files: `src/App.tsx` (lines 22-28)
- Trigger: Run `npx vite` (dev mode). Any navigation attempt will fail because there is no Layout wrapper.
- Workaround: Manually navigate via URL bar, but Layout/Sidebar won't render.

## Security Considerations

**API keys stored in localStorage:**
- Risk: User-provided API keys (OpenAI, Gemini, Groq) are stored in plaintext in localStorage via `src/services/storage.ts` (lines 167-185). Any XSS vulnerability gives an attacker direct access to all stored API keys.
- Files: `src/services/storage.ts` (lines 163-185), `src/services/runtimeState.ts` (lines 37-41)
- Current mitigation: Supabase storage path encrypts keys before storage via `src/utils/encryption.ts`. The AI proxy edge function (`src/services/supabase/aiProxy.ts`) is the intended secure path.
- Recommendations: Remove direct localStorage key storage. Force all API calls through the Supabase Edge Function proxy. If local keys are needed for development, clearly separate dev-only paths.

**Encryption fallback secret is hardcoded:**
- Risk: `getSessionSecret()` in `src/utils/encryption.ts` (line 190) falls back to the string `'fallback-secret-change-in-production'` if no session token is found. This means encryption is effectively disabled for any unauthenticated session, and any attacker who knows this string can decrypt "encrypted" API keys.
- Files: `src/utils/encryption.ts` (line 190)
- Current mitigation: The session token hash is stored on successful auth, so authenticated users get proper encryption. The fallback only applies pre-auth or when session is missing.
- Recommendations: Throw an error instead of using a fallback. Never encrypt with a known secret.

**Direct API key exposure to client in Gemini Live:**
- Risk: `getGeminiKeyForLive()` in `src/services/supabase/aiProxy.ts` (lines 198-205) fetches the decrypted Gemini API key from the Edge Function and returns it to the client. This is necessary for WebSocket-based Gemini Live, but the raw key exists in client memory.
- Files: `src/services/supabase/aiProxy.ts` (lines 197-205)
- Current mitigation: Only done for Gemini Live which requires a direct WebSocket connection.
- Recommendations: Limit key scope to Gemini Live endpoints only. Consider short-lived tokens if Gemini supports them.

**Vite proxy exposes Groq API:**
- Risk: `vite.config.ts` (lines 36-41) proxies `/api/groq` to `https://api.groq.com/openai/v1` in development. This only works in dev mode (Vite dev server), but the hardcoded path in `src/services/openai.ts` (line 8) `GROQ_BASE = '/api/groq'` is always used for Groq calls.
- Files: `vite.config.ts` (lines 36-41), `src/services/openai.ts` (line 8)
- Current mitigation: In production, Groq calls should go through the Edge Function proxy. The `withFallback` pattern in `aiProxy.ts` handles this.
- Recommendations: Ensure the direct Groq path is never reachable in production builds.

**No input sanitization on user-submitted content:**
- Risk: User prompts, transcriptions, and context strings are passed directly to AI APIs without sanitization. While the AI proxy Edge Function should handle this, there is no client-side validation.
- Files: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Current mitigation: None on the client side.
- Recommendations: Add basic input length limits and character validation on the client. Rely on the Edge Function for proper sanitization.

## Performance Bottlenecks

**No code splitting or lazy loading:**
- Problem: All route components are eagerly imported in `src/App.tsx`. The entire app bundle loads upfront, including heavy dependencies like `jspdf`, `motion`, and multiple AI service clients.
- Files: `src/App.tsx` (lines 1-16)
- Cause: No `React.lazy()` or dynamic imports for route-level components. All 12 page components are in the initial bundle.
- Improvement path: Wrap route elements with `React.lazy()` and `Suspense`. Prioritize lazy-loading `SettingsPage` (566 lines, `jspdf`), `ErrorDashboard`, `HistoryPage`, and `MigrationPage` as they are rarely visited.

**Audio cache in localStorage:**
- Problem: Base64-encoded audio is cached in localStorage as a single JSON object. localStorage has a ~5MB limit per origin.
- Files: `src/services/storage.ts` (lines 207-227)
- Cause: Audio files are large. Even a few cached TTS responses can exhaust localStorage, causing silent failures or data eviction.
- Improvement path: Use IndexedDB (via `idb` package) for audio caching. It supports much larger storage and binary data (Blob/ArrayBuffer) without base64 overhead.

**Full card collection loaded repeatedly:**
- Problem: Several operations (e.g., `getCardById`, `getCardsDueForReview`) trigger full table scans with joins. In `getCardById`, all cards are fetched then filtered client-side.
- Files: `src/services/supabase/storage.ts` (lines 205-208)
- Cause: No targeted queries for single-card lookups.
- Improvement path: Use `.eq('id', id).single()` for single-card queries. Add pagination to `getCards()` with `.range()`.

**Unoptimized re-renders via window events:**
- Problem: `src/services/runtimeState.ts` dispatches `window` events (`runtime-state-update`, `gamification-update`) on every state change, which likely trigger broad re-renders across many components.
- Files: `src/services/runtimeState.ts` (lines 51-56)
- Cause: Custom event-based state propagation instead of targeted React state updates.
- Improvement path: Replace with React context or a lightweight state manager (Zustand, Jotai) that supports selectors for fine-grained subscriptions.

## Scaling Limits

**localStorage as primary storage:**
- Current capacity: ~5MB per origin. Cards with reviews, session reports (capped at 200), gamification state, and audio cache all compete for this space.
- Limit: Heavy users will exhaust localStorage, causing silent data loss (the `setCachedAudio` fallback wipes the entire audio cache on overflow).
- Scaling path: The Supabase migration is in progress (`src/utils/migrateToSupabase.ts`). Once complete, localStorage should only hold ephemeral session data.

**No pagination on card queries:**
- Current capacity: All cards fetched in one query with joins to reviews and evaluations.
- Limit: As card count grows (hundreds+), query latency and payload size will degrade UX.
- Scaling path: Add server-side pagination with cursor-based or offset pagination. Implement virtualized lists in the UI.

## Dependencies at Risk

**@google/genai v1.0.0:**
- Risk: Version `^1.0.0` is a relatively new major version. The Gemini Live WebSocket integration in `src/services/geminiLive.ts` depends on experimental real-time features.
- Impact: Breaking changes in the Google GenAI SDK could break the live roleplay feature.
- Migration plan: Pin the exact version during stability periods. Monitor the SDK changelog.

**react-router-dom v7:**
- Risk: React Router v7 introduced significant API changes (framework mode vs. library mode). The app uses library mode with `BrowserRouter`, which is the simpler path but may lack future optimization support.
- Impact: Migration to future versions may require restructuring route definitions.
- Migration plan: No immediate action needed, but be aware of the v7/v8 transition path.

**No lockfile mentioned in package.json scripts:**
- Risk: The `package-lock.json` or `pnpm-lock.yaml` should be committed to ensure deterministic installs. Its absence from the git status check is worth verifying.
- Impact: Different developers or CI environments may get different dependency versions.

## Missing Critical Features

**No error boundary:**
- Problem: No React Error Boundary component exists in the codebase. Any unhandled runtime error will crash the entire app with a white screen.
- Files: Searched for `ErrorBoundary`, `componentDidCatch` -- zero results.
- Blocks: Graceful error recovery. Users must refresh the page after any component crash.

**No rate limiting on AI calls:**
- Problem: There is no client-side throttling or debouncing for AI API calls. Users can trigger rapid successive calls (e.g., spamming the record button) leading to API rate limit errors and wasted credits.
- Files: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Blocks: Cost control and user experience during rapid interactions.

**No error tracking or monitoring:**
- Problem: No Sentry, LogRocket, or similar error tracking service is configured. Errors are logged to `console.error`/`console.warn` (33 occurrences across 12 files) but are invisible to developers post-deployment.
- Files: Throughout `src/`
- Blocks: Visibility into production issues. Developers won't know about errors users encounter.

**No E2E tests:**
- Problem: No Playwright, Cypress, or similar E2E test framework is configured. Only unit tests exist (6 test files covering services and config).
- Blocks: Confidence in full user flows (login, exercise completion, review cycle).

**No accessibility audit infrastructure:**
- Problem: No axe-core, eslint-plugin-jsx-a11y, or similar tooling. Accessibility attributes (`aria-*`, `role`) are sparse -- only 20 occurrences across 11 of 48 component files.
- Blocks: WCAG compliance. Many interactive elements (cards, buttons, navigation items) lack proper ARIA labels, roles, or keyboard handlers.

## Test Coverage Gaps

**Services are only partially tested:**
- What's not tested: `src/services/supabase/storage.ts` (962 lines, zero tests), `src/services/supabase/auth.ts` (250 lines, zero tests), `src/services/errorAnalysis.ts` (532 lines, zero tests), `src/services/gamification.ts` (zero tests), `src/services/liveSession.ts` (zero tests), `src/services/spacedRepetition.ts` (zero tests).
- Files: `src/services/supabase/storage.ts`, `src/services/supabase/auth.ts`, `src/services/errorAnalysis.ts`
- Risk: Data corruption, auth failures, and spaced repetition bugs could go undetected.
- Priority: High -- `storage.ts` and `auth.ts` are critical paths.

**Zero component tests:**
- What's not tested: All 48 component files in `src/components/` have no corresponding test files. Settings page, exercise flows, live roleplay, review page -- all untested.
- Files: All files in `src/components/`
- Risk: UI regressions from refactoring or dependency upgrades will go undetected.
- Priority: Medium -- start with critical paths: `SettingsPage`, `PracticePage`, `ReviewPage`, `LiveSession`.

**Zero utility tests:**
- What's not tested: `src/utils/encryption.ts` (251 lines), `src/utils/prompts.ts` (452 lines), `src/utils/migrateToSupabase.ts` (492 lines) have no tests.
- Files: `src/utils/encryption.ts`, `src/utils/prompts.ts`
- Risk: Encryption bugs could silently corrupt data. Prompt changes could degrade AI response quality.
- Priority: High for encryption, medium for prompts.

**Low coverage thresholds:**
- What's not tested: `vite.config.ts` sets coverage thresholds at only 35% statements, 25% branches, 30% functions, 40% lines. This only covers 3 service files (`openai.ts`, `geminiLive.ts`, `openaiRealtimeLive.ts`).
- Files: `vite.config.ts` (lines 19-33)
- Risk: Low bar allows significant untested code.
- Priority: Medium -- gradually raise thresholds as more tests are added.

## Fragile Areas

**Runtime state module with global mutable state:**
- Files: `src/services/runtimeState.ts`
- Why fragile: Uses a module-level `let state` variable that is mutated in place. Multiple concurrent updates (e.g., hydrating from Supabase while user changes settings) could race. The `window` event dispatch pattern is not tied to React's rendering cycle.
- Safe modification: Always call setters, never mutate `state` directly. Ensure `hydrateRuntimeState` completes before allowing user interactions.
- Test coverage: Zero tests.

**Migration utility:**
- Files: `src/utils/migrateToSupabase.ts` (492 lines)
- Why fragile: One-time migration code that converts localStorage data to Supabase. Contains complex data mapping logic with no tests. If it fails partway, users could lose data.
- Safe modification: Do not modify after migration is complete. Add tests before any changes.
- Test coverage: Zero tests.

**Protected route guard:**
- Files: `src/App.tsx` (lines 18-47)
- Why fragile: The `ProtectedApp` component has special dev-mode behavior that bypasses auth entirely AND skips the Layout wrapper. This means protected routes like `/review`, `/live`, `/settings` are unreachable in dev mode because Layout is never rendered.
- Safe modification: Fix the dev mode path to include Layout wrapping.
- Test coverage: Zero tests.

## Developer Experience Pain Points

**Dev mode routing is broken:**
- Issue: In dev mode (`npx vite`), `ProtectedApp` renders `DiscoveryPage` without the `Layout` wrapper. This means no sidebar, no navigation. Developers must manually type URLs to reach other pages, and even then the Layout won't render.
- Files: `src/App.tsx` (lines 22-28)
- Recommendation: In dev mode, render the same `Layout` + `Routes` structure but with a mock user, so all pages are navigable.

**Console noise:**
- Issue: 33 console statements across 12 files. `src/contexts/AuthContext.tsx` alone has 4 (including a `console.log` on every auth state change). This clutters the dev console and makes debugging harder.
- Files: `src/contexts/AuthContext.tsx` (line 118 -- logs every auth event)
- Recommendation: Replace `console.log` with a debug-level logger that can be toggled off. Use `console.warn`/`console.error` sparingly for genuine issues.

**No type-safe environment variables:**
- Issue: Environment variables are accessed via `import.meta.env.VITE_*` as untyped strings throughout the codebase. No validation schema exists.
- Files: `src/services/runtimeState.ts` (lines 37-41), `vite.config.ts` (comments listing env vars)
- Recommendation: Create an `env.ts` module that validates required env vars at startup and exports typed constants.

---

*Concerns audit: 2026-04-01*
