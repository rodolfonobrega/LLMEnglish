# Feature Landscape

**Domain:** React 19 SPA hardening and UI redesign for an English learning app
**Researched:** 2026-04-01

## Table Stakes

Features users expect in a well-hardened SPA. Missing = app feels broken or unreliable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Route-level Error Boundaries | Any component crash currently whitescreens the entire app. Users lose all navigation. Other pages remain usable if boundaries isolate failures. | Low | Currently zero error boundaries exist. Each route in App.tsx needs its own boundary. Use `react-error-boundary` (community standard, works with React 19 functional components). |
| Error fallback UI with retry | A broken page must show something actionable, not a blank screen. Users need to know what happened and how to recover. | Low | Fallback component with: error message, "Try Again" button (calls resetErrorBoundary), and "Go Home" link. Match existing design tokens (card, rounded-2xl, text-muted-foreground). |
| Route-based code splitting | All 12 page components are eagerly loaded. `jspdf` (~200KB) and `motion` (~80KB) are imported even for users who never visit those pages. Fast initial load is table stakes. | Low-Med | React.lazy + Suspense at route level. Vite automatically code-splits dynamic imports. Wrap each `<Route element={...}>` with Suspense. Heavy targets: LiveRoleplayPage (websocket deps), LibraryPage (jspdf for PDF export), PathsPage (motion animations). |
| Loading state for lazy routes | When a chunk is being fetched (slow network, cold cache), users need visual feedback, not a blank screen. | Low | Skeleton loader matching the page layout shape. Reuse existing `Skeleton` component from `src/components/ui/Skeleton.tsx`. Spinner fallback already exists in App.tsx (line 32-36). |
| Encrypted API key storage at rest | Keys currently stored plaintext in localStorage (`el_openai_key`, `el_gemini_key`, `el_groq_key` in storage.ts). Anyone opening DevTools sees them. Basic protection is expected. | Medium | Encryption utilities already exist in `src/utils/encryption.ts` (AES-256-GCM, PBKDF2 key derivation). The problem: `getSessionSecret()` on line 186 falls back to hardcoded `'fallback-secret-change-in-production'`. Fix: derive secret from Supabase session token (already partially implemented via `storeSessionToken`). Remove plaintext localStorage path entirely. |
| Chunk load failure recovery | When a user is offline or a CDN fails, dynamic import throws. Error boundary must catch this and offer retry. | Low | Error boundary around Suspense boundary catches chunk load failures. Retry button triggers re-import. Separate from general render errors. |
| Global unhandled error capture | Promise rejections and async errors are NOT caught by Error Boundaries. Without a global handler, these fail silently. | Low | `window.addEventListener('unhandledrejection', ...)` at app root. Log to console (future: external monitoring). Show a toast or inline message. |
| Consistent card design across hub pages | The Praticar page uses horizontal `ModeCard` while Trilhas uses vertical `PathCard` with image banner. Visual inconsistency between hub pages feels unfinished. | Low-Med | Redesign ModeCard or create new component for Praticar page: vertical cards with h-24 to h-28 image banner (shorter than PathCard's h-32 to maintain visual distinction). Reuse existing image paths from `config/modes.ts`. |

## Differentiators

Features that elevate the app from "works" to "feels premium." Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Preload-on-hover for route chunks | When a user hovers a practice mode card, the target route chunk starts loading. Near-instant navigation on click. Noticeable speed improvement. | Low | Attach `onMouseEnter` to ModeCard/PathCard that calls `import('./path/to/Page')`. Cache the promise. React.lazy resolves instantly on actual navigation. |
| Skeleton placeholders matching page layout | Instead of a generic spinner, show gray rectangles matching the target page structure (header, cards, sidebar). Creates perception of faster load. | Medium | Create per-route skeleton components. `PracticeHubPage` skeleton = section headers + 3 card shapes. `PathsPage` skeleton = grid of card shapes with image areas. |
| Storage layer unification (localStorage + Supabase) | Two parallel storage services exist (`services/storage.ts` for localStorage, `services/supabase/storage.ts` for Supabase) with identical function signatures. Import confusion causes subtle bugs. Unifying eliminates an entire class of errors. | High | The Supabase layer is already feature-complete. The localStorage layer is used directly in storage.ts and through runtimeState.ts. Strategy: make Supabase storage the single source, keep localStorage only as offline cache/fallback. Requires updating all import sites. |
| Session-aware key encryption | Current encryption derives keys from `userId + sessionSecret`, but the session secret fallback is hardcoded. Making it truly session-bound means keys are only decryptable during an active session. | Medium | After Supabase auth, hash the access_token and use it as the PBKDF2 secret. On logout, clear the derived key from memory. Existing `storeSessionToken()` already does the hashing part. Wire it into the auth flow properly and remove the fallback. |
| Smooth route transition animations | Animated page transitions when navigating between routes. Makes the SPA feel native-app-like. | Medium | Requires motion library (already imported). Wrap route outlet with AnimatePresence + motion.div. Keep subtle (fade + slight slide, 200ms). Must not conflict with existing card animations. |
| Offline resilience indicator | Detect when navigator.onLine is false and show a subtle banner. Prevent destructive actions (saving to Supabase) and queue them. | Medium | `window.addEventListener('online'/'offline')`. Show non-intrusive banner. Queue writes to localStorage, replay when back online. Adds resilience without full PWA conversion. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Server-side key management / proxy for all API calls | Full backend proxy would require rewriting all AI service calls. Out of scope for a client-side hardening milestone. The app is designed for user-provided keys. | Encrypt at rest on the client. The current Edge Function approach for Supabase storage is sufficient. Focus on removing the hardcoded fallback secret. |
| Full PWA / Service Worker | Offline-first architecture is a fundamentally different app model. Too broad for this milestone. IndexedDB caching, background sync, install prompts are separate milestone territory. | Focus on chunk caching (Vite does this) and a simple online/offline indicator. |
| External error monitoring (Sentry, Datadog) | Requires account setup, billing, and privacy considerations. Not a client-side code concern. | Log errors to console with structured data. Add a global unhandled rejection handler. Monitoring integration can be a future milestone. |
| Component-level error boundaries (every widget) | Wrapping every small component is over-engineering. Makes debugging harder. Too many fallback UIs create visual chaos. | Route-level boundaries only. One boundary per route page. One app-level boundary as last resort. Feature-level only for isolated widgets (e.g., the audio recorder). |
| Heavy state management library (Redux, Zustand) | The app uses React Context + singleton module (runtimeState). It works for the current scale. Adding a state management library is a refactor, not a hardening. | Keep the existing pattern. Consolidate the dual storage layer instead. |
| Full accessibility audit and remediation | Flagged as out of scope in PROJECT.md. Too broad, would dominate the milestone. | Ensure new components (error fallbacks, card redesign) use semantic HTML and keyboard support. No more than that. |
| Key rotation UX (automatic expiration prompts) | API keys from providers (OpenAI, Gemini, Groq) don't expire on a schedule. Users manage their own keys. Adding rotation prompts is unnecessary complexity. | Handle key validation errors gracefully (show "invalid key" message in Settings). That's sufficient. |
| IndexedDB migration for large datasets | The dual-storage problem is about architecture, not storage limits. localStorage handles current data volumes fine for a learning app. | Unify to Supabase as primary. Keep localStorage as transient cache. Don't add IndexedDB as a third storage layer. |

## Feature Dependencies

```
Route-level Error Boundaries
  -> Error fallback UI with retry (fallback component is required by boundary)
  -> Chunk load failure recovery (boundary catches lazy import failures)

Route-based Code Splitting (React.lazy)
  -> Loading state for lazy routes (Suspense fallback required)
  -> Chunk load failure recovery (boundary needed around Suspense)
  -> Preload-on-hover (enhances lazy routes, depends on them existing)
  -> Skeleton placeholders (enhances Suspense fallback, depends on splitting)

Encrypted API Key Storage
  -> Session-aware key encryption (encryption.ts exists, needs session wiring)
  -> Storage layer unification (removes plaintext localStorage path)

Practice Hub Redesign (Praticar page)
  -> Consistent card design (depends on PathCard pattern being established)
  -> Preload-on-hover (can be added during card redesign)
```

Dependency order for implementation:

1. **Error boundaries + fallback UI** (foundational, no deps)
2. **Code splitting + loading states** (depends on error boundaries for chunk failures)
3. **Encrypted key storage** (independent of 1-2, can run in parallel)
4. **Storage layer consolidation** (depends on encrypted storage being correct)
5. **Practice hub redesign** (visual, independent, can run in parallel)
6. **Polish features** (preload-on-hover, skeletons, transitions) - build on top of 1-5

## MVP Recommendation

Prioritize in this order:

1. **Route-level error boundaries with retry fallback** -- Prevents whitescreen crashes. Highest impact on perceived reliability. Zero boundaries exist today.
2. **Route-based code splitting with loading spinners** -- Reduces initial bundle size. jspdf and motion are the biggest wins. Use generic spinner first.
3. **Encrypted key storage (fix the hardcoded fallback)** -- Security fix. encryption.ts exists, just needs the session wiring fixed.
4. **Practice hub page redesign** -- Visual polish. User-visible improvement.

Defer:
- **Storage consolidation**: High complexity, affects many files. Do as a separate focused pass.
- **Skeleton placeholders**: Nice-to-have, generic spinner is sufficient for MVP.
- **Route transitions**: Requires careful timing, can introduce layout jitter. Polish later.

## Complexity Matrix

| Feature | Code Changes | Risk | Time Estimate |
|---------|-------------|------|---------------|
| Error boundaries | Add ~50 lines (boundary wrapper + fallback component), modify App.tsx | Low | 2-3 hours |
| Code splitting | Modify App.tsx imports (~12 routes), add Suspense wrappers | Low | 1-2 hours |
| Loading states | Create generic PageLoader component, reuse existing spinner | Low | 1 hour |
| Encrypted key storage fix | Fix getSessionSecret() in encryption.ts, wire into auth flow | Medium | 3-4 hours |
| Practice hub redesign | New PracticeModeCard component, modify PracticeHubPage layout | Medium | 3-4 hours |
| Storage consolidation | Update all import sites, deprecate localStorage functions | High | 6-8 hours |
| Preload-on-hover | Add onMouseEnter handlers to navigation cards | Low | 1-2 hours |
| Skeleton placeholders | Per-route skeleton components | Medium | 2-3 hours |

## Sources

- Direct codebase analysis: `src/App.tsx`, `src/utils/encryption.ts`, `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/runtimeState.ts`, `src/components/practice/PracticeHubPage.tsx`, `src/components/ui/custom/PathCard.tsx`, `src/components/shared/ModeCard.tsx`, `src/config/modes.ts`, `src/components/settings/SettingsPage.tsx`, `vite.config.ts`, `package.json`
- React 19 error boundary patterns: community documentation on `react-error-boundary` library, React official docs on Error Boundaries
- Vite code splitting: Vite automatic chunk splitting for dynamic imports, Rollup `manualChunks` configuration
- Web Crypto API: MDN documentation on AES-GCM, PBKDF2 key derivation

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Error boundary placement | HIGH | Well-established React pattern. Codebase analysis confirms zero boundaries exist. |
| Code splitting targets | HIGH | package.json confirms jspdf and motion as heavy deps. Vite handles splitting automatically. |
| Key storage fix | HIGH | encryption.ts code reviewed directly. Hardcoded fallback on line 190 is the clear problem. Fix path is obvious. |
| Storage consolidation scope | MEDIUM | Need to audit all import sites for dual imports. Codebase analysis shows two parallel files but full impact requires grep across all consumers. |
| Practice hub redesign | MEDIUM | Visual direction is clear (match PathCard pattern). Exact proportions and layout decisions are subjective, not a technical question. |
| Preload-on-hover | LOW-MEDIUM | Pattern is well-known but interaction with React.lazy's internal caching needs testing. Vite's module preload behavior may make this redundant. |
