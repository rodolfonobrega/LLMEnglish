# Phase 1: Dev Mode Routing - Research

**Researched:** 2026-04-01
**Domain:** React Router routing, AuthContext mocking, dev-mode architecture
**Confidence:** HIGH

## Summary

Phase 1 fixes the dev mode (`npx vite` without Supabase env vars) so it renders the same Layout + Routes structure as production. Currently, `ProtectedApp` in `App.tsx` (line 22-28) returns only `<DiscoveryPage />` when `import.meta.env.DEV` is true, bypassing Layout entirely. The Layout component (with Sidebar, Header, Navigation, Outlet) and all route definitions already exist in the production code path -- the fix is to make dev mode use them.

The AuthContext already has a dev-mode bypass (line 57-59 of `AuthContext.tsx`) that sets `loading` to false and returns no user. This means `ProtectedApp` sees no user, but in dev mode it never checks -- it just returns `<DiscoveryPage />`. The fix requires: (1) AuthContext to provide a mock user in dev mode, (2) `ProtectedApp` to render Layout + Routes (same as production) instead of a bare page, and (3) a subtle banner indicating dev mode.

**Primary recommendation:** Inject mock auth data into AuthContext when dev mode is detected, and remove the dev-mode bypass in `ProtectedApp` so it falls through to the normal Layout + Routes path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dev mode should provide a full mock user -- fake name, avatar, and gamification data (XP, level, streak) -- so pages render realistically.
- **D-02:** When dev mode pages call Supabase/AI APIs that aren't available, show a friendly error message and let the user keep navigating. Don't crash the page -- graceful degradation.
- **D-03:** Show a subtle top banner in dev mode saying something like "Dev mode -- some features unavailable" so developers know they're not looking at production behavior.

### Claude's Discretion
- Exact mock user data values (name, avatar URL, XP numbers)
- Banner styling and exact text
- How to structure the mock auth provider (inline in App.tsx vs separate module)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RELI-04 | Developer can test error boundaries and routing in dev mode (dev mode uses Layout wrapper) | Routing structure analysis (App.tsx lines 59-71), AuthContext mock injection pattern, Layout component structure |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | 7.13 | Client-side routing | Already in project, provides BrowserRouter/Routes/Route/Outlet/NavLink |
| vitest | 4.0 | Test runner | Already configured in vite.config.ts with jsdom |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | -- | Component testing | Testing Layout renders correctly in dev mode |
| jsdom | 28 | DOM environment for tests | Already configured in vite.config.ts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mock user in AuthContext | Separate MockAuthProvider wrapper | Inline mock in existing AuthContext is simpler, fewer files, less indirection |

**Installation:** No new packages needed -- all dependencies already in project.

**Version verification:** Not applicable -- no new packages.

## Architecture Patterns

### Current Routing Structure (Production Path)
```
BrowserRouter
  AuthProvider
    Routes
      /login        -> LoginPage (public)
      /migrate      -> MigrationPage (public)
      /             -> Layout (sidebar + header + outlet)
        index       -> ProtectedApp -> DiscoveryPage
        /review     -> ReviewPage
        /live       -> LiveRoleplayPage
        /paths      -> PathsPage
        /exercises  -> ExercisesPage
        /library    -> LibraryPage
        /scripts    -> PracticePage
        /practice   -> PracticeHubPage
        /settings   -> SettingsPage
        /errors     -> ErrorDashboard
        /history    -> HistoryPage
```

### Current Dev Mode Problem
In `ProtectedApp` (App.tsx lines 18-47):
```typescript
function ProtectedApp() {
  const { user, loading } = useAuth();
  // Dev mode: skip auth, show UI directly
  if (import.meta.env.DEV) {
    return <DiscoveryPage />;  // <-- PROBLEM: no Layout wrapper
  }
  // ... production auth gate ...
}
```
This means dev mode renders ONLY DiscoveryPage -- no sidebar, no header, no navigation, no other routes accessible.

### Recommended Fix Pattern
1. **AuthContext modification:** When `DEV && !SUPABASE_URL`, set mock user/profile/gamification instead of just `setLoading(false)`
2. **ProtectedApp modification:** Remove the dev-mode early return entirely -- let it fall through to the normal `<DiscoveryPage />` at the end (which already works when user is present)
3. **Dev banner:** Add a small component rendered inside Layout that shows when `import.meta.env.DEV && (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY)`

