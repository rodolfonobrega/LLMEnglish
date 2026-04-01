# Architecture Patterns

**Domain:** React SPA hardening -- error boundaries, code splitting, secure storage, Praticar redesign
**Researched:** 2026-04-01
**Confidence:** HIGH (patterns are well-established; codebase analysis is first-hand)

## Recommended Architecture

The existing architecture is a layered React 19 SPA with Vite. The hardening work does not change the layer structure -- it inserts new cross-cutting components into the existing layers. The diagram below shows what gets added and where.

```
                    Browser
                      |
                 main.tsx
                    |
              +--App.tsx--+
              |            |
         BrowserRouter   AuthProvider
              |
         ErrorBoundary (NEW - app-level)
              |
         Suspense (NEW - route-level)
              |
         Layout ── Outlet
              |
    ┌─────────┼──────────┐───────────┐
    Route     Route      Route       Route
  (lazy)    (lazy)     (lazy)     (lazy)
    |         |          |           |
  Page      Page       Page       PracticeHub
  comps     comps      comps      (REDESIGNED)


  Storage Layer (CONSOLIDATED):
  ┌─────────────────────────────────────┐
  │         storageAdapter.ts (NEW)      │
  │  unified API, routes to Supabase     │
  │  or localStorage based on auth state │
  └──────┬────────────────────┬─────────┘
         |                    |
   supabase/storage.ts   storage.ts (legacy)
         |                    |
   Supabase Client       localStorage
                              |
                    keys encrypted via
                    Web Crypto (FIXED)
```

### Component Boundaries

| Component | Layer | Responsibility | Communicates With |
|-----------|-------|----------------|-------------------|
| `AppErrorBoundary` | Presentation (new) | Catches unhandled errors from any route; shows fallback UI instead of whitescreen | App.tsx renders it; it wraps Routes |
| `RouteErrorBoundary` | Presentation (new) | Catches errors from individual lazy-loaded routes; allows other routes to keep working | Wrapped around each `<Route>` element |
| `ChunkLoadErrorBoundary` | Presentation (new) | Detects chunk-load failures (stale deployments) and offers page reload | Wraps Suspense boundaries |
| `LazyRoute` wrapper | Presentation (new) | Combines `React.lazy` + `Suspense` + `ErrorBoundary` into a reusable pattern | Used by App.tsx for each route |
| `StorageAdapter` | Service (new) | Unified facade over Supabase storage and localStorage; eliminates duplicate function signatures | Called by runtimeState.ts, gamification.ts, errorAnalysis.ts, any service that reads/writes data |
| `SecureKeyStore` | Service (new) | Encrypts API keys at rest using Web Crypto AES-GCM; replaces plaintext localStorage writes | Called by runtimeState.ts for getApiKey/setApiKey |
| `PracticeHubPage` (redesigned) | Presentation (modified) | New card layout with image banners, different proportions from PathCard | Uses same data sources (modes config, images config) |
| `ModeCard` | Presentation (modified or replaced) | Either redesigned in-place or replaced by new card component for Praticar | Used exclusively by PracticeHubPage |

### Data Flow

**Current flow (unchanged for most operations):**
```
User action -> Page component -> Hook (optional) -> Service function -> StorageAdapter (NEW) -> Supabase or localStorage
```

**New error boundary flow:**
```
Component throws -> Nearest ErrorBoundary catches it -> Fallback UI renders
                                              |
                                     If chunk-load error -> offer reload
                                     If render error -> show error + retry button
                                     Log to console (future: Sentry)
```

**New secure storage flow:**
```
setRuntimeApiKey(key):
  1. runtimeState.ts calls SecureKeyStore.encrypt(key)
  2. SecureKeyStore derives AES-256-GCM key from user ID + session secret
  3. Ciphertext stored in localStorage (or Supabase if authenticated)
  4. Plaintext never touches localStorage

getRuntimeApiKey():
  1. runtimeState.ts calls SecureKeyStore.decrypt()
  2. Decrypted value held in-memory only (runtimeState singleton)
  3. Re-encrypted on next write
```

**New code splitting flow:**
```
User navigates to /live
  -> React Router matches route
  -> React.lazy() triggers dynamic import()
  -> Vite loads chunk (e.g., LiveRoleplayPage-[hash].js)
  -> Suspense shows PageSkeleton fallback
  -> Chunk loads, component renders
  -> If chunk fails -> ErrorBoundary shows retry UI
```

## Patterns to Follow

### Pattern 1: LazyRoute Component (code splitting + error recovery)

**What:** A reusable wrapper that combines `React.lazy`, `Suspense`, and `ErrorBoundary` for each route. Each route gets its own boundary so a failure in one route does not take down others.

**When:** Used for every page route in App.tsx.

