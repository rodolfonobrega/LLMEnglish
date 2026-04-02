# Phase 3: Code Splitting - Research

**Researched:** 2026-04-02
**Domain:** React lazy loading, Vite code splitting, Suspense boundaries
**Confidence:** HIGH

## Summary

Phase 3 converts all 10 page route components in `App.tsx` from eager imports to `React.lazy()` dynamic imports, wrapped by a single `<Suspense>` boundary in `Layout.tsx`. Vite automatically creates separate chunks for each `React.lazy()` call -- no `manualChunks` configuration needed. The `jspdf` library (~500KB) will naturally land in the PracticePage chunk since it is only imported there.

The primary technical concern is that all page components use **named exports** (`export function ComponentName()`), while `React.lazy()` requires a **default export**. The standard workaround is a one-line wrapper: `React.lazy(() => import('./path').then(m => ({ default: m.ComponentName })))`. This affects all 10 routes but is mechanical and low-risk.

**Primary recommendation:** Use `React.lazy()` with named-export wrappers for all 10 route components. Place a single `<Suspense>` around `<Outlet/>` in Layout.tsx with a generic skeleton fallback. No Vite config changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use a **generic skeleton screen** as the Suspense fallback for all route transitions -- gray placeholder shapes that feel fast and native
- **D-02:** One skeleton component reused across all routes (no per-page custom skeletons) -- consistent and minimal maintenance
- **D-03:** **Route-level only** -- apply `React.lazy()` to all 10 page route components in `App.tsx`. No `manualChunks` vendor extraction needed
- **D-04:** `jspdf` (~500KB) naturally lands in the PracticePage chunk since it is only imported there -- no extra config needed
- **D-05:** `motion` library is listed in PERF-03 but is **NOT imported anywhere in `src/`** -- already tree-shaken by Vite, no action needed. PERF-03 is satisfied by the jspdf extraction alone
- **D-06:** **Single layout-level Suspense** boundary wrapping `<Outlet/>` in `Layout.tsx` -- one place to maintain, all routes share the generic skeleton
- **D-07:** Route-level `errorElement` (from Phase 2) handles chunk load failures via `ChunkErrorFallback` with `resetErrorBoundary()` -- Suspense only handles the loading state, not errors

### Claude's Discretion
- Exact skeleton component design (shape, pulse animation, spacing)
- How to structure the lazy imports in App.tsx (inline vs separate loader module)
- Whether to add a minimum delay before showing skeleton (avoid flash on fast loads)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | User only downloads the code for the page they're viewing (lazy-loaded route components) | React.lazy() + Vite auto-splitting creates per-route chunks. Named-export wrapper pattern documented below. |
| PERF-02 | User sees a loading indicator while a page chunk is being fetched (loading states) | Single `<Suspense>` in Layout.tsx wrapping `<Outlet/>` with generic skeleton fallback. |
| PERF-03 | User's initial bundle excludes heavy dependencies like jspdf and motion (separate chunks) | jspdf only imported in PracticePage.tsx -> lands in its chunk. motion has zero imports in src/ -> tree-shaken entirely. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `React.lazy()` | 19.2 (built-in) | Dynamic import wrapping for code splitting | Native React API, no extra dependency |
| `<Suspense>` | 19.2 (built-in) | Loading state boundary for lazy components | Native React API, standard pattern |
| `react-router-dom` | ^7.13.0 | Route definitions with `element`/`errorElement` | Already in use, supports lazy components natively |
| Vite | ^6.4.1 | Build tool with automatic chunk splitting | Auto-splits dynamic imports into separate chunks |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.563 | Icons for skeleton placeholder | If skeleton needs visual elements |
| `tailwindcss` | 4.1 | Styling skeleton with pulse animation | For skeleton CSS (animate-pulse, bg-muted) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React.lazy() | @loadable/component | loadable supports SSR; React.lazy is sufficient for client-side SPA. No new dependency. |
| Single Suspense | Per-route Suspense | Per-route allows custom skeletons per page, but D-02 locks decision to single generic skeleton |