### Key File Change Map
```
src/App.tsx                    -- Remove dev-mode bypass in ProtectedApp
src/contexts/AuthContext.tsx    -- Inject mock user/profile in dev mode
src/services/runtimeState.ts   -- Already has defaults, no change needed
src/components/layout/         -- No changes needed (Layout, Sidebar, Header, Navigation)
NEW: src/components/layout/DevBanner.tsx  -- Dev mode indicator banner
```

### Anti-Patterns to Avoid
- **Wrapping individual routes with dev-mode checks:** Don't add conditions per route. Fix the single entry point (ProtectedApp) and auth context.
- **Creating a separate routing tree for dev mode:** Don't duplicate routes. Dev mode should use the exact same `<Route>` definitions as production.
- **Mocking Supabase client at the import level:** The Proxy-based lazy client in `client.ts` already handles missing env vars gracefully (throws on use, not on import). Don't change this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dev mode detection | Custom env var | `import.meta.env.DEV` | Already used in codebase, Vite standard |
| Supabase availability check | Custom function | `!import.meta.env.VITE_SUPABASE_URL \|\| !import.meta.env.VITE_SUPABASE_ANON_KEY` | Already used in AuthContext line 57 |
| Mock gamification data | Complex mock builder | `runtimeState.ts` defaults (DEFAULT_GAMIFICATION) | Already defined in runtimeState.ts lines 11-19 |

**Key insight:** The codebase already has most of the pieces -- Layout, routes, localStorage fallback (`storage.ts`), runtime state defaults, dev-mode env check. The fix is about wiring them together, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Supabase Proxy Will Throw on Any Storage Call
**What goes wrong:** Pages like `LibraryPage`, `ReviewPage`, `PathsPage` all call `supabase/storage.ts` functions directly. The Proxy in `client.ts` throws "Supabase configuration missing" when env vars are absent.
**Why it happens:** The Proxy-based lazy getter defers the throw until actual method access, but every Supabase storage call will trigger it.
**How to avoid:** Pages must have try/catch around their Supabase calls. In dev mode, these will fail -- D-02 says show friendly error, don't crash. This is existing behavior that pages may or may not handle already.
**Warning signs:** White screen or uncaught error when navigating to `/library`, `/review`, `/paths` in dev mode.

### Pitfall 2: Mock User ID Must Be Consistent
**What goes wrong:** If `AuthContext` provides a mock user with ID "dev-user" but `runtimeState.ts` or `storage.ts` expects a real UUID format, things may break.
**Why it happens:** Some Supabase queries may validate UUID format.
**How to avoid:** Use a realistic UUID for the mock user ID. Since this is client-side only and never hits Supabase, any UUID format works, but being consistent avoids future surprises.
**Warning signs:** Type errors or validation failures in components that use `user.id`.

### Pitfall 3: ProtectedApp Returns DiscoveryPage Regardless
**What goes wrong:** Even in production, `ProtectedApp` currently returns `<DiscoveryPage />` at the end (line 43-46). The index route always shows DiscoveryPage.
**Why it happens:** The current code has `DiscoveryPage` as both the dev-mode return AND the authenticated return.
**How to avoid:** This is actually correct -- the index route (`/`) should show DiscoveryPage. The fix is just to ensure Layout wraps it in dev mode too.
**Warning signs:** None -- this is working as intended.

### Pitfall 4: Sidebar Reads Gamification from localStorage storage.ts
**What goes wrong:** Sidebar imports `getGamification` from `storage.ts` (localStorage), not from `supabase/storage.ts`. It calls `getRuntimeGamification()` under the hood. If runtime state has defaults (0 XP, level 1, 0 streak), the sidebar will show but look empty.
**Why it happens:** D-01 requires realistic gamification data. The mock must populate runtime state with non-zero values.
**How to avoid:** When injecting mock user in AuthContext, also call `setRuntimeGamification()` with populated mock data (non-zero XP, level > 1, streak > 0).
**Warning signs:** Sidebar shows "NIVEL 1" with no streak -- not realistic per D-01.

### Pitfall 5: SettingsPage Uses `useAuth()` for signOut
**What goes wrong:** SettingsPage calls `const { user, profile, signOut, refreshProfile } = useAuth()`. If mock user doesn't support `signOut` gracefully, clicking sign out could throw.
**Why it happens:** `signOut` calls `supabase.auth.signOut()` which will throw without Supabase.
**How to avoid:** Mock `signOut` in dev mode to just reset state (or show a toast saying "sign out not available in dev mode").
**Warning signs:** Error thrown when clicking sign out in Settings during dev mode.

