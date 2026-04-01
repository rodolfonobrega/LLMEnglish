# Project Research Summary

**Project:** SpeakLab
**Domain:** React 19 SPA hardening (error boundaries, code splitting, secure storage, Praticar redesign)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

SpeakLab is a React 19 + Vite English learning SPA that currently has zero error boundaries, eagerly loads all 12 routes (including jspdf at ~200KB and motion at ~80KB), and stores user API keys in plaintext localStorage with a hardcoded encryption fallback. The app works but is fragile: any component crash whitescreens everything, and the initial bundle is unnecessarily heavy.

The recommended approach follows a strict dependency chain. Fix dev mode routing first (it bypasses Layout entirely, making error boundaries untestable locally). Then install layered error boundaries at route level, followed by React.lazy code splitting wrapped by those boundaries. In parallel, fix the existing encryption.ts by removing the hardcoded fallback secret and increasing PBKDF2 iterations. Finally, redesign the Praticar page cards with proper keyboard accessibility and visually distinct proportions from PathCard.

The critical risk is the dev mode divergence -- App.tsx renders `<DiscoveryPage />` directly in dev mode, bypassing Layout, Routes, and all navigation. This means error boundaries and code splitting cannot be tested without a Supabase connection. Fixing dev mode routing is the gate for all subsequent hardening work. A secondary risk is the dual storage layer (localStorage vs Supabase) with identical function signatures, which makes consolidation error-prone and requires a rename-first strategy to catch all import paths.

## Key Findings

### Recommended Stack

Only one new production dependency is needed: `react-error-boundary` v6.1.1 for declarative error boundaries with a hooks API. Everything else uses built-in browser APIs (Web Crypto for encryption, React.lazy for code splitting). A dev dependency (`rollup-plugin-visualizer`) is recommended for verifying chunk sizes after splitting.

**Core technologies:**
- `react-error-boundary` v6.1.1: declarative error boundaries -- avoids class component boilerplate, provides `useErrorBoundary()` hook for async error throwing
- `React.lazy` + `Suspense` (built-in): route-level code splitting -- zero dependencies, Vite automatically code-splits dynamic imports
- Web Crypto API (`crypto.subtle`, built-in): AES-256-GCM encryption -- already in the codebase, needs parameter fixes not a new library

**Critical version note:** `react-error-boundary@6.1.1` is compatible with React 16.8+ through 19.x. No version conflicts.

### Expected Features

**Must have (table stakes):**
- Route-level error boundaries with retry fallback -- prevents whitescreen crashes on any component failure
- Route-based code splitting with loading states -- removes jspdf/motion from initial bundle, essential for mobile performance
- Chunk load failure recovery -- lazy imports can fail on slow networks; error boundaries around Suspense catch this
- Encrypted API key storage at rest (fix existing encryption.ts) -- remove hardcoded fallback secret, increase PBKDF2 iterations to 600K
- Dev mode routing fix -- render Layout + Routes with mock user instead of bypassing the router
- Global unhandled rejection handler -- async errors are not caught by error boundaries

**Should have (differentiators):**
- Preload-on-hover for route chunks -- near-instant navigation when users hover practice mode cards
- Skeleton placeholders matching page layout -- perceived performance improvement over generic spinner
- Storage layer unification via StorageAdapter facade -- eliminates import confusion between dual storage services
- Session-aware key encryption -- derive encryption secret from Supabase access_token hash

**Defer (v2+):**
- Smooth route transition animations -- risk of layout jitter, polish item
- Offline resilience indicator -- step toward PWA but out of scope
- Full PWA / Service Worker -- fundamentally different app model
- External error monitoring (Sentry) -- requires account setup and privacy review
- IndexedDB migration -- localStorage handles current volumes fine

### Architecture Approach

The hardening work inserts cross-cutting components into the existing layered React SPA without changing the layer structure. A new `LazyRoute` wrapper component combines React.lazy + Suspense + ErrorBoundary into a reusable pattern applied to each route in App.tsx. A new `StorageAdapter` facade centralizes the routing decision between Supabase and localStorage. The existing `encryption.ts` is fixed in-place rather than replaced.

