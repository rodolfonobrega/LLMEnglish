# Phase 1: Dev Mode Routing - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make dev mode (`npx vite` without Supabase) render the full Layout + Routes structure so all pages are accessible locally. Currently, dev mode in `ProtectedApp` returns only `<DiscoveryPage />` — no Layout, no sidebar, no navigation, no other routes.

This phase fixes the routing structure only. It does NOT add new features or change production behavior.

</domain>

<decisions>
## Implementation Decisions

### Mock User Fidelity
- **D-01:** Dev mode should provide a full mock user — fake name, avatar, and gamification data (XP, level, streak) — so pages render realistically and developers can see how the app looks with populated data.

### Backend Fallbacks
- **D-02:** When dev mode pages call Supabase/AI APIs that aren't available, show a friendly error message and let the user keep navigating. Don't crash the page — graceful degradation.

### Dev Mode Indicator
- **D-03:** Show a subtle top banner in dev mode saying something like "Dev mode — some features unavailable" so developers know they're not looking at production behavior.

### Claude's Discretion
- Exact mock user data values (name, avatar URL, XP numbers)
- Banner styling and exact text
- How to structure the mock auth provider (inline in App.tsx vs separate module)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Routing & Auth
- `src/App.tsx` — Current routing structure with dev mode bypass (lines 20-28 are the problematic dev mode block)
- `src/contexts/AuthContext.tsx` — Auth provider that needs to support mock user in dev mode
- `src/components/layout/Layout.tsx` — Layout wrapper with Sidebar, Header, Navigation, Outlet

### Data Dependencies
- `src/services/storage.ts` — localStorage storage used when Supabase is unavailable
- `src/services/gamification.ts` — Gamification logic that pages may call
- `src/services/runtimeState.ts` — Runtime state singleton hydrated from Supabase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Layout` component: Already exists with Sidebar, Header, Navigation, Outlet — just needs to be used in dev mode
- `AuthContext`: Already wraps the entire app — needs to return mock user in dev mode
- `storage.ts` (localStorage): Already serves as fallback when Supabase is unavailable

### Established Patterns
- Dev mode check: `import.meta.env.DEV` already used in `ProtectedApp`
- Route structure: All routes already defined under `<Layout>` in the production path
- localStorage prefix `el_` for keys

### Integration Points
- `App.tsx`: Where the dev mode bypass needs to be replaced with proper Layout + Routes
- `AuthContext.tsx`: Where mock user data needs to be injected in dev mode
- Each page component: May need to handle missing Supabase gracefully

</code_context>

<specifics>
## Specific Ideas

- The fix is straightforward: instead of returning `<DiscoveryPage />` in dev mode, return the same `<Layout>` wrapped route structure that production uses, just without the auth gate
- The mock user should be realistic enough that pages render with visible data, not empty states

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-dev-mode-routing*
*Context gathered: 2026-04-01*
