# Phase 2: Error Boundaries - Research

**Researched:** 2026-04-01
**Domain:** React error boundaries, React Router v7 error handling, chunk load failure recovery
**Confidence:** HIGH

## Summary

This phase introduces layered error boundaries across the SpeakLab SPA to eliminate whitescreen crashes. The current codebase has **zero error boundaries** -- any unhandled error in any component crashes the entire React tree, producing a blank whitescreen. React 19 still requires class components for error boundaries (no hook equivalent exists), but the `react-error-boundary` library (v6.1.1) provides an ergonomic functional wrapper.

The recommended architecture uses a **three-layer approach**: (1) an app-level error boundary wrapping the entire `<BrowserRouter>` in `App.tsx` as the last resort, (2) React Router v7's built-in `errorElement` prop on each `<Route>` for route-level crash isolation that preserves the Layout (sidebar, header, navigation), and (3) a chunk-load error boundary using `react-error-boundary` with `Suspense` for Phase 3's lazy-loaded routes (RELI-03).

**Primary recommendation:** Use React Router v7 `errorElement` for route-level boundaries (preserves Layout/sidebar navigation), `react-error-boundary` for app-level and chunk-load boundaries, and a shared `ErrorFallback` component styled with existing design tokens.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RELI-01 | User sees a friendly error message instead of whitescreen when any page crashes (app-level error boundary) | App-level `react-error-boundary` wrapping `BrowserRouter` in `App.tsx`; shared `ErrorFallback` component |
| RELI-02 | User can navigate away from a broken page without losing the entire app (route-level error boundaries) | React Router v7 `errorElement` on each `<Route>` inside Layout; sidebar/header remain functional |
| RELI-03 | User sees a retry option when a page chunk fails to load (chunk-load error recovery) | `react-error-boundary` wrapping `Suspense` + lazy components; `resetKeys` on route change; `ChunkErrorFallback` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-error-boundary | 6.1.1 | Ergonomic error boundary wrapper (function component API) | Industry standard; supports React 18 and 19; provides `FallbackComponent`, `onReset`, `resetKeys`, `useErrorBoundary` hook; zero-config class component wrapper |
| react-router-dom | 7.13 | Built-in `errorElement` on routes | Already in project; `errorElement` + `useRouteError` provide native route-level error boundaries without extra dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React.Suspense | 19.2 (built-in) | Wraps lazy-loaded routes for loading state | Phase 3 introduces lazy loading; combined with error boundary for chunk failures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-error-boundary | Custom class component | Custom class component avoids a dependency but reimplements reset logic, `resetKeys`, and `useErrorBoundary` hook. Not worth it for a 2KB library. |
| React Router `errorElement` | ErrorBoundary wrapper on each route | `errorElement` integrates with React Router's error infrastructure (`useRouteError`, `isRouteErrorResponse`), preserving Layout automatically. ErrorBoundary wrapper would require manual Layout preservation logic. |

**Installation:**
```bash
npm install react-error-boundary
```

**Version verification:**
- react-error-boundary: 6.1.1 (verified via `npm view react-error-boundary version`)
- Peer dependency: `react: ^18.0.0 \|\| ^19.0.0` -- compatible with React 19.2

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    errors/
      ErrorDashboard.tsx          # EXISTING -- learning analytics page, unchanged
      ErrorFallback.tsx           # NEW -- shared fallback UI component
      ChunkErrorFallback.tsx      # NEW -- chunk-load-specific fallback with retry
      AppErrorBoundary.tsx        # NEW -- app-level boundary wrapper
    layout/
      Layout.tsx                  # EXISTING -- unchanged (sidebar/header preserved by route-level boundaries)
  App.tsx                         # MODIFY -- add app-level boundary, add errorElement to routes
```

### Pattern 1: Three-Layer Error Boundary Architecture

**What:** Layered error boundaries with different scopes and recovery strategies.
**When to use:** This is the architecture for this entire phase.

```
Layer 1: App-level (App.tsx)
  - Wraps entire <BrowserRouter>
  - Catches truly catastrophic errors (AuthProvider crash, router failure)
  - Shows full-page error fallback with reload button
  - User CANNOT navigate away (entire app is down)

