# Pitfalls Research

**Domain:** React SPA hardening (error boundaries, code splitting, secure storage, storage consolidation, UI redesign) for an English learning app
**Researched:** 2026-04-01
**Confidence:** HIGH (grounded in codebase analysis + React documentation; web search was unavailable but domain is well-established)

## Critical Pitfalls

### Pitfall 1: Error Boundary Granularity Mismatch

**What goes wrong:**
A single error boundary at the app root means any component crash (even a trivial one in a sidebar widget) replaces the entire screen with an error fallback. Users lose all context and must reload. Conversely, wrapping every individual component in its own boundary creates massive boilerplate and makes error recovery confusing -- users see tiny error boxes embedded in otherwise functional pages.

**Why it happens:**
Error boundaries are class components, which feel foreign in a function-component codebase. Teams default to either "one big boundary at the root" (easiest) or "use a library wrapper everywhere" (cargo-culting). SpeakLab currently has zero error boundaries, so the first implementation is the riskiest -- there is no existing pattern to follow, and the placement decision will set the convention for the entire app.

**How to avoid:**
Place boundaries at meaningful **feature sections**, not per-component and not per-app. For SpeakLab specifically:
- One boundary wrapping the `<Layout>` route content area (catches page-level crashes while preserving sidebar/navigation)
- One boundary around the live roleplay session area (crashes here should not lose the entire page)
- One boundary around AI-generated content display areas (unpredictable content is the most likely crash source)

Use `react-error-boundary` library for a hooks-friendly API. Keep fallback UI extremely simple -- no complex rendering, no lazy-loaded dependencies.

**Warning signs:**
- Error fallback UI itself crashes (too complex)
- Users report "the whole app went white" after a minor glitch (boundary too high)
- Error boundaries wrapping every single component import (boundary too granular)
- Error state resets but the component immediately re-crashes in a loop (no key-based remount)

**Phase to address:**
Phase 1 (Error Boundaries). This is the foundational hardening step -- everything else builds on top of the app not whitescreening.

---

### Pitfall 2: Error Recovery Infinite Loop

**What goes wrong:**
After an error boundary catches a crash and the user clicks "Try Again", the boundary resets its `hasError` state and re-renders the children. But if the underlying cause hasn't changed (e.g., malformed data in state, a null reference from a missing prop), the component immediately throws again, resetting again, in an infinite loop. The UI flickers rapidly between the error fallback and the crashing component.

**Why it happens:**
`getDerivedStateFromError` / `resetErrorBoundary` simply toggles a boolean. The component tree remounts with the same props and state that caused the original crash. This is especially likely in SpeakLab because `runtimeState.ts` uses a mutable global singleton (`let state`) that may contain stale or malformed data from a previous failed operation.

**How to avoid:**
- Always remount the recovered component tree with a new `key` on reset (e.g., `key={retryCount}`). This forces React to destroy and recreate the component with fresh state.
- For data-related crashes, clear the relevant runtime state slice before retrying. Never retry with the same data that caused the crash.
- Log the error to `console.error` with `errorInfo.componentStack` (not just the error message) so developers can diagnose the root cause.

**Warning signs:**
- Rapid flickering between error UI and content after clicking "Try Again"
- Browser CPU spike after error recovery attempt
- Error boundary's `componentDidCatch` firing multiple times per second

**Phase to address:**
Phase 1 (Error Boundaries). Recovery behavior is part of the boundary implementation, not an afterthought.

---

### Pitfall 3: Code Splitting Without Error Boundaries on Lazy Routes

**What goes wrong:**
`React.lazy()` + `Suspense` is added to route components. When a user navigates to a route and the chunk fails to load (network timeout, CDN issue, deploy during active session), React throws a chunk load error. Without an error boundary wrapping the `<Suspense>`, this error propagates up and whitescreens the entire app -- the exact same failure mode the error boundaries were supposed to prevent.

**Why it happens:**
Code splitting and error boundaries are typically implemented in separate tasks. The person adding `React.lazy()` wraps it in `<Suspense fallback={<Loading />}>` but forgets that Suspense handles loading states, not error states. Chunk load failures are not "suspended" -- they are thrown errors.

**How to avoid:**
Every `<Suspense>` wrapping a `React.lazy()` component MUST be wrapped by an error boundary. In SpeakLab's `App.tsx`, the `<Route>` elements currently import components directly. When converting to lazy imports, wrap each route's element in both `<Suspense>` AND an error boundary:

