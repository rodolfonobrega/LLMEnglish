# Stack Research: React SPA Hardening

**Domain:** React 19 + Vite SPA hardening (error boundaries, code splitting, secure storage)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React `lazy` + `Suspense` | Built-in (React 19.2) | Route-level code splitting | Zero dependencies. React 19 supports `lazy` natively with full Suspense integration. Vite automatically code-splits any `import()` into separate chunks -- no extra config. This is the standard pattern, not a library choice. |
| `react-error-boundary` | 6.1.1 | Declarative error boundaries with hooks API | React error boundaries still require class components under the hood. This library wraps that with a clean functional API: `<ErrorBoundary fallbackRender={...} onError={logToService}>`. Provides `useErrorBoundary()` hook for programmatic error throwing in async code. Community standard, maintained by Brian Vaughn (React team). |
| Web Crypto API (`crypto.subtle`) | Built-in (browser) | AES-256-GCM encryption for API keys at rest | Already partially implemented in `src/utils/encryption.ts`. The codebase already uses PBKDF2 + AES-GCM -- no new library needed. Fix the existing issues (hardcoded fallback secret, low PBKDF2 iterations, deterministic salt) instead of introducing a new encryption library. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rollup-plugin-visualizer` | 7.0.1 | Bundle analysis to verify chunk sizes after splitting | Dev-only. Run after implementing code splitting to verify chunks are in the 20-50KB gzipped range. Use `open: true` to see the treemap. |

## Installation

```bash
# Production dependency (the only new one)
npm install react-error-boundary@6

# Dev dependency for bundle analysis
npm install -D rollup-plugin-visualizer@7
```

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@loadable/component` | Unmaintained, designed for SSR frameworks, unnecessary for SPA. React 19 `lazy` covers all use cases. | `React.lazy` |
| `react-lazy` (npm) | Different library, not the official React API. Name is confusing. | `React.lazy` from `'react'` |
| Custom error boundary class components | Verbose, repetitive, no hooks API. Every instance needs the same `componentDidCatch` / `getDerivedStateFromError` boilerplate. | `react-error-boundary` |
| `crypto-js` or `tweetnacl` | External crypto libraries add bundle size and attack surface. Web Crypto API is native, audited by browser vendors, and already used in the codebase. | `crypto.subtle` (built-in) |
| `localforage` or `idb-keyval` for API keys | IndexedDB is overkill for small string values (API keys). The codebase uses localStorage throughout; switching storage engines for one feature adds inconsistency. | localStorage + encryption (fix existing `encryption.ts`) |
| Sentry / Datadog for error logging | Overkill for this milestone's scope. The project doesn't have error reporting infrastructure yet. Wire up error boundary `onError` to `console.error` for now; add a service later if needed. | `onError` callback with `console.error` |
| Vite `manualChunks` for initial implementation | Manual chunk configuration adds complexity before you know the actual chunk sizes. Start with automatic splitting from `React.lazy`, then tune with `manualChunks` after visualizer analysis. | Automatic splitting first, `manualChunks` only if needed |

## Architecture Decisions

### Error Boundaries: Granular, Not Global

Use `react-error-boundary` at three levels:

1. **Route-level** -- Wrap each `<Route>` element. A crash in LiveRoleplayPage doesn't kill SettingsPage.
2. **Widget-level** -- Wrap complex isolated components (AI chat panels, exercise cards, audio players).
3. **NOT app-level** -- A single top-level boundary defeats the purpose; one crash still whitescreens everything.

Pattern for route-level:

```tsx
import { ErrorBoundary } from 'react-error-boundary'

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  )
}

// In route config:
<Route path="live" element={
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <Suspense fallback={<PageSkeleton />}>
      <LiveRoleplayPage />
    </Suspense>
  </ErrorBoundary>
} />
```

### Code Splitting: Route-Level Only

The codebase has 12 routes (App.tsx lines 55-70). Currently all page components are eagerly imported. Strategy:

1. Convert all route-level page imports to `React.lazy(() => import(...))`.
2. Wrap each lazy route in `<Suspense fallback={<PageSkeleton />}>`.
3. Heaviest wins first: `LiveRoleplayPage` (realtime AI), `ExercisesPage` (jspdf), pages using `motion`.
4. Do NOT split small utility components or shared UI -- the HTTP overhead outweighs savings.