Layer 2: Route-level (App.tsx route definitions)
  - errorElement on each <Route> inside Layout
  - Catches errors within page components
  - Layout (sidebar, header, navigation) STAYS INTACT
  - User CAN navigate to other pages via sidebar
  - Shows inline error with retry button

Layer 3: Chunk-load (future, Phase 3 integration)
  - react-error-boundary wrapping Suspense boundaries
  - Catches dynamic import failures (network errors, CDN issues)
  - Shows retry-specific UI with "reload chunk" messaging
  - resetKeys tied to location to auto-reset on navigation
```

### Pattern 2: React Router v7 errorElement (Route-Level)

**What:** Native route error handling that preserves parent layout.
**When to use:** On every `<Route>` inside the Layout wrapper.

```tsx
// In App.tsx
import { ErrorFallback } from './components/errors/ErrorFallback';

<Route path="/" element={<Layout />}>
  <Route index element={<ProtectedApp />} errorElement={<ErrorFallback />} />
  <Route path="review" element={<ReviewPage />} errorElement={<ErrorFallback />} />
  <Route path="live" element={<LiveRoleplayPage />} errorElement={<ErrorFallback />} />
  <Route path="paths" element={<PathsPage />} errorElement={<ErrorFallback />} />
  <Route path="exercises" element={<ExercisesPage />} errorElement={<ErrorFallback />} />
  <Route path="library" element={<LibraryPage />} errorElement={<ErrorFallback />} />
  <Route path="scripts" element={<PracticePage />} errorElement={<ErrorFallback />} />
  <Route path="practice" element={<PracticeHubPage />} errorElement={<ErrorFallback />} />
  <Route path="settings" element={<SettingsPage />} errorElement={<ErrorFallback />} />
  <Route path="errors" element={<ErrorDashboard />} errorElement={<ErrorFallback />} />
  <Route path="history" element={<HistoryPage />} errorElement={<ErrorFallback />} />
</Route>
```

**Key insight:** `errorElement` renders inside the parent `<Outlet />`, so Layout (sidebar, header) remains visible and interactive. This satisfies RELI-02 directly.

### Pattern 3: App-Level Boundary (react-error-boundary)

**What:** Last-resort boundary catching errors that escape route-level boundaries.
**When to use:** Wrapping the entire `<BrowserRouter>` in App.tsx.

```tsx
// In App.tsx
import { ErrorBoundary } from 'react-error-boundary';
import { AppErrorFallback } from './components/errors/AppErrorFallback';

function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ... routes ... */}
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

### Pattern 4: ErrorFallback Component (Shared UI)

**What:** Reusable error fallback component matching SpeakLab's design system.
**When to use:** Both route-level `errorElement` and app-level boundary.