**Installation:**
No new packages needed. React.lazy and Suspense are built into React 19.2.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── layout/
│   │   └── Layout.tsx          # Suspense boundary goes here
│   ├── errors/
│   │   └── ChunkErrorFallback.tsx  # Already exists (Phase 2)
│   └── ui/
│       └── PageSkeleton.tsx    # New: generic skeleton fallback
├── App.tsx                      # Lazy imports replace eager imports
```

### Pattern 1: Named-Export Lazy Loading
**What:** All page components use named exports (`export function ComponentName()`). `React.lazy()` requires a default export. The standard workaround extracts the named export from the module.
**When to use:** Every lazy route component (all 10 routes in this project).
**Example:**
```typescript
// Named-export wrapper pattern for React.lazy
const ReviewPage = React.lazy(() =>
  import('./components/review/ReviewPage').then(m => ({ default: m.ReviewPage }))
);
```

This is the cleanest approach that preserves the project's naming convention (named exports, no default exports) while satisfying React.lazy's requirement.

### Pattern 2: Layout-Level Suspense Boundary
**What:** A single `<Suspense>` wraps `<Outlet/>` inside the Layout component. All child routes share one loading boundary.
**When to use:** Route-level code splitting with consistent loading UX.
**Example:**
```typescript
// Layout.tsx
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSkeleton } from '../ui/PageSkeleton';

export function Layout() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <DevBanner />
        <Header />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-6 pb-24 w-full">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <div className="lg:hidden">
        <Navigation />
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Never use `fallback={null}` on Suspense:** Causes blank flash during chunk loading. Always use a visible skeleton or spinner.
- **Never lazy-load Layout itself:** Layout contains sidebar/header/nav that must render immediately. Only the `<Outlet/>` content is lazy.
- **Never lazy-load shared services:** Services like `runtimeState.ts`, `openai.ts`, `geminiLive.ts` are imported by multiple pages and belong in shared chunks, not route chunks.
- **Do not add `manualChunks` to vite.config.ts:** Vite auto-splits lazy imports. Manual chunk config adds complexity with no benefit for route-level splitting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dynamic import wrapping | Custom chunk loader | React.lazy() | Handles module loading, error states, Suspense integration |
| Chunk splitting config | manualChunks for routes | Vite automatic splitting | Vite auto-splits dynamic imports into separate chunks |
| Loading state management | Custom loading hooks | Suspense boundary | Built-in React primitive designed for this exact use case |

## Common Pitfalls

### Pitfall 1: Named Export vs Default Export Mismatch
**What goes wrong:** `React.lazy(() => import('./Page'))` returns `undefined` if the module has no default export. The page renders nothing or throws.
**Why it happens:** All project components use `export function ComponentName()` (named export). React.lazy requires `{ default: Component }`.
**How to avoid:** Always use the named-export wrapper: `.then(m => ({ default: m.ComponentName }))`.
**Warning signs:** Blank page or React error about missing default export. Easy to catch in dev.

### Pitfall 2: Skeleton Flash on Fast Connections
**What goes wrong:** Skeleton appears for a split second then immediately disappears, creating a visual flash/jank.
**Why it happens:** Chunks load fast on local network or after browser caching.
**How to avoid:** Consider using a minimum delay pattern or CSS transition on the skeleton appearance. This is at Claude's discretion per CONTEXT.md.
**Warning signs:** Users report "flashing" during navigation.