```tsx
// WRONG:
<Route path="settings" element={<Suspense fallback={<Loading />}><LazySettings /></Suspense>} />

// RIGHT:
<Route path="settings" element={
  <ErrorBoundary fallback={<ChunkErrorFallback />}>
    <Suspense fallback={<Loading />}>
      <LazySettings />
    </Suspense>
  </ErrorBoundary>
} />
```

**Warning signs:**
- Lazy-loaded routes work in development (chunks load instantly from disk) but fail in production on slow networks
- Error boundary wrapping Layout but not individual routes (a chunk failure still takes down the entire route area)
- No test for chunk-load failure scenarios

**Phase to address:**
Phase 1 (Error Boundaries) and Phase 2 (Code Splitting) must be coordinated. Error boundaries MUST be in place before any lazy loading is added. If code splitting is implemented first, the app becomes MORE fragile, not less.

---

### Pitfall 4: Layout Shift from Empty Suspense Fallbacks

**What goes wrong:**
`<Suspense fallback={null}>` or `<Suspense fallback={<div>Loading...</div>}>` causes the page to render as empty or minimal while the chunk loads, then snap to full content. This creates visible Cumulative Layout Shift (CLS). For SpeakLab, this is especially bad on the Praticar page where image-banner cards loading in would push content down, making the page feel janky.

**Why it happens:**
Developers use `null` or minimal text as fallback because creating proper skeleton UI feels like premature polish. But layout shift is a core web vital -- Google penalizes it, and users perceive it as broken.

**How to avoid:**
- Every `<Suspense>` fallback MUST reserve the same spatial dimensions as the content it replaces. Use skeleton components (pulsing rectangles) with explicit heights.
- For route-level suspense in SpeakLab: use a full-page skeleton that matches the Layout structure (sidebar space + content area skeleton).
- For the Praticar page specifically: if ModeCards are lazy-loaded, the skeleton should match the card grid dimensions, not just show a spinner.

**Warning signs:**
- Content "pops in" visually when navigating between routes
- Lighthouse CLS score above 0.1
- Blank white flash between route transitions

**Phase to address:**
Phase 2 (Code Splitting). Skeletons should be built alongside lazy loading, not added later.

---

### Pitfall 5: Client-Side Encryption as Security Theater

**What goes wrong:**
The milestone calls for "encrypt API keys at rest." The codebase already has `encryption.ts` using AES-256-GCM via Web Crypto API -- but the encryption key is derived from `userId + sessionSecret`, where `sessionSecret` falls back to the hardcoded string `'fallback-secret-change-in-production'` (line 190 of encryption.ts). This means the encryption is bypassable by anyone who reads the source code. Adding more client-side encryption does not meaningfully improve security -- it just adds complexity and a false sense of safety.

**Why it happens:**
Client-side encryption is fundamentally limited because the decryption key must also be available client-side. There is no way to store a secret in the browser that JavaScript cannot access. The existing code even acknowledges this: `getSessionSecret()` tries localStorage, then sessionStorage, then gives up and uses a plaintext fallback.

**How to avoid:**
- Accept the architectural reality: client-side encryption is obfuscation, not security. Document it honestly.
- The REAL fix is routing all AI API calls through the Supabase Edge Function proxy (`aiProxy.ts`), which already exists. The proxy holds server-side keys that never reach the browser.
- For Gemini Live (which requires a direct WebSocket and thus exposes the key): document this as an accepted risk, scope the key to Gemini Live endpoints only, and warn users that this specific mode sends their API key to the browser.
- Do NOT invest time in "improving" client-side encryption (better key derivation, rotating salts, etc.) -- that effort should go into expanding proxy coverage.
- Remove the hardcoded fallback secret entirely. `getSessionSecret()` should throw or return `null` when no session exists, not silently fall back to a known string.

**Warning signs:**
- PR descriptions say "encrypts API keys" without mentioning that the decryption key is also client-side
- Tests only verify that encryption/decryption round-trips, not that an attacker couldn't also decrypt
- The fallback secret string still exists in the codebase after "hardening"

**Phase to address:**
Phase 3 (Secure Storage). This phase should be scoped as "route API calls through proxy + remove hardcoded secrets" not "add more client-side encryption."

---

### Pitfall 6: Dual Storage Removal Breaks Import Chains

**What goes wrong:**
The milestone calls for consolidating the dual storage layer (`src/services/storage.ts` localStorage vs `src/services/supabase/storage.ts` Supabase). Both export identical function names (`getCards`, `saveCards`, `getApiKey`, etc.). Removing `storage.ts` without auditing every import path causes silent failures where components import from the deleted module, get `undefined` at runtime, and crash -- but only in specific code paths.