```tsx
// src/components/errors/ErrorFallback.tsx
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface ErrorFallbackProps {
  error?: unknown;
  resetErrorBoundary?: () => void;
  showNavigation?: boolean;
}

export function ErrorFallback({ error, resetErrorBoundary, showNavigation = true }: ErrorFallbackProps) {
  const message = error instanceof Error ? error.message : 'Algo deu errado';

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center">
        <AlertTriangle className="text-danger" size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Algo deu errado</h3>
        <p className="text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button onClick={() => window.location.reload()} variant="default" className="gap-2">
        <RefreshCw size={16} />
        Tentar novamente
      </Button>
      {showNavigation && (
        <p className="text-xs text-muted-foreground">
          Use a barra lateral para navegar para outra pagina
        </p>
      )}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Single app-level boundary only:** Without route-level boundaries, a page crash still takes down the entire visible UI. Must use layered approach.
- **Error boundary on Layout itself:** Wrapping `<Layout />` with an error boundary means a Layout crash loses sidebar navigation. Instead, put boundaries INSIDE the Layout via `errorElement` on child routes.
- **Swallowing errors silently:** Every error boundary must log to `console.error` at minimum. v2 requirement RELI-06 (external error tracking) is deferred but the logging hook must exist.
- **Hardcoded colors in fallback:** Use existing CSS variables (`--danger`, `--danger-soft`, `--foreground`, `--muted-foreground`) from the design system. Both light and dark modes are already defined.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary class component | Custom `Component` with `getDerivedStateFromError`/`componentDidCatch` | `react-error-boundary` | Handles reset logic, `resetKeys`, `useErrorBoundary` hook. 2KB, zero config, battle-tested. |
| Chunk load error detection | Custom error type checking | `react-error-boundary` with `resetKeys` | Chunk errors have specific error types (`ChunkLoadError`, `SyntaxError` on dynamic import). react-error-boundary's `resetKeys` auto-resets on route change. |
| Route-level error display | Custom ErrorBoundary wrapper per route | React Router `errorElement` | `errorElement` preserves parent Layout automatically. Custom wrappers need manual Layout re-rendering. |

**Key insight:** React Router v7's `errorElement` is purpose-built for this exact use case. Using it instead of wrapping each route with `<ErrorBoundary>` means Layout stays intact without any extra code.

## Common Pitfalls

### Pitfall 1: Error Boundary Does Not Catch All Errors
**What goes wrong:** Developers assume error boundaries catch everything. They do NOT catch: event handlers, async code, server-side rendering, errors thrown in the error boundary itself.
**Why it happens:** React error boundaries only catch errors during rendering, lifecycle methods, and constructors.
**How to avoid:** For event handler errors, use `try/catch` or the `useErrorBoundary` hook. For async errors, wrap in `try/catch` and call `showBoundary(error)`. This phase focuses on render-time crashes (the whitescreen case).
**Warning signs:** User reports whitescreen but only when clicking a button (event handler error, not a render error).

### Pitfall 2: Error Boundary Reset Without State Reset
**What goes wrong:** Error boundary resets (re-renders children) but the underlying state that caused the error is unchanged, causing immediate re-crash.
**Why it happens:** `resetErrorBoundary()` re-renders the component tree but does not reset component state.
**How to avoid:** Use `onReset` callback to reset relevant state. Use `resetKeys` prop (array of values that trigger auto-reset when changed) -- tie to `window.location.pathname` for route-level reset. For RELI-05 (deferred), proper reset-without-reload requires careful state management.
**Warning signs:** Error fallback appears, user clicks retry, error immediately reappears.

### Pitfall 3: Public Routes Without Error Boundaries
**What goes wrong:** `/login` and `/migrate` routes are outside the Layout wrapper and have no `errorElement`.
**Why it happens:** These routes are defined as siblings to the Layout route, not children.
**How to avoid:** Add `errorElement` to `/login` and `/migrate` routes as well. Since they don't have Layout/sidebar, their fallback must be self-contained (full page with no navigation hint).
**Warning signs:** Login page crash shows whitescreen even though route-level boundaries are in place.

### Pitfall 4: ChunkLoadError vs Regular Error Ambiguity (Phase 3 Prep)
**What goes wrong:** When Phase 3 introduces lazy loading, chunk failures look like regular render errors but need different recovery (reload the chunk, not reset component state).
**Why it happens:** Dynamic import rejection and component render errors both propagate to error boundaries.
**How to avoid:** Use a dedicated `ChunkErrorFallback` that detects chunk load errors by checking error message patterns (`"Loading chunk"`, `"Loading CSS chunk"`, `"dynamically imported module"`). For Phase 2, document this pattern but defer full implementation to Phase 3 when lazy loading is introduced.
**Warning signs:** After Phase 3, network error during route navigation shows generic error instead of chunk-specific retry UI.

### Pitfall 5: Error Fallback Itself Crashes
**What goes wrong:** The error fallback component throws an error (e.g., missing import, undefined variable), creating an infinite error loop.
**Why it happens:** Error boundaries do NOT catch errors in their own fallback.
**How to avoid:** Keep fallback components minimal -- no complex logic, no data fetching, no hooks with side effects. Use only basic HTML/CSS and the existing `Button` component.
**Warning signs:** Whitescreen after implementing error boundaries (fallback itself crashed).

## Code Examples

### Example 1: Route-Level ErrorFallback with useRouteError (RELI-01, RELI-02)

```tsx
// src/components/errors/ErrorFallback.tsx
// Used as errorElement on routes INSIDE Layout
// Layout (sidebar, header, nav) remains visible and interactive

import { useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

export function ErrorFallback() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'Algo deu errado';

  // Log for debugging (v2: RELI-06 will add external reporting)
  console.error('[RouteErrorBoundary]', error);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-4">
      <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center">
        <AlertTriangle className="text-danger" size={32} />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-foreground">Algo deu errado</h3>
        <p className="text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button onClick={() => window.location.reload()} className="gap-2 cursor-pointer">
        <RefreshCw size={16} />
        Tentar novamente
      </Button>
      <p className="text-xs text-muted-foreground">
        Use a barra lateral para navegar para outra pagina
      </p>
    </div>
  );
}
```

### Example 2: App-Level Boundary (RELI-01)

```tsx
// src/components/errors/AppErrorFallback.tsx
// Full-page fallback when the entire app crashes (auth, router, etc.)
// No sidebar available -- must provide full-page recovery

import { ErrorBoundary } from 'react-error-boundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function AppErrorFallback({ error, resetErrorBoundary }: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  console.error('[AppErrorBoundary]', error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="text-danger" size={32} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Erro inesperado</h2>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer"
        >
          <RefreshCw size={16} />
          Recarregar pagina
        </button>
      </div>
    </div>
  );
}
```

### Example 3: App.tsx Integration

```tsx
// src/App.tsx -- modified structure
import { ErrorBoundary } from 'react-error-boundary';
import { AppErrorFallback } from './components/errors/AppErrorFallback';
import { ErrorFallback } from './components/errors/ErrorFallback';

function App() {
  return (
    <ErrorBoundary FallbackComponent={AppErrorFallback}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes -- no Layout, self-contained fallback */}
            <Route path="/login" element={<LoginPage />} errorElement={<ErrorFallback />} />
            <Route path="/migrate" element={<MigrationPage />} errorElement={<ErrorFallback />} />

            {/* Protected routes with Layout -- fallback renders inside Layout */}
            <Route path="/" element={<Layout />}>
              <Route index element={<ProtectedApp />} errorElement={<ErrorFallback />} />
              <Route path="review" element={<ReviewPage />} errorElement={<ErrorFallback />} />
              <Route path="live" element={<LiveRoleplayPage />} errorElement={<ErrorFallback />} />
              <Route path="paths" element={<PathsPage />} errorElement={<ErrorFallback />} />
              <Route path="exercises" element={<ExercisesPage />} errorElement={<ErrorFallback />} />
              <Route path="library" element={<LibraryPage />} errorElement={<ErrorFallback />} />
              <Route path="scripts" element={<PracticePage />} errorElement={<ErrorFallback />} />
              <Route path="practice" element={<PracticeHubPage />} errorElement={<ErrorFallback />} />
              <Route path="settings" element={<SettingsPage />} errorElement={<ErrorFallback />} />
              <Route path="errors" element={<ErrorDashboard />} errorElement={<ErrorFallback />} />
              <Route path="history" element={<HistoryPage />} errorElement={<ErrorFallback />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
```

### Example 4: Phase 3 Preparation -- Chunk Error Detection Pattern

```tsx
// For Phase 3 (Code Splitting) -- not implemented now, but documented
// This pattern will wrap Suspense boundaries around lazy-loaded routes

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('dynamically imported module') ||
    error.name === 'ChunkLoadError'
  );
}

// In Phase 3, the ChunkErrorFallback will use this check:
// <ErrorBoundary
//   fallbackRender={({ error, resetErrorBoundary }) => {
//     if (isChunkLoadError(error)) return <ChunkErrorFallback reset={resetErrorBoundary} />;
//     return <ErrorFallback />;
//   }}
//   resetKeys={[window.location.pathname]}
// >
//   <Suspense fallback={<LoadingSpinner />}>
//     <LazyRoute />
//   </Suspense>
// </ErrorBoundary>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom class component error boundaries | `react-error-boundary` library + React Router `errorElement` | react-error-boundary stable since 2020; `errorElement` since React Router v6.4 (2022) | Less boilerplate, built-in reset logic, route-level isolation |
| Single top-level error boundary | Layered boundaries (app + route + chunk) | Community best practice since 2020 | Crash isolation preserves unaffected UI |
| Manual chunk error detection | `resetKeys` + error type checking | react-error-boundary v4+ | Automatic recovery on route change |