### Pitfall 3: ErrorFallback Does Full Page Reload for Chunk Errors
**What goes wrong:** When a chunk fails to load, `ErrorFallback` (currently on all routes) calls `window.location.reload()` -- a harsher UX than `ChunkErrorFallback` which uses `resetErrorBoundary()`.
**Why it happens:** Phase 2 installed `ErrorFallback` on all routes but `ChunkErrorFallback` exists without being wired up.
**How to avoid:** Consider switching route `errorElement` to use chunk-aware error detection. This may be out of scope (error boundaries are Phase 2's domain), but chunk errors only appear after Phase 3 introduces lazy loading.
**Warning signs:** Users lose all app state when a chunk load fails.

### Pitfall 4: ProtectedApp Cannot Be Lazy-Loaded Simply
**What goes wrong:** `ProtectedApp` is defined inline in `App.tsx` (not a separate file), so it cannot use `React.lazy(() => import(...))`.
**Why it happens:** It is a function defined in the same file, not a module.
**How to avoid:** Either keep `ProtectedApp` as an eager import (it is tiny -- just auth check + redirect), or extract it to its own file first. Keeping it eager is simplest.
**Warning signs:** Build error when trying to lazy-load an inline component.

### Pitfall 5: Suspense Inside ErrorBoundary Order
**What goes wrong:** If Suspense wraps ErrorBoundary, chunk load errors get caught by Suspense (infinite loading) instead of the error boundary.
**Why it happens:** React's error propagation: errors inside Suspense's children propagate up. But chunk load errors are thrown during render, which Suspense treats differently from ErrorBoundary.
**How to avoid:** Ensure the order is ErrorBoundary > Suspense > lazy component. The current architecture (route `errorElement` + Suspense in Layout) already follows this pattern correctly since react-router's `errorElement` acts as the error boundary.
**Warning signs:** Chunk load failures show infinite loading instead of error UI.

## Code Examples

### Converting Eager Imports to Lazy (App.tsx)

Current pattern (eager):
```typescript
import { ReviewPage } from './components/review/ReviewPage';
```

New pattern (lazy):
```typescript
import { lazy } from 'react';

const ReviewPage = lazy(() =>
  import('./components/review/ReviewPage').then(m => ({ default: m.ReviewPage }))
);
```

### All 10 Lazy Import Conversions

```typescript
// Public routes stay eager (LoginPage, MigrationPage) -- not inside Layout
import { LoginPage } from './components/auth/LoginPage';
import { MigrationPage } from './components/auth/MigrationPage';

// Protected routes become lazy
const ProtectedApp = lazy(() =>
  import('./components/discovery/DiscoveryPage').then(m => ({ default: m.DiscoveryPage }))
);
// NOTE: ProtectedApp is inline in App.tsx. It needs to be extracted OR kept eager.
// It references DiscoveryPage directly, so lazy-load DiscoveryPage instead.

const ReviewPage = lazy(() =>
  import('./components/review/ReviewPage').then(m => ({ default: m.ReviewPage }))
);
const LiveRoleplayPage = lazy(() =>
  import('./components/live-roleplay/LiveRoleplayPage').then(m => ({ default: m.LiveRoleplayPage }))
);
const PathsPage = lazy(() =>
  import('./components/paths/PathsPage').then(m => ({ default: m.PathsPage }))
);
const ExercisesPage = lazy(() =>
  import('./components/exercises/ExercisesPage').then(m => ({ default: m.ExercisesPage }))
);
const LibraryPage = lazy(() =>
  import('./components/library/LibraryPage').then(m => ({ default: m.LibraryPage }))
);
const PracticePage = lazy(() =>
  import('./components/practice/PracticePage').then(m => ({ default: m.PracticePage }))
);
const PracticeHubPage = lazy(() =>
  import('./components/practice/PracticeHubPage').then(m => ({ default: m.PracticeHubPage }))
);
const SettingsPage = lazy(() =>
  import('./components/settings/SettingsPage').then(m => ({ default: m.SettingsPage }))
);
const ErrorDashboard = lazy(() =>
  import('./components/errors/ErrorDashboard').then(m => ({ default: m.ErrorDashboard }))
);
const HistoryPage = lazy(() =>
  import('./components/history/HistoryPage').then(m => ({ default: m.HistoryPage }))
);
```

### Generic PageSkeleton Component

```typescript
// src/components/ui/PageSkeleton.tsx
// Uses existing Tailwind utilities and design tokens
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-6 py-4">
      {/* Title skeleton */}
      <div className="h-8 bg-muted rounded-md w-1/3" />
      {/* Content blocks */}
      <div className="space-y-4">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    </div>
  );
}
```

### Verification: Build and Inspect Chunks

```bash
# Build the production bundle
npx vite build

# List all generated chunks
ls -la dist/assets/*.js

# Check that jspdf is NOT in the main chunk
# The main chunk should be small; jspdf should be in a separate [hash].js file
# Use vite-plugin-visualizer for detailed analysis (optional, not required)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| webpack + manual chunk naming | Vite auto-splitting | Vite 2+ (2021) | No manualChunks needed for route splitting |
| Per-Suspense fallbacks | Layout-level Suspense | Established pattern | Simpler maintenance, consistent UX |
| Default exports for lazy | Named-export wrapper pattern | Common since 2019 | Preserves project naming conventions |

**Deprecated/outdated:**
- `webpackChunkName` magic comments: Not supported by Vite/Rollup. Vite generates its own chunk names.
- `@loadable/component` for client-only SPAs: React.lazy + Suspense is sufficient. loadable is only needed for SSR.

## Open Questions

1. **ProtectedApp inline component**
   - What we know: ProtectedApp is defined inline in App.tsx (lines 21-41). It wraps DiscoveryPage with auth gating.
   - What's unclear: Should it be kept eager (it is tiny) or extracted to its own file and lazy-loaded?
   - Recommendation: Keep ProtectedApp eager. It contains only auth logic (no heavy imports). Lazy-loading the index route would delay the initial auth check, which is counterproductive. The DiscoveryPage it renders can be lazy-loaded separately if desired, but the auth wrapper itself should be immediate.

2. **ChunkErrorFallback wiring**
   - What we know: ChunkErrorFallback exists but routes use ErrorFallback (which does full page reload). Chunk errors only occur after Phase 3 introduces lazy loading.
   - What's unclear: Whether Phase 3 should also update errorElement to use chunk-aware detection, or defer to Phase 2 maintenance.
   - Recommendation: Flag for planner. Consider updating route errorElement to detect chunk load errors specifically and use ChunkErrorFallback for them. This is a small change that significantly improves chunk failure UX.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- code/config-only changes using built-in React APIs and existing Vite setup)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vite.config.ts (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Lazy-loaded route components create separate chunks | build verification | `npx vite build && ls dist/assets/*.js` | N/A (build test) |
| PERF-02 | Suspense shows skeleton fallback during chunk load | unit | `npx vitest run src/components/ui/__tests__/PageSkeleton.test.tsx` | Wave 0 |
| PERF-03 | jspdf excluded from main bundle | build verification | `npx vite build && grep -c jspdf dist/assets/index-*.js` (should be 0) | N/A (build test) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + build verification (no jspdf in main chunk)

### Wave 0 Gaps
- [ ] `src/components/ui/__tests__/PageSkeleton.test.tsx` -- covers PERF-02 (skeleton renders correctly)
- [ ] Build verification script or manual step -- covers PERF-01, PERF-03

## Sources

### Primary (HIGH confidence)
- React 19.2 built-in APIs: React.lazy(), Suspense -- stable since React 16.6, no breaking changes in React 19
- Vite 6.4 automatic code splitting: dynamic imports auto-split into separate chunks -- core Vite behavior
- Source code analysis: App.tsx, Layout.tsx, vite.config.ts, all page components

### Secondary (MEDIUM confidence)
- Named-export wrapper pattern: `.then(m => ({ default: m.ExportName }))` -- well-established community pattern, documented in React docs issues

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - React.lazy + Suspense are mature, stable APIs. No new dependencies needed.
- Architecture: HIGH - Pattern is well-established (lazy route components + layout-level Suspense). Codebase analysis confirms clean integration points.
- Pitfalls: HIGH - Named-export mismatch is the primary risk and is well-understood with a known workaround.

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable APIs, unlikely to change)