**Why it happens:**
`runtimeState.ts` imports from `./supabase/storage`, but the old `storage.ts` still exists and may be imported directly by other files or tests. JavaScript module resolution doesn't warn when an import path becomes ambiguous -- it just resolves to whichever file the import statement specifies. A global find-replace of import paths can miss dynamic imports, re-exports, or barrel files.

**How to avoid:**
1. Before deleting `storage.ts`, grep for ALL imports of it: `from '../services/storage'`, `from '../../services/storage'`, `from './storage'` (without `supabase/` prefix).
2. Rename `storage.ts` to `storage.local.ts` FIRST (or `storage.deprecated.ts`) -- this breaks nothing but makes incorrect imports immediately visible as TypeScript errors (module not found).
3. Fix all broken imports to point to `./supabase/storage`.
4. Only after all imports are verified, delete the old file.
5. Run the full app in dev mode AND with Supabase connected. Exercise every feature.

**Warning signs:**
- After removing `storage.ts`, TypeScript compiles without errors but runtime crashes with "is not a function" on storage calls
- Features work in dev mode (no Supabase) but break in authenticated mode (the Supabase path was never tested)
- Import paths like `from './storage'` still exist alongside `from './supabase/storage'`

**Phase to address:**
Phase 4 (Storage Consolidation). This MUST be done as a dedicated phase with thorough manual testing, because it touches the data layer of the entire app.

---

### Pitfall 7: Praticar Redesign Breaks Navigation Semantics

**What goes wrong:**
The current `ModeCard` is a `<button>` element with `onClick` navigation. Redesigning to image-banner cards similar to `PathCard` (which is a `<div>` with `onClick`) changes the element semantics. Screen readers and keyboard users lose the ability to activate cards via Enter/Space. Additionally, if the new card layout uses different grid proportions than PathCard but shares similar visual language, users may confuse the Praticar page with the Trilhas page and navigate to the wrong section.

**Why it happens:**
Visual redesign focuses on appearance, not interaction semantics. `PathCard` uses a `<div>` with `onClick` -- not a `<button>` or `<a>`. Copying this pattern for the redesigned Praticar cards perpetuates an accessibility regression. The current `ModeCard` actually has better accessibility (it is a `<button>` with `focus-visible` styles).

**How to avoid:**
- The redesigned Praticar card MUST use `<button>` or `<a>` semantics (or `role="button"` + `tabIndex={0}` + keyboard handlers at minimum).
- Maintain the `focus-visible` ring styles that the current `ModeCard` already has.
- Use visually distinct proportions from `PathCard` -- not just different images, but different card heights, border radius, or layout direction. The milestone says "different proportions" -- make this an explicit design decision, not an afterthought.
- Test that Tab navigation reaches all practice mode cards and Enter/Space activates them.

**Warning signs:**
- New cards are `<div>` elements with only `onClick` (no keyboard support)
- Cards look identical to Trilhas cards at first glance
- Tab navigation skips over the redesigned cards

**Phase to address:**
Phase 5 (Praticar Redesign). Build accessibility into the new card component from the start, not as a retrofit.

---

### Pitfall 8: Dev Mode Divergence Hides Production Bugs

**What goes wrong:**
`App.tsx` lines 22-28 show that dev mode (`import.meta.env.DEV`) renders `<DiscoveryPage />` directly, bypassing both authentication AND the `<Layout>` wrapper. This means no sidebar, no navigation, and no protected routes in dev mode. Any developer working on SettingsPage, ReviewPage, LiveRoleplayPage, or any other protected route cannot navigate to their page in dev mode.

More critically: when adding error boundaries or code splitting, the dev-mode code path is completely different from the production code path. Error boundaries placed inside `<Layout>` will never fire in dev mode. Lazy-loaded routes inside the `<Routes>` block will never be tested in dev mode. Features that work perfectly in dev mode will behave differently in production.

**Why it happens:**
The dev bypass was added for convenience (skip auth, show UI fast). But it creates two separate app architectures that diverge over time. Each new feature added to the main route structure is invisible in dev mode.

**How to avoid:**
- Fix dev mode to render the SAME `<Layout>` + `<Routes>` structure as production, but with a mock authenticated user.
- If auth-skipping is needed for DX, inject a fake user into `AuthProvider` rather than bypassing the entire router structure.
- This fix should be Phase 0 or part of Phase 1 -- before adding error boundaries and code splitting that will be untestable in dev mode otherwise.

**Warning signs:**
- Developers say "it works on my machine" but production has errors
- Dev mode shows a completely different page structure than production
- New features (error boundaries, lazy loading) are only testable by deploying or connecting to Supabase

