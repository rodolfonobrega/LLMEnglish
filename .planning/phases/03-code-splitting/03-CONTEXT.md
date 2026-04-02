# Phase 3: Code Splitting - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Lazy-load all page routes so users only download code for the page they're viewing, with skeleton loading feedback during navigation. Heavy vendor deps (jspdf) ride along in their respective page chunks automatically.

</domain>

<decisions>
## Implementation Decisions

### Loading Indicator Style
- **D-01:** Use a **generic skeleton screen** as the Suspense fallback for all route transitions — gray placeholder shapes that feel fast and native
- **D-02:** One skeleton component reused across all routes (no per-page custom skeletons) — consistent and minimal maintenance

### Splitting Scope & Granularity
- **D-03:** **Route-level only** — apply `React.lazy()` to all 10 page route components in `App.tsx`. No `manualChunks` vendor extraction needed
- **D-04:** `jspdf` (~500KB) naturally lands in the PracticePage chunk since it's only imported there — no extra config needed
- **D-05:** `motion` library is listed in PERF-03 but is **NOT imported anywhere in `src/`** — already tree-shaken by Vite, no action needed. PERF-03 is satisfied by the jspdf extraction alone

### Loading Boundary Placement
- **D-06:** **Single layout-level Suspense** boundary wrapping `<Outlet/>` in `Layout.tsx` — one place to maintain, all routes share the generic skeleton
- **D-07:** Route-level `errorElement` (from Phase 2) handles chunk load failures via `ChunkErrorFallback` with `resetErrorBoundary()` — Suspense only handles the loading state, not errors

### Claude's Discretion
- Exact skeleton component design (shape, pulse animation, spacing)
- How to structure the lazy imports in App.tsx (inline vs separate loader module)
- Whether to add a minimum delay before showing skeleton (avoid flash on fast loads)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Routing & Error Boundaries
- `src/App.tsx` — Current eager route definitions (lines 46-66) to convert to lazy imports
- `src/components/layout/Layout.tsx` — Layout wrapper where Suspense boundary will wrap `<Outlet/>`
- `src/components/errors/ChunkErrorFallback.tsx` — Already built for chunk load failure retry (Phase 2)
- `src/components/errors/ErrorFallback.tsx` — Route-level error boundary fallback (Phase 2)

### Heavy Dependencies
- `src/components/practice/PracticePage.tsx` — Only file importing `jspdf` (line 2), naturally isolated by route-level splitting
- `src/services/geminiLive.ts` — Imports `@google/genai`, shared across pages via services

### Prior Phase Context
- `.planning/phases/01-dev-mode-routing/01-CONTEXT.md` — Dev mode routing decisions

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChunkErrorFallback`: Already exists with retry button — handles chunk load errors so Phase 3 only needs Suspense for loading state
- Route-level `errorElement`: Already configured on every `<Route>` in App.tsx — error handling is covered

### Established Patterns
- All 10 page routes are eagerly imported in App.tsx — straightforward conversion to `React.lazy()`
- Layout wraps routes with sidebar/header — Suspense goes inside Layout around `<Outlet/>`
- Dev mode uses `import.meta.env.DEV` — lazy loading works in both dev and production

### Integration Points
- `App.tsx`: Where eager imports become `React.lazy()` calls
- `Layout.tsx`: Where `<Suspense fallback={<Skeleton />}>` wraps `<Outlet/>`
- `vite.config.ts`: No chunk config needed — Vite auto-splits lazy imports

</code_context>

<specifics>
## Specific Ideas

- `motion` library is dead weight in `package.json` (zero imports) — PERF-03 concern about it is already handled by tree-shaking
- The 10 route components to lazy-load: ProtectedApp, ReviewPage, LiveRoleplayPage, PathsPage, ExercisesPage, LibraryPage, PracticePage, PracticeHubPage, SettingsPage, ErrorDashboard, HistoryPage

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-code-splitting*
*Context gathered: 2026-04-02*
