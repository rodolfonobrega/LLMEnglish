# Codebase Concerns

**Analysis Date:** 2026-04-05

## Tech Debt

**Dual storage layer (localStorage + Supabase):**
- Issue: Two parallel storage implementations exist -- `src/services/storage.ts` (facade/dev-mode wrapper) and `src/services/supabase/storage.ts` (Supabase-based). `storage.ts` now acts as a facade that reads runtime state for sync access and delegates to Supabase for async writes, but the indirection chain remains confusing.
- Files: `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/runtimeState.ts`
- Impact: New developers may import from the wrong module. Bug fixes must be applied in two places. The facade pattern adds indirection without clear benefit now that all calls are proxy-first.
- Fix approach: Audit all imports of `src/services/storage.ts` and migrate callers to use `src/services/runtimeState.ts` (for reads) and `src/services/supabase/storage.ts` (for writes) directly. Remove the facade.

**Pronunciation feedback disabled (TODO):**
- Issue: Pronunciation feedback feature is stubbed out with TODO comments across three files. The feature was attempted with Whisper but the phonemic analysis was unreliable.
- Files: `src/utils/prompts.ts` (line 391), `src/types/card.ts` (line 9), `src/components/shared/EvaluationResults.tsx` (line 102)
- Impact: Users cannot receive pronunciation-specific feedback, which is a core value proposition for a language learning app.
- Fix approach: Integrate a dedicated phoneme-level model or service (e.g., Google Speech-to-Text with word-level confidence, or a custom phoneme comparison pipeline).

**Oversized files:**
- Issue: Several files exceed 400 lines, indicating they may have too many responsibilities.
  - `src/services/supabase/storage.ts` (916 lines) -- CRUD for cards, gamification, sessions, paths, reports, model config, conversation tone, API keys
  - `src/services/errorAnalysis.ts` (532 lines) -- analysis logic
  - `src/components/settings/SettingsPage.tsx` (515 lines) -- settings UI with multiple concerns inline
  - `src/utils/migrateToSupabase.ts` (462 lines) -- migration utility (likely one-time use)
  - `src/utils/prompts.ts` (438 lines) -- all prompt functions (growing with each new prompt)
- Impact: Harder to navigate, test, and maintain. Higher risk of merge conflicts.
- Fix approach: Split `storage.ts` into domain-specific modules (`cardStorage.ts`, `gamificationStorage.ts`, etc.). Split `prompts.ts` into `exercisePrompts.ts`, `roleplayPrompts.ts`, `evaluationPrompts.ts`. Extract provider-specific logic from error analysis into separate modules.

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

**Dev mode bypasses all auth without Layout wrapping:**
- Symptoms: In `src/App.tsx`, the `ProtectedApp` component checks `useAuth()` and renders `<DiscoveryPage />` directly when user exists, but if there is no user in dev mode, it redirects to `/login`. The dev mode auto-login behavior that previously existed has been removed. In dev mode without Supabase, users are stuck at `/login`.
- Files: `src/App.tsx` (lines 45-65)
- Trigger: Run `npx vite` (dev mode) without `.env.local` / Supabase. The `ProtectedApp` redirects to `/login` but login requires Supabase which is unavailable.
- Workaround: Need `.env.local` with valid Supabase credentials, or a mock auth provider for dev mode.

## Security Considerations

**API keys routed through Edge Function proxy:**
- Status: RESOLVED. All AI calls now route through `src/services/supabase/aiProxy.ts` which calls the Supabase Edge Function. API keys are not exposed client-side. `src/services/openai.ts` (174 lines) is now a thin orchestrator that delegates entirely to the proxy.
- Files: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Remaining risk: The Gemini Live feature still requires `getGeminiKeyForLive()` which fetches the decrypted key for WebSocket connections.

**Encryption fallback secret is hardcoded:**
- Risk: `getSessionSecret()` in `src/utils/encryption.ts` falls back to the string `'fallback-secret-change-in-production'` if no session token is found. This means encryption is effectively disabled for any unauthenticated session, and any attacker who knows this string can decrypt "encrypted" API keys.
- Files: `src/utils/encryption.ts` (line 190)
- Current mitigation: The session token hash is stored on successful auth, so authenticated users get proper encryption. The fallback only applies pre-auth or when session is missing.
- Recommendations: Throw an error instead of using a fallback. Never encrypt with a known secret.

**Direct API key exposure to client in Gemini Live:**
- Risk: `getGeminiKeyForLive()` in `src/services/supabase/aiProxy.ts` fetches the decrypted Gemini API key from the Edge Function and returns it to the client. This is necessary for WebSocket-based Gemini Live, but the raw key exists in client memory.
- Files: `src/services/supabase/aiProxy.ts`
- Current mitigation: Only done for Gemini Live which requires a direct WebSocket connection.
- Recommendations: Limit key scope to Gemini Live endpoints only. Consider short-lived tokens if Gemini supports them.