**Major components:**
1. `LazyRoute` -- reusable wrapper combining lazy loading, Suspense, and error boundary for each route
2. `StorageAdapter` -- unified facade routing to Supabase (authed) or localStorage (dev/fallback)
3. `SecureKeyStore` -- fixes existing encryption.ts: removes hardcoded fallback, increases iterations, adds random salt
4. `PageSkeleton` -- route-specific skeleton fallback components matching destination page layout
5. `PracticeHubPage` (redesigned) -- new card layout with image banners, distinct proportions from PathCard

### Critical Pitfalls

1. **Dev mode routing bypasses Layout and Routes** -- error boundaries and lazy loading cannot be tested locally. Fix dev mode FIRST by rendering Layout + Routes with a mock authenticated user.
2. **Code splitting without error boundaries makes the app MORE fragile** -- chunk load failures whitescreen the entire app if Suspense is not wrapped by ErrorBoundary. Boundaries MUST be in place before any lazy loading.
3. **Error recovery infinite loop** -- resetting an error boundary without a new `key` causes immediate re-crash. Always remount with `key={retryCount}` and clear stale runtime state.
4. **Client-side encryption is security theater** -- the hardcoded fallback secret means encryption is bypassable. Prioritize routing API calls through the Supabase Edge Function proxy instead of adding more client-side encryption.
5. **Dual storage removal breaks imports silently** -- identical function names in two files means TypeScript won't catch wrong imports. Rename `storage.ts` to `storage.local.ts` FIRST to surface all broken imports as compile errors.

## Implications for Roadmap

Based on combined research, suggested phase structure:

### Phase 0: Dev Mode Routing Fix
**Rationale:** The current dev mode bypasses Layout, Routes, and all navigation. Error boundaries and code splitting placed inside the route tree will never execute in dev mode. This is a blocking prerequisite for testing all subsequent hardening work.
**Delivers:** Dev mode renders the same Layout + Routes structure as production with a mock authenticated user.
**Addresses:** Enables local testing of all subsequent phases.
**Avoids:** Pitfall 8 (dev mode divergence hides production bugs).

### Phase 1: Error Boundaries
**Rationale:** Zero error boundaries exist today. Any component crash whitescreens the entire app. This is the foundational hardening step. Must come before code splitting because lazy-loaded chunks can fail.
**Delivers:** Layered error boundaries (app-level last resort, route-level isolation, chunk-load specific). Error fallback UI with retry. Global unhandled rejection handler.
**Addresses:** Route-level error boundaries, error fallback UI with retry, global unhandled error capture, chunk load failure recovery (foundation).
**Avoids:** Pitfall 1 (granularity mismatch), Pitfall 2 (recovery infinite loop), Pitfall 3 (splitting without boundaries -- prevention).
**Uses:** `react-error-boundary` v6.1.1

### Phase 2: Code Splitting
**Rationale:** Depends on Phase 1 for chunk failure handling. Without error boundaries, lazy loading makes the app MORE fragile, not less. With boundaries in place, code splitting safely reduces initial bundle size.
**Delivers:** All 12 routes converted to React.lazy imports. LazyRoute wrapper component. Skeleton fallbacks with correct dimensions. Vite manualChunks for heavy vendors (jspdf, motion).
**Addresses:** Route-based code splitting, loading states for lazy routes.
**Avoids:** Pitfall 3 (missing boundary on lazy routes), Pitfall 4 (layout shift from empty Suspense fallbacks).
**Uses:** React.lazy, Suspense, rollup-plugin-visualizer (dev)

### Phase 3: Secure Storage Fix
**Rationale:** Independent of phases 1-2 but should not be attempted while the dual storage layer is about to be consolidated. Fix encryption.ts first, then build StorageAdapter on top of the corrected encryption.
**Delivers:** Fixed encryption.ts (no hardcoded fallback, 600K PBKDF2 iterations, random salt). SecureKeyStore wrapper. Session-aware key derivation from Supabase access_token.
**Addresses:** Encrypted API key storage at rest, session-aware key encryption.
**Avoids:** Pitfall 5 (client-side encryption as security theater -- partially; full fix requires proxy expansion).
**Uses:** Web Crypto API (crypto.subtle), existing encryption.ts

### Phase 4: Storage Consolidation
**Rationale:** Depends on Phase 3 being complete so consolidation targets the secure storage path. High-risk refactor that touches the data layer of the entire app. Requires dedicated phase with thorough testing.
**Delivers:** StorageAdapter facade unifying Supabase and localStorage routing. Old `storage.ts` deprecated and removed. All import sites updated.
**Addresses:** Storage layer unification.
**Avoids:** Pitfall 6 (dual storage removal breaks import chains -- via rename-first strategy).