**Example:**
```typescript
// src/components/shared/LazyRoute.tsx
import { Component, lazy, Suspense, type ReactNode } from 'react'

interface LazyRouteProps {
  loader: () => Promise<{ default: React.ComponentType }>
  fallback: ReactNode
}

export function LazyRoute({ loader, fallback }: LazyRouteProps) {
  const LazyComponent = lazy(loader)
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={fallback}>
        <LazyComponent />
      </Suspense>
    </ChunkErrorBoundary>
  )
}
```

**Usage in App.tsx:**
```typescript
import { LazyRoute } from './components/shared/LazyRoute'

// Inside Routes:
<Route path="live" element={
  <LazyRoute
    loader={() => import('./components/live-roleplay/LiveRoleplayPage')}
    fallback={<PageSkeleton />}
  />
} />
```

**Why this pattern:** Vite automatically code-splits any `import()` call. Wrapping in Suspense + ErrorBoundary gives loading states and failure recovery. One wrapper component keeps App.tsx clean.

### Pattern 2: StorageAdapter Facade (storage consolidation)

**What:** A single module that provides the storage API surface. Internally routes to Supabase (when authenticated) or localStorage (fallback/dev mode). Consumers import from one place.

**When:** Any service that reads or writes persisted data.

**Example:**
```typescript
// src/services/storageAdapter.ts
import * as supabaseStorage from './supabase/storage'
import * as localStorage from './storage'

function isAuthed(): boolean {
  // Check if Supabase session exists
  return !!supabase.getClient().auth.session()
}

export const storageAdapter = {
  getCards: () => isAuthed() ? supabaseStorage.getCards() : localStorage.getCards(),
  saveCards: (cards: Card[]) => isAuthed() ? supabaseStorage.saveCards(cards) : localStorage.saveCards(cards),
  // ... mirror all shared operations
}
```

**Why this pattern:** Today, `runtimeState.ts` imports from `supabase/storage` while `storage.ts` (localStorage) exposes duplicate signatures. Importing the wrong one is easy. A single facade eliminates that class of bug. The facade is a thin routing layer -- no business logic.

### Pattern 3: SecureKeyStore (encrypted at-rest storage)

**What:** Replaces plaintext `localStorage.setItem('el_openai_key', key)` with AES-256-GCM encryption using Web Crypto. Derives the encryption key from user ID + a session-derived secret.

**When:** Any time API keys are written to or read from localStorage.

**Key derivation:**
```typescript
// Derive key from userId + session token hash
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: userIdSalt, iterations: 600000, hash: 'SHA-256' },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
)
```

**Important note on the existing encryption.ts:** The file already exists with AES-GCM + PBKDF2. However, it has two problems:
1. The PBKDF2 iteration count is 100,000 -- OWASP 2023 recommends 600,000+.
2. The `getSessionSecret()` fallback is a hardcoded string `'fallback-secret-change-in-production'`.
3. The salt derivation is deterministic from userId only (no randomness).

The fix is to harden these parameters, not rewrite the module. The Web Crypto calls are correct.

### Pattern 4: Layered Error Boundaries

**What:** Three tiers of error boundaries, each catching a different scope of failure.

**When:** Always active.

```
App-level boundary (broadest) -- catches anything not caught below
  |
  Route-level boundary -- catches render errors in a specific page
    |
    Chunk-load boundary -- catches dynamic import failures
```

**Example:**
```typescript
// App-level: wraps entire Routes block
<AppErrorBoundary fallback={<AppCrashScreen />}>
  <Routes>...</Routes>
</AppErrorBoundary>

// Route-level: per route
<RouteErrorBoundary fallback={<PageError onRetry={() => window.location.reload()} />}>
  <Suspense fallback={<PageSkeleton />}>
    <LazyComponent />
  </Suspense>
</RouteErrorBoundary>
```

**Why layered:** A single top-level boundary means every error shows the same crash screen. Per-route boundaries let users navigate away from a broken page. Chunk-load boundaries specifically detect stale-deployment scenarios and offer reload.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Single Top-Level Error Boundary Only

**What:** Wrapping the entire app in one error boundary.
**Why bad:** Any component crash whitescreens the entire app, including navigation. Users cannot recover without refreshing.
**Instead:** Per-route boundaries with a top-level boundary as last resort.

### Anti-Pattern 2: Suspense Without Error Boundary

**What:** Using `React.lazy` + `Suspense` but no error boundary around it.
**Why bad:** If a chunk fails to load (network error, stale deployment), React throws an unhandled error that propagates to the nearest boundary -- which may not exist, crashing the whole app.
**Instead:** Always pair Suspense with ErrorBoundary. The LazyRoute wrapper enforces this.

### Anti-Pattern 3: Encryption Key Stored Alongside Ciphertext

**What:** Storing the encryption key or passphrase in localStorage next to the encrypted data.
**Why bad:** An attacker with access to localStorage gets both the key and the ciphertext, making encryption useless.
**Instead:** Derive the key from the user's session token (which comes from Supabase auth, not localStorage). If a session token hash must be stored, it should be derived -- not the raw token.