**No input sanitization on user-submitted content:**
- Risk: User prompts, transcriptions, and context strings are passed directly to AI APIs without sanitization. While the AI proxy Edge Function should handle this, there is no client-side validation.
- Files: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Current mitigation: None on the client side.
- Recommendations: Add basic input length limits and character validation on the client. Rely on the Edge Function for proper sanitization.

## Performance Bottlenecks

**No Suspense loading states for lazy routes:**
- Problem: All route components are lazy-loaded via `React.lazy()` in `src/App.tsx`, but there is no `<Suspense>` wrapper visible at the route level. The lazy loading may cause unhandled loading states.
- Files: `src/App.tsx` (lines 11-43)
- Cause: `React.lazy()` requires a `<Suspense>` boundary to show loading UI while the chunk loads. If not present, the app may show a blank screen during chunk loading.
- Improvement path: Add a `<Suspense fallback={<PageSkeleton />}>` wrapper around the `<Routes>` or at the `<Layout>` level.

**Audio cache in localStorage:**
- Problem: Base64-encoded audio is cached in localStorage as a single JSON object. localStorage has a ~5MB limit per origin.
- Files: `src/services/storage.ts`
- Cause: Audio files are large. Even a few cached TTS responses can exhaust localStorage, causing silent failures or data eviction.
- Improvement path: Use IndexedDB (via `idb` package) for audio caching. It supports much larger storage and binary data (Blob/ArrayBuffer) without base64 overhead.

**Full card collection loaded repeatedly:**
- Problem: Several operations (e.g., `getCardById`, `getCardsDueForReview`) trigger full table scans with joins. In `getCardById`, all cards are fetched then filtered client-side.
- Files: `src/services/supabase/storage.ts`
- Cause: No targeted queries for single-card lookups.
- Improvement path: Use `.eq('id', id).single()` for single-card queries. Add pagination to `getCards()` with `.range()`.

**Unoptimized re-renders via window events:**
- Problem: `src/services/runtimeState.ts` dispatches `window` events (`runtime-state-update`, `gamification-update`) on every state change, which likely trigger broad re-renders across many components.
- Files: `src/services/runtimeState.ts` (lines 41-46)
- Cause: Custom event-based state propagation instead of targeted React state updates.
- Improvement path: Replace with React context or a lightweight state manager (Zustand, Jotai) that supports selectors for fine-grained subscriptions.

## Scaling Limits

**localStorage as fallback storage:**
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

**react-error-boundary:**
- Risk: Third-party error boundary library added as a dependency. React does not provide a built-in error boundary hook for function components.
- Impact: If the library stops being maintained, error handling would need a custom class component boundary.
- Migration plan: Low risk -- the library is well-established. Consider extracting a custom `ErrorBoundary` class component if needed.

## Missing Critical Features

**No rate limiting on AI calls:**
- Problem: There is no client-side throttling or debouncing for AI API calls. Users can trigger rapid successive calls (e.g., spamming the record button) leading to API rate limit errors and wasted credits.
- Files: `src/services/openai.ts`, `src/services/supabase/aiProxy.ts`
- Blocks: Cost control and user experience during rapid interactions.

**No error tracking or monitoring:**
- Problem: No Sentry, LogRocket, or similar error tracking service is configured. Errors are logged to `console.error`/`console.warn` but are invisible to developers post-deployment.
- Files: Throughout `src/`
- Blocks: Visibility into production issues. Developers won't know about errors users encounter.

**No E2E tests:**
- Problem: No Playwright, Cypress, or similar E2E test framework is configured. Unit/component tests exist (12 test files) but no full-flow tests.
- Blocks: Confidence in full user flows (login, exercise completion, review cycle).

**No accessibility audit infrastructure:**
- Problem: No axe-core, eslint-plugin-jsx-a11y, or similar tooling. Accessibility attributes (`aria-*`, `role`) are sparse across component files.
- Blocks: WCAG compliance. Many interactive elements (cards, buttons, navigation items) lack proper ARIA labels, roles, or keyboard handlers.

## Test Coverage Gaps

**Services are only partially tested:**
- What's not tested: `src/services/supabase/storage.ts` (916 lines, zero tests), `src/services/supabase/auth.ts` (zero tests), `src/services/errorAnalysis.ts` (532 lines, zero tests), `src/services/gamification.ts` (zero tests), `src/services/liveSession.ts` (zero tests), `src/services/spacedRepetition.ts` (zero tests).
- Files: `src/services/supabase/storage.ts`, `src/services/supabase/auth.ts`, `src/services/errorAnalysis.ts`
- Risk: Data corruption, auth failures, and spaced repetition bugs could go undetected.
- Priority: High -- `storage.ts` and `auth.ts` are critical paths.