## Code Examples

### Mock User Injection Pattern (AuthContext.tsx)
```typescript
// At the top of AuthContext.tsx or in a separate mock module
const MOCK_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dev@spealkab.local',
};

const MOCK_PROFILE: Profile = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  profile: 'English learner practicing daily',
  interests: 'Technology, Music, Travel',
  goals: 'Fluent conversation',
  current_level: 'Intermediate',
  conversation_tone: 'balanced',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
```

### AuthContext Dev Mode Injection (existing line 57-59 replacement)
```typescript
// Replace:
//   if (import.meta.env.DEV && (!...)) {
//     setLoading(false);
//     return;
//   }

// With:
if (import.meta.env.DEV && (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  setUser(MOCK_USER);
  setProfile(MOCK_PROFILE);
  setRuntimeGamification(MOCK_GAMIFICATION);
  setLoading(false);
  return;
}
```

### ProtectedApp Fix (App.tsx)
```typescript
function ProtectedApp() {
  const { user, loading } = useAuth();

  // REMOVE the entire dev-mode block (lines 22-28)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <DiscoveryPage />;
}
```

### DevBanner Component
```typescript
// src/components/layout/DevBanner.tsx
export function DevBanner() {
  if (!import.meta.env.DEV) return null;
  if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) return null;

  return (
    <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-center text-xs py-1.5 px-4 font-medium">
      Dev mode -- some features unavailable (no Supabase connection)
    </div>
  );
}
```
Place inside Layout.tsx, above the Header.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import.meta.env.DEV` used to skip auth | Same check, but now should also provide mock data | N/A (this phase) | Dev mode becomes useful for all pages, not just DiscoveryPage |

**Deprecated/outdated:**
- None for this phase.

## Open Questions

1. **Page-level error handling for Supabase calls**
   - What we know: Most pages import directly from `supabase/storage.ts`. The Proxy client throws when env vars are missing.
   - What's unclear: Whether existing pages already have try/catch that would handle this gracefully, or if they'll crash with uncaught errors.
   - Recommendation: Planner should include a task to verify each page's error handling in dev mode. Pages that crash need graceful error display per D-02.

2. **Mock `signOut` behavior**
   - What we know: `signOut` in auth.ts calls `supabase.auth.signOut()` which will throw.
   - What's unclear: Whether AuthContext should override the signOut function in dev mode.
   - Recommendation: Provide a no-op or `window.location.reload()` mock for signOut in dev mode.

## Environment Availability

> Step 2.6: SKIPPED (no external dependencies identified -- this phase is purely code/config changes to existing React components)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vite.config.ts (inline test config) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RELI-04 | Dev mode renders Layout with Sidebar, Header, Navigation | unit | `npx vitest run src/App.test.tsx -t "dev mode"` | No -- Wave 0 |
| RELI-04 | Dev mode provides mock authenticated user | unit | `npx vitest run src/contexts/AuthContext.test.tsx -t "mock user"` | No -- Wave 0 |
| RELI-04 | All routes accessible in dev mode | unit | `npx vitest run src/App.test.tsx -t "routes"` | No -- Wave 0 |
| RELI-04 | Dev banner shown when no Supabase env vars | unit | `npx vitest run src/components/layout/DevBanner.test.tsx` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/App.test.tsx` -- covers dev mode rendering with Layout
- [ ] `src/contexts/AuthContext.test.tsx` -- covers mock user injection
- [ ] `src/components/layout/DevBanner.test.tsx` -- covers banner visibility logic
- [ ] May need `@testing-library/react` installed: `npm install -D @testing-library/react @testing-library/jest-dom`

## Sources

### Primary (HIGH confidence)
- Code analysis of `src/App.tsx`, `src/contexts/AuthContext.tsx`, `src/components/layout/Layout.tsx`
- Code analysis of `src/services/supabase/client.ts`, `src/services/runtimeState.ts`
- Code analysis of `src/config/navigation.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Header.tsx`

### Secondary (MEDIUM confidence)
- Grep analysis of Supabase import usage across page components

### Tertiary (LOW confidence)
- None -- all findings from direct code analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing codebase analysis
- Architecture: HIGH -- routing structure, auth flow, and Layout component fully understood from source
- Pitfalls: HIGH -- identified from direct code analysis of Supabase Proxy, storage imports, and page dependencies

**Research date:** 2026-04-01
**Valid until:** 2026-04-30 (stable codebase, no external dependencies)