**Phase to address:**
Phase 1 (Error Boundaries). Fix dev mode routing FIRST so that error boundaries and lazy loading can be tested locally.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| One root-level error boundary | Quick fix, 5 minutes | Entire app whitescreens for minor widget failures | First hour of Phase 1, then replace with granular boundaries |
| `Suspense fallback={null}` | Less code, no skeleton to build | Layout shift, perceived jank, CLS penalty | Never in production routes |
| Keep both storage.ts files during migration | Nothing breaks during transition | Import confusion persists, bugs fixed in one file but not the other | Acceptable only during Phase 4, must remove by end of phase |
| Hardcoded encryption fallback | App doesn't crash when session is missing | Encryption is meaningless, false security | Never -- throw an error instead |
| Skip dev mode Layout fix | Save time, focus on "real" features | Error boundaries and lazy loading untestable locally | Never -- this blocks testing of all other hardening work |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `react-error-boundary` + `React.lazy()` | Wrapping `<Suspense>` without an error boundary | Every `<Suspense>` for lazy components needs a sibling `<ErrorBoundary>` |
| Supabase Edge Function proxy | Forgetting to update `openai.ts` dispatch to use proxy for new providers | After expanding proxy coverage, audit ALL direct API call paths in `openai.ts` |
| Web Crypto API `deriveKey` | Using `false` for `extractable` parameter then trying to export the key | Decide upfront whether the key needs to be exportable; for encryption-only keys, `false` is correct |
| React Router lazy routes | Forgetting that `<Route element={...}>` does not re-mount on param changes | Add `key` based on route params when needed for forced remount |
| Tailwind dark mode | Using hardcoded color classes instead of CSS variables in new card components | Use `hsl(var(--mode-*))` pattern from existing `ModeCard`, not hardcoded hex colors |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eagerly loading all route chunks | Initial bundle >500KB, slow first paint on mobile | Lazy-load ALL route components except the index/landing route | Immediate -- SpeakLab already ships jspdf and motion in the initial bundle |
| Lazy-loading above-the-fold content | Visible loading flash on the landing page | Keep the landing/index route eagerly loaded; only lazy-load secondary routes | Immediately noticeable on 3G connections |
| No prefetching on hover | Navigation to lazy routes always shows a loading state | Use `React.preload()` (React 19) on link hover to prefetch chunks | Noticeable when users click through pages quickly |
| Skeleton fallback has wrong dimensions | Content shifts when real component loads | Match skeleton dimensions exactly to real content; use same grid layout | Visible as layout "jump" on every route transition |
| `runtimeState` window events on every state change | Broad re-renders across many components after any state update | When consolidating storage, also audit `emitRuntimeUpdate()` listeners | Gets worse as component count grows |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Keeping the `'fallback-secret-change-in-production'` string | Any attacker who reads the source can decrypt all "encrypted" API keys | Remove the fallback entirely; throw an error when no session token exists |
| Adding more client-side encryption instead of expanding proxy use | Wastes development time on security theater; real keys still accessible via XSS | Prioritize routing API calls through the Supabase Edge Function proxy |
| Forgetting that Gemini Live exposes the raw key to the client | Users may not realize this mode sends their API key into browser memory | Document the risk clearly in the UI; warn before enabling Gemini Live mode |
| Groq direct path still exists in production builds | If the Edge Function fallback fails, raw Groq key could be exposed | Ensure `GROQ_BASE = '/api/groq'` only works in dev mode; production must use proxy |
| Plaintext localStorage keys remain during migration | Dual storage means some keys are still in plaintext even after "encryption" is added | Remove localStorage API key storage entirely; proxy is the only secure path |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Generic "Something went wrong" error screen | User doesn't know if their progress was saved or what to do next | Contextual error messages: "Your practice session had an error. Your progress was saved. Tap to retry." |
| Full-page loading spinner on route transitions | App feels slow and unresponsive; users think it froze | Route-specific skeletons that match the destination page layout |
| Praticar cards identical to Trilhas cards | Users navigate to the wrong section; confusion about where they are | Use distinct proportions (e.g., shorter height, horizontal layout option, different border radius) |
| Error recovery resets user's work | User fills out a long form, a crash occurs, and all input is lost | Preserve critical user state (form input, audio recording) outside the error boundary's component tree |
| Dev mode shows different UI than production | Developers build features that look right in dev but broken in production | Dev mode must use the same Layout and routing structure as production |

## "Looks Done But Isn't" Checklist