### Phase 5: Praticar Redesign
**Rationale:** Purely visual work, fully independent of hardening phases. Can run in parallel with phases 3-4 if desired. Placed last because it benefits from the consolidated storage layer.
**Delivers:** Redesigned PracticeHubPage with vertical image-banner cards. Visually distinct proportions from PathCard. Keyboard-accessible card components.
**Addresses:** Consistent card design across hub pages.
**Avoids:** Pitfall 7 (Praticar redesign breaks navigation semantics).

### Phase Ordering Rationale

- Phase 0 is a gate: nothing else can be tested locally without it
- Phase 1 must precede Phase 2: code splitting without error boundaries increases fragility
- Phase 3 should precede Phase 4: consolidate into the secure path, not the old localStorage path
- Phase 5 is independent but benefits from the consolidated storage from Phase 4
- The dependency chain is: 0 -> 1 -> 2, and 3 -> 4, with 5 parallel to 3-4

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Secure Storage):** Need to audit all AI provider call paths to determine which ones already use the Edge Function proxy and which bypass it. The proxy expansion scope is unclear.
- **Phase 4 (Storage Consolidation):** Need a complete grep audit of all import sites referencing the old `storage.ts` vs `supabase/storage.ts`. Full impact analysis required before work begins.
- **Phase 5 (Praticar Redesign):** Visual design decisions (exact card proportions, layout grid) are subjective. May benefit from a design review or mockup before implementation.

Phases with standard patterns (skip research-phase):
- **Phase 0 (Dev Mode Fix):** Straightforward routing change, no external APIs or libraries involved
- **Phase 1 (Error Boundaries):** Well-documented React pattern, `react-error-boundary` has clear API docs
- **Phase 2 (Code Splitting):** React.lazy + Vite automatic splitting is standard, well-documented

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new dependency (`react-error-boundary`). All other tech is built-in or already in codebase. npm versions verified. |
| Features | HIGH | Feature list derived from direct codebase analysis. All code references verified (App.tsx routes, encryption.ts line numbers, storage.ts signatures). |
| Architecture | HIGH | Component boundaries and data flows are first-hand analysis. LazyRoute and StorageAdapter patterns are standard React/Vite patterns. |
| Pitfalls | HIGH | Eight pitfalls identified, all grounded in codebase analysis. Phase ordering rationale is consistent across all four research files. |

**Overall confidence:** HIGH

### Gaps to Address

- **Proxy coverage audit:** It is unclear which AI provider call paths (OpenAI, Gemini, Groq) already route through the Edge Function proxy and which make direct client-side calls. This determines the real scope of Pitfall 5 (encryption theater). Must be audited during Phase 3 planning.
- **Storage import audit:** The full list of files importing from `storage.ts` vs `supabase/storage.ts` needs a complete grep before Phase 4 begins. Research identified the pattern but not every call site.
- **Gemini Live WebSocket constraint:** Gemini Live requires a direct WebSocket connection, meaning the API key must be exposed client-side regardless of proxy coverage. This is an accepted risk that needs clear user-facing documentation. Scope this during Phase 3.
- **Preload-on-hover interaction with React.lazy:** Whether `React.preload()` (React 19) makes the onMouseEnter preload pattern redundant needs testing. Flag for Phase 2 implementation.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/App.tsx`, `src/utils/encryption.ts`, `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/runtimeState.ts`, `src/components/practice/PracticeHubPage.tsx`, `src/components/ui/custom/PathCard.tsx`, `src/components/shared/ModeCard.tsx`, `vite.config.ts`, `package.json`
- React official docs: Error Boundaries (`react.dev/reference/react/Component`), React.lazy (`react.dev/reference/react/lazy`)
- Vite docs: Dynamic Import code splitting (`vite.dev/guide/features`)
- MDN Web Docs: SubtleCrypto, AES-GCM, PBKDF2
- OWASP Password Storage Cheat Sheet: PBKDF2 iteration guidance (600K for SHA-256)

### Secondary (MEDIUM confidence)
- `react-error-boundary` library: community standard by Brian Vaughn (React team), v6.1.1 verified on npm
- Vite `manualChunks` configuration: Rollup docs for vendor bundle separation
- Web search results were unavailable during research; some pattern recommendations based on training data verified against npm versions and codebase state

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