**Deprecated/outdated:**
- `componentDidCatch` as sole error handling: Still valid but `react-error-boundary` provides better ergonomics
- React Router v5 `ErrorBoundary` wrappers: Replaced by v6+ native `errorElement`

## Open Questions

1. **Should ErrorFallback accept `useRouteError` or props?**
   - What we know: React Router `errorElement` makes `useRouteError()` available. react-error-boundary passes `error` and `resetErrorBoundary` as props.
   - What's unclear: Whether to build one component that handles both APIs or two separate components.
   - Recommendation: Build two components -- `ErrorFallback` (route-level, uses `useRouteError`) and `AppErrorFallback` (app-level, receives props from react-error-boundary). Shared styling via a base layout function.

2. **Should RELI-03 chunk error handling be stubbed in Phase 2 or deferred entirely to Phase 3?**
   - What we know: No lazy loading exists yet. RELI-03 says "chunk fails to load" which requires lazy loading.
   - What's unclear: Whether the requirement expects preparation in Phase 2.
   - Recommendation: Create the `ChunkErrorFallback` component and `isChunkLoadError` utility in Phase 2, but actual integration with lazy routes happens in Phase 3. This ensures RELI-03 has the component ready.

3. **Error message language: Portuguese or English?**
   - What we know: Existing UI uses Portuguese ("Algo deu errado", "Tentar novamente"). Error messages from libraries are in English.
   - Recommendation: UI text in Portuguese (matching app language). Technical error details in English (developer-facing, shown in `<details>` collapsible).

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified)

This phase adds only one npm dependency (`react-error-boundary`) and creates React components. No external services, databases, or CLI tools are required.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0 |
| Config file | `vite.config.ts` (test block) |
| Quick run command | `npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `npx vitest run 2>&1` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RELI-01 | App-level boundary catches render errors and shows fallback | unit | `npx vitest run src/components/errors/ErrorFallback.test.tsx` | Wave 0 |
| RELI-02 | Route-level errorElement renders fallback inside Layout (sidebar visible) | unit | `npx vitest run src/App.test.tsx` | Wave 0 |
| RELI-03 | Chunk error detection utility identifies chunk load errors | unit | `npx vitest run src/components/errors/ChunkErrorFallback.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose 2>&1 | tail -20`
- **Per wave merge:** `npx vitest run 2>&1`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/errors/__tests__/ErrorFallback.test.tsx` -- covers RELI-01 (renders error message, retry button)
- [ ] `src/components/errors/__tests__/ChunkErrorFallback.test.tsx` -- covers RELI-03 (chunk error detection, retry mechanism)
- [ ] `src/App.test.tsx` -- covers RELI-02 (route errorElement preserves Layout)
- [ ] `@testing-library/react` install required -- NOT currently installed; needed for React component rendering in tests

## Sources

### Primary (HIGH confidence)
- React Router v7 installed types (`node_modules/react-router/dist/development/index.d.ts`) -- confirmed `errorElement`, `useRouteError`, `isRouteErrorResponse` exports exist
- npm registry -- `react-error-boundary` v6.1.1, peer deps `react: ^18.0.0 || ^19.0.0`
- Source code analysis -- `App.tsx` (route structure), `Layout.tsx` (Outlet location), `index.css` (design tokens)

### Secondary (MEDIUM confidence)
- React error boundary API -- `getDerivedStateFromError` / `componentDidCatch` pattern is stable since React 16, unchanged in React 19
- react-error-boundary API -- `FallbackComponent`, `onReset`, `resetKeys`, `useErrorBoundary` hook documented on npm/GitHub

### Tertiary (LOW confidence)
- Chunk load error message patterns -- based on common webpack/Vite error messages; actual Vite 6 chunk error messages should be verified during Phase 3 implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-error-boundary v6.1.1 verified on npm, React Router v7 errorElement confirmed in installed types
- Architecture: HIGH - three-layer pattern is well-established; route-level via errorElement confirmed to preserve Layout
- Pitfalls: HIGH - React error boundary limitations are well-documented and stable

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable APIs, unlikely to change)