Chunk naming via `vite.config.ts` (only after visualizer analysis shows the need):

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        'vendor-ai': ['openai'],       // if large
        'vendor-pdf': ['jspdf'],        // ~200KB, definitely split
        'vendor-motion': ['motion'],    // ~50KB
      }
    }
  }
}
```

### Secure Storage: Fix Existing Encryption, Don't Replace

The existing `src/utils/encryption.ts` has the right architecture (Web Crypto API, AES-256-GCM, PBKDF2) but three critical issues to fix:

**Issue 1: Hardcoded fallback secret (line 190)**
```
'fallback-secret-change-in-production'
```
This means encryption is effectively broken -- if the session token is missing, any attacker can decrypt. Fix: derive the secret from the Supabase session's `access_token` hash. Never fall back to a hardcoded value. If no session exists, do not decrypt.

**Issue 2: Low PBKDF2 iterations (line 89)**
```
iterations: 100000
```
OWASP 2023+ recommends 600,000+ for PBKDF2-HMAC-SHA256. Increase to 600,000. The performance impact is negligible for encrypting three small API keys once per session.

**Issue 3: Deterministic salt (line 73-75)**
```
const saltInput = encoder.encode(userId + '-salt')
const saltHash = await crypto.subtle.digest('SHA-256', saltInput)
```
The salt is derived deterministically from the user ID, making it equivalent to no salt. Fix: generate a random 16-byte salt, store it alongside the encrypted data in the existing `EncryptedData.salt` field (currently empty string on line 123).

**Storage consolidation pattern:**
- API keys: encrypt with Web Crypto, store encrypted payload in localStorage. Also sync to Supabase for cross-device access.
- Other data (cards, gamification, sessions): keep in localStorage as-is. These are not secrets.
- Remove the dual import confusion by having `storage.ts` call the encryption functions internally -- callers never handle encryption directly.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-error-boundary@6.1.1` | React 16.8+ through 19.x | Uses hooks internally; no React 19 breaking issues. Peer dep is `react >= 16.8`. |
| `React.lazy` | React 19.2.0 (current) | Fully supported. Named exports need `.then(module => ({ default: module.X }))` wrapper. |
| `rollup-plugin-visualizer@7.0.1` | Vite 5+ / Rollup 4+ | Vite 6.4.1 uses Rollup 4; compatible. |
| Web Crypto API | All modern browsers | Chrome 37+, Firefox 34+, Safari 7+. No compatibility concerns for a modern SPA. |

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| Error boundaries | `react-error-boundary` | Custom class components | Only if you need zero dependencies AND have very simple boundary needs (single fallback, no reset). For this codebase with 12 routes and multiple crash points, the library's hooks API and reset functionality are worth the 4KB. |
| Code splitting | `React.lazy` + Vite automatic | `manualChunks` configuration | Use `manualChunks` only AFTER running the visualizer and identifying specific vendor bundles (jspdf, motion) that should be separated from the route chunks. Automatic splitting is sufficient for route-level. |
| Key encryption | Web Crypto API (fix existing) | Supabase Vault (server-side) | If the project later moves to a model where API keys are never client-side, Supabase Vault with Edge Functions is the right architecture. For now, the client-side encryption model (with the fixes above) is pragmatic given the existing codebase. |

## Sources

- `npm view react-error-boundary version` -- verified 6.1.1 (2026-04-01)
- `npm view rollup-plugin-visualizer version` -- verified 7.0.1 (2026-04-01)
- Codebase analysis: `src/utils/encryption.ts`, `src/services/storage.ts`, `src/App.tsx` -- identified three encryption bugs and 12 routes needing lazy loading
- MDN Web Docs: [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) -- AES-GCM and PBKDF2 API reference (HIGH confidence)
- OWASP Password Storage Cheat Sheet -- PBKDF2 iterations recommendation: 600,000 for SHA-256 (HIGH confidence)
- Web search: React error boundary patterns, Vite code splitting -- results unavailable (search service issues); recommendations based on training data verified against npm versions and codebase state (MEDIUM confidence for patterns, HIGH for library versions)

---
*Stack research for: SpeakLab hardening milestone*
*Researched: 2026-04-01*