- [ ] **Error Boundaries:** Often missing recovery mechanism -- verify "Try Again" button actually remounts with a new `key`, not just toggles state
- [ ] **Error Boundaries:** Often missing `errorInfo.componentStack` logging -- verify errors are logged with component trace, not just message
- [ ] **Code Splitting:** Often missing error boundary around Suspense -- verify chunk-load failures are caught, not just loading states
- [ ] **Code Splitting:** Often missing skeleton fallbacks with correct dimensions -- verify CLS score is not worse after splitting
- [ ] **Secure Storage:** Often "encrypts" but keeps the decryption key client-side -- verify the proxy path actually works end-to-end for ALL AI providers
- [ ] **Secure Storage:** Often removes localStorage keys but forgets to update `runtimeState.ts` `envKeys` fallback -- verify keys come from proxy, not `import.meta.env`
- [ ] **Storage Consolidation:** Often removes old file but misses import paths -- verify TypeScript compilation catches all broken imports (rename file first)
- [ ] **Praticar Redesign:** Often copies PathCard's `<div>` + `onClick` pattern -- verify new cards are keyboard-accessible (`<button>` or `role="button"`)
- [ ] **Praticar Redesign:** Often looks identical to Trilhas -- verify cards have visually distinct proportions, not just different images
- [ ] **Dev Mode Fix:** Often fixes auth bypass but forgets Layout wrapper -- verify sidebar and navigation appear in dev mode

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Root-level error boundary too broad | LOW | Add inner boundaries around feature sections; no code removal needed |
| Error recovery infinite loop | MEDIUM | Add key-based remount + clear stale runtime state on retry |
| Missing error boundary on lazy routes | LOW | Wrap existing Suspense with ErrorBoundary; additive change |
| Empty Suspense fallbacks | LOW | Replace `null`/text with skeleton components; no structural change |
| Client-side encryption as security theater | HIGH | Must refactor API call paths through Edge Function proxy; touches `openai.ts` dispatch logic |
| Dual storage removal breaks imports | HIGH | Revert deletion, rename file to surface broken imports, fix one by one |
| Praticar redesign breaks accessibility | MEDIUM | Add semantic elements and keyboard handlers; may require component rewrite |
| Dev mode routing divergence | LOW | Fix ProtectedApp to render Layout + Routes with mock user |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Dev mode routing divergence | Phase 1 (before error boundaries) | Dev mode shows sidebar + all routes navigable |
| Error boundary granularity | Phase 1 | Trigger error in live roleplay widget; sidebar stays visible |
| Error recovery infinite loop | Phase 1 | Click "Try Again" on error; component remounts cleanly, no flicker |
| Missing boundary on lazy routes | Phase 2 (after Phase 1) | Disable network mid-navigation; chunk error shows fallback, not whitescreen |
| Layout shift from Suspense fallbacks | Phase 2 | Lighthouse CLS score < 0.1 on all route transitions |
| Client-side encryption theater | Phase 3 | All AI calls route through proxy; no hardcoded fallback secret in codebase |
| Dual storage removal breaks imports | Phase 4 | TypeScript compiles zero errors; all features work in both dev and auth modes |
| Praticar redesign accessibility | Phase 5 | Tab navigation reaches all cards; Enter/Space activates them; cards visually distinct from Trilhas |

## Phase Ordering Rationale

The pitfalls reveal a strict dependency chain:

1. **Dev mode fix** must come first because error boundaries and code splitting cannot be tested locally without proper routing.
2. **Error boundaries** must come before code splitting because lazy-loaded chunks can fail, and without boundaries, chunk failures whitescreen the app (making it MORE fragile than before).
3. **Code splitting** comes next because it depends on both the dev mode fix (for testing) and error boundaries (for chunk failure handling).
4. **Secure storage** is independent of the above but should not be attempted while the dual storage layer exists (you'd be "securing" a layer that's about to be removed).
5. **Storage consolidation** comes after secure storage because you want to consolidate into the SECURE path, not the old localStorage path.
6. **Praticar redesign** is last because it's purely visual and does not depend on any of the hardening work (though it should use the consolidated storage).

## Sources

- React documentation: Error Boundaries (`react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary`)
- React documentation: `React.lazy()` and code splitting (`react.dev/reference/react/lazy`)
- `react-error-boundary` library by Brian Vaughn (React team): recommended for function-component ergonomics
- Codebase analysis: `src/App.tsx`, `src/utils/encryption.ts`, `src/services/storage.ts`, `src/services/runtimeState.ts`, `src/components/shared/ModeCard.tsx`, `src/components/ui/custom/PathCard.tsx`
- Project concerns audit: `.planning/codebase/CONCERNS.md`

---
*Pitfalls research for: SpeakLab React SPA Hardening*
*Researched: 2026-04-01*