### Anti-Pattern 4: Over-Splitting Small Components

**What:** Using `React.lazy` for tiny utility components or shared UI primitives.
**Why bad:** Each chunk adds HTTP request overhead. For components under ~10KB, the latency cost exceeds the bundle savings.
**Instead:** Only lazy-load page-level routes. Shared components (Button, Card, Badge) stay in the main bundle. Heavy libraries (jspdf, motion/framer-motion) should be isolated to the pages that use them.

### Anti-Pattern 5: Forking Storage Logic in Consumers

**What:** Having each consumer (runtimeState, gamification, etc.) independently decide "use Supabase or localStorage."
**Why bad:** Duplicates the routing logic. Easy to get out of sync. One consumer updates its routing and another does not.
**Instead:** Centralize the decision in `storageAdapter.ts`. Consumers call one API.

## Build Order (Dependencies Between Components)

This ordering reflects what must be built before what, based on data flow dependencies.

```
Phase 1: Error Boundaries (no dependencies, immediate risk reduction)
  1a. Create ChunkErrorBoundary component
  1b. Create RouteErrorBoundary component  
  1c. Create AppErrorBoundary component
  1d. Create PageSkeleton fallback component
  1e. Wire all three into App.tsx
  Estimated scope: ~4 new files, 1 modified file (App.tsx)

Phase 2: Code Splitting (depends on Phase 1 -- needs ErrorBoundaries in place)
  2a. Create LazyRoute wrapper component
  2b. Convert all 10 page route imports to lazy imports
  2c. Add Vite manualChunks config for heavy vendor libs (jspdf, motion)
  2d. Verify chunk sizes with build analysis
  Estimated scope: 1 new file, 2 modified files (App.tsx, vite.config.ts)

Phase 3: Secure Storage (independent of 1-2, but do after to avoid merge conflicts in services/)
  3a. Fix encryption.ts (iterations 100k -> 600k, remove hardcoded fallback)
  3b. Create SecureKeyStore wrapper around encryption.ts
  3c. Create StorageAdapter facade (unified Supabase/localStorage routing)
  3d. Refactor runtimeState.ts to use StorageAdapter + SecureKeyStore
  3e. Remove direct localStorage key writes from storage.ts
  Estimated scope: 2 new files, 3 modified files

Phase 4: Praticar Redesign (independent of 1-3, can parallel)
  4a. Design new card proportions (different from PathCard)
  4b. Create/modify PracticeCard component with image banner
  4c. Redesign PracticeHubPage layout to use grid of vertical cards
  4d. Wire up mode images from config/images.ts
  Estimated scope: 1-2 new files, 1-2 modified files
```

**Dependency graph:**
```
Phase 1 (Error Boundaries)
    |
    v
Phase 2 (Code Splitting) -- requires boundaries before adding lazy loads

Phase 3 (Secure Storage) -- independent but touches same files as Phase 2 in services/

Phase 4 (Praticar Redesign) -- fully independent, can run in parallel
```

## Scalability Considerations

| Concern | At current scale (SPA, <12 routes) | At 50+ routes | At multi-team |
|---------|-------------------------------------|----------------|---------------|
| Bundle size | Lazy-route splitting sufficient | Add nested Suspense for sub-routes, consider route-based manualChunks | Module federation or micro-frontends |
| Error isolation | Per-route boundary sufficient | Add per-section boundaries within pages (sidebar, main content, widgets) | Error boundaries per team's domain |
| Storage complexity | Single adapter sufficient | May need IndexedDB for large datasets, cache layers | Read models + event sourcing |
| Key management | Web Crypto AES-GCM sufficient | Consider hardware-backed keys (WebAuthn) or backend-only storage | HSM-backed key management service |

## Vite Configuration Changes

The current `vite.config.ts` has no `build.rollupOptions`. Add manual chunks for heavy dependencies:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-supabase': ['@supabase/supabase-js'],
        // jspdf and motion will auto-split because they are
        // only imported inside lazy-loaded page components
      },
    },
  },
}
```

Vite automatically creates a separate chunk for any module imported only via dynamic `import()`. So if `jspdf` is only used inside `HistoryPage` (a lazy route), it will be in its own chunk without any manual config. The manual chunks above are for vendor code shared across many routes (React, Supabase).

## Sources

- React documentation on Error Boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- React documentation on lazy and Suspense: https://react.dev/reference/react/lazy
- Vite code splitting (dynamic import): https://vite.dev/guide/features#dynamic-import
- OWASP PBKDF2 iteration guidance (2023): https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Web Crypto API AES-GCM: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams
- `react-error-boundary` library: https://github.com/bvaughn/react-error-boundary (considered but not recommended -- a simple class component is fewer dependencies for this scope)
- Codebase analysis: first-hand reading of App.tsx, main.tsx, Layout.tsx, vite.config.ts, runtimeState.ts, storage.ts, encryption.ts