**Component tests are limited:**
- What is tested: Error fallback components (`AppErrorFallback`, `ErrorFallback`, `ChunkErrorFallback`), `PracticeHubPage`, `PracticeModeCard`
- What's not tested: Settings page, exercise flows, live roleplay, review page, discovery page, library page, history page -- all untested.
- Files: Most files in `src/components/`
- Risk: UI regressions from refactoring or dependency upgrades will go undetected.
- Priority: Medium -- start with critical paths: `SettingsPage`, `ExercisesPage`, `ReviewPage`, `LiveSession`.

**Zero utility tests:**
- What's not tested: `src/utils/encryption.ts` (251 lines), `src/utils/prompts.ts` (438 lines), `src/utils/migrateToSupabase.ts` (462 lines) have no tests.
- Files: `src/utils/encryption.ts`, `src/utils/prompts.ts`
- Risk: Encryption bugs could silently corrupt data. Prompt changes could degrade AI response quality.
- Priority: High for encryption, medium for prompts.

**Low coverage thresholds:**
- What's not tested: `vite.config.ts` sets coverage thresholds at only 35% statements, 25% branches, 30% functions, 40% lines. This only covers 3 service files (`openai.ts`, `geminiLive.ts`, `openaiRealtimeLive.ts`).
- Files: `vite.config.ts`
- Risk: Low bar allows significant untested code.
- Priority: Medium -- gradually raise thresholds as more tests are added.

## Fragile Areas

**Runtime state module with global mutable state:**
- Files: `src/services/runtimeState.ts` (121 lines)
- Why fragile: Uses a module-level `let state` variable that is mutated in place. Multiple concurrent updates (e.g., hydrating from Supabase while user changes settings) could race. The `window` event dispatch pattern is not tied to React's rendering cycle.
- Safe modification: Always call setters, never mutate `state` directly. Ensure `hydrateRuntimeState` completes before allowing user interactions.
- Test coverage: Zero tests.

**Migration utility:**
- Files: `src/utils/migrateToSupabase.ts` (462 lines)
- Why fragile: One-time migration code that converts localStorage data to Supabase. Contains complex data mapping logic with no tests. If it fails partway, users could lose data.
- Safe modification: Do not modify after migration is complete. Add tests before any changes.
- Test coverage: Zero tests.

**Protected route guard (dev mode):**
- Files: `src/App.tsx` (lines 45-65)
- Why fragile: The `ProtectedApp` component no longer has special dev-mode behavior. It relies on `useAuth()` which requires Supabase. Without Supabase in dev mode, users are redirected to `/login` which also requires Supabase.
- Safe modification: Add a dev-mode mock user path or ensure `.env.local` is always present during development.
- Test coverage: Zero tests.

## Developer Experience Pain Points

**Dev mode requires Supabase credentials:**
- Issue: The previous dev-mode bypass was removed. Running `npx vite` without `.env.local` with valid Supabase credentials results in being stuck on `/login` which cannot complete without Supabase.
- Files: `src/App.tsx` (lines 45-65), `src/contexts/AuthContext.tsx`
- Recommendation: Either restore a dev-mode bypass with a mock user, or clearly document that `.env.local` with Supabase credentials is required for all development.

**Console noise:**
- Issue: Console statements across multiple files. `src/contexts/AuthContext.tsx` logs every auth state change. Error fallbacks log errors. This clutters the dev console.
- Files: `src/contexts/AuthContext.tsx`, `src/components/errors/AppErrorFallback.tsx`, `src/components/errors/ErrorFallback.tsx`
- Recommendation: Replace `console.log` with a debug-level logger that can be toggled off. Use `console.warn`/`console.error` sparingly for genuine issues.

**No type-safe environment variables:**
- Issue: Environment variables are accessed via `import.meta.env.VITE_*` as untyped strings throughout the codebase. No validation schema exists.
- Files: `src/services/runtimeState.ts` (lines 28-32), `vite.config.ts`
- Recommendation: Create an `env.ts` module that validates required env vars at startup and exports typed constants.

**Prompt file growing unbounded:**
- Issue: `src/utils/prompts.ts` is 438 lines and growing. Every new prompt type, exercise mode, or AI interaction adds to this single file. All prompt functions now accept `tone?: ConversationTone` which adds repetitive tone instruction injection.
- Files: `src/utils/prompts.ts`
- Recommendation: Split into domain-specific prompt files (`exercisePrompts.ts`, `roleplayPrompts.ts`, `evaluationPrompts.ts`). Consider a `buildPrompt()` helper that automatically prepends `getToneInstruction(tone)`.

---

*Concerns audit: 2026-04-05*
