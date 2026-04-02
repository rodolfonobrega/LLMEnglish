# Phase 5: Storage Consolidation - Research

**Researched:** 2026-04-02
**Domain:** Storage layer architecture (facade pattern, sync/async API unification)
**Confidence:** HIGH

## Summary

The codebase has two storage modules with 22 identically-named functions but incompatible signatures (sync vs async). Legacy `src/services/storage.ts` (33 exports, all sync) already delegates reads to `runtimeState.ts` cache for 5 key functions. Supabase `src/services/supabase/storage.ts` (~31 exports, all async) is the actual data layer. The facade strategy is well-supported by the existing code: legacy storage already wraps runtimeState for reads, and runtimeState is hydrated from supabase/storage on login. The consolidation is essentially expanding this delegation pattern to cover all functions, adding dev-mode fallback for reads, and migrating 14 supabase/storage import sites to use the facade.

**Primary recommendation:** Gut `src/services/storage.ts` to a thin facade that delegates sync-cached reads to `runtimeState.ts` and async queries to `supabase/storage.ts`, with localStorage fallback for dev mode. Then redirect all 14 `supabase/storage` import sites to the facade.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `src/services/storage.ts` becomes the single facade module -- gut the localStorage implementation, delegate to `supabase/storage.ts` internally
- **D-02:** All 7 legacy import sites (`storage.ts`) keep their existing import paths -- no import path changes needed
- **D-03:** `supabase/storage.ts` remains the Supabase implementation layer (the facade wraps it, not replaces it)
- **D-04:** `supabase/index.ts` barrel continues re-exporting for any existing consumers during transition
- **D-05:** Facade detects auth state -- if Supabase session exists, delegate to `supabase/storage.ts`; if no session (dev mode), fall back to localStorage reads + `runtimeState` cache
- **D-06:** Dev mode provides read-only data sufficient to render UI -- writes in dev mode are no-ops or log a warning
- **D-07:** Hybrid approach -- functions backed by `runtimeState` cache (`getModelConfig`, `getGamification`, `getApiKey`, `getConversationTone`, `getUserContext`) stay synchronous via cache
- **D-08:** One-shot query functions (`getCards`, `getLiveSessions`, `getSessionReports`, `getPathProgress`, `getCardsDueForReview`) become async -- callers must `await`
- **D-09:** Sync cached functions don't change their call sites; async query function callers add `await`/`.then()`
- **D-10:** Keep named wrappers (`getOpenAIKey`, `setOpenAIKey`, `getGeminiKey`, `setGeminiKey`, `getGroqKey`, `setGroqKey`) that delegate to generic `getApiKey(provider)` / `saveApiKey(provider, key)`
- **D-11:** Named wrappers read from `runtimeState` cache (sync) -- consistent with hybrid sync/async decision

### Claude's Discretion
- Exact auth detection method (check Supabase client session vs runtimeState flag)
- How to structure the localStorage fallback code (inline vs helper functions)
- Whether to eventually deprecate `supabase/index.ts` storage re-exports or keep them
- Error messages for dev mode write attempts
- Whether to remove unused legacy functions (e.g., audio cache, some `KEYS` entries) during gutting

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STOR-01 | Developer imports from a single storage module regardless of auth state (StorageAdapter facade) | Facade pattern documented below: `storage.ts` delegates to `supabase/storage.ts` for authenticated, localStorage fallback for dev mode. Import migration map identifies all 14 sites to redirect. |
| STOR-02 | Conflicting function signatures between localStorage and Supabase storage are renamed to prevent import confusion | Signature conflict table below identifies all 22 conflicting names. Facade resolves by using supabase/storage's async signatures for query functions, runtimeState sync wrappers for cached functions. Named API key wrappers (D-10) preserved. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.99 | Supabase client (auth, DB, storage) | Already in use, provides session detection for facade routing |
| `vitest` | 4.0.18 | Test runner | Already configured, used for validation tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jsdom` | 28 | DOM environment for tests | Storage tests that need `localStorage` mock |
| `@testing-library/jest-dom` | via vitest | DOM matchers | If component-level integration tests needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Facade in `storage.ts` | New `storageAdapter.ts` module | New module avoids any confusion about what `storage.ts` is, but D-01 locks it to the existing file |
| Auth check via Supabase client | Check `runtimeState` hydration flag | runtimeState is simpler but Supabase client is the source of truth for auth state |

**Installation:**
No new packages required. Phase uses existing stack only.

## Architecture Patterns

### Recommended Project Structure
```
src/services/
├── storage.ts              # FACADE: thin delegation layer (gutted, replaces legacy localStorage)
├── supabase/
│   ├── storage.ts          # IMPLEMENTATION: async Supabase CRUD (unchanged)
│   ├── index.ts            # BARREL: re-exports (unchanged, may deprecate later)
│   └── client.ts           # Supabase client (unchanged)
└── runtimeState.ts         # CACHE: sync cached getters (unchanged)
```

### Pattern 1: Facade with Auth-Aware Routing
**What:** Single module that detects auth state and routes to the correct backend
**When to use:** Every exported function in the facade
**Example:**
```typescript
// src/services/storage.ts (facade pattern)

// Sync cached functions -- delegate directly to runtimeState
export function getGamification(): GamificationState {
  return getRuntimeGamification();
}

export function getModelConfig(): ModelConfig {
  return getRuntimeModelConfig();
}

// Named API key wrappers (D-10, D-11)
export function getOpenAIKey(): string {
  return getRuntimeApiKey('openai');
}

// Async query functions -- delegate to supabase/storage
export async function getCards(): Promise<Card[]> {
  return supabaseGetCards();
}

// Write functions -- delegate to supabase/storage, no-op in dev mode
export async function saveCards(cards: Card[]): Promise<void> {
  if (isDevMode()) {
    console.warn('saveCards: write ignored in dev mode');
    return;
  }
  return supabaseSaveCards(cards);
}
```

### Pattern 2: Dev Mode Detection
**What:** Check if Supabase is configured to determine dev mode
**When to use:** In facade functions that need dev mode fallback
**Example:**
```typescript
// Consistent with existing pattern from AuthContext.tsx:90 and SettingsPage.tsx:50
function isDevMode(): boolean {
  return !import.meta.env.VITE_SUPABASE_URL;
}
```

### Pattern 3: Re-export Alias for Supabase Functions
**What:** Import supabase/storage functions under aliased names to avoid name collisions in the facade module
**When to use:** When facade exports a function with the same name as the supabase implementation
**Example:**
```typescript
import {
  getCards as supabaseGetCards,
  saveCards as supabaseSaveCards,
  // ... all other functions aliased
} from './supabase/storage';
```

### Anti-Patterns to Avoid
- **Circular imports:** `storage.ts` must NOT import from anything that imports from `storage.ts`. Verified: `runtimeState.ts` imports from `supabase/storage.ts`, NOT from `storage.ts`, so no circular dependency.
- **Mixed sync/async at same call site:** A function must be either always sync or always async. Never return `Promise` sometimes and raw value other times based on auth state.
- **Breaking existing callers:** Legacy import sites (8 files) must work without changes per D-02.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state detection | Custom session tracking | `!import.meta.env.VITE_SUPABASE_URL` (existing pattern) | Already used in AuthContext, SettingsPage, DevBanner -- consistent with codebase |
| Sync cached data access | Duplicate caching in facade | `runtimeState.ts` existing getters | Already hydrates from Supabase, already has all 5 sync getters needed |
| Async CRUD operations | Re-implement in facade | `supabase/storage.ts` existing functions | 700+ lines of tested implementation -- just delegate |

**Key insight:** The infrastructure already exists. `runtimeState.ts` provides sync cached reads. `supabase/storage.ts` provides async CRUD. The facade just wires them together behind a single import path.

## Runtime State Inventory

> Phase involves refactoring (consolidation), not rename/migration. No stored data changes required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- facade does not change Supabase schema or data formats | None |
| Live service config | None -- no external services reconfigured | None |
| OS-registered state | None -- purely client-side code changes | None |
| Secrets/env vars | None -- API key access patterns unchanged, same env vars | None |
| Build artifacts | `dist/` output will need rebuild after code changes | `npm run build` after completion |

## Common Pitfalls

### Pitfall 1: Signature Mismatch Breaks Callers
**What goes wrong:** Making a previously-sync function async (`getGamification` returning `Promise<GamificationState>`) breaks callers that don't await
**Why it happens:** 6 legacy import sites call sync functions without `await` -- if the facade changes these to async, the callers get `Promise` objects instead of data
**How to avoid:** D-07/D-08 already addresses this: keep cached functions sync, only make query functions async. The 5 sync-cached functions (`getModelConfig`, `getGamification`, `getApiKey`, `getConversationTone`, `getUserContext`) must remain sync in the facade.
**Warning signs:** TypeScript compile errors where `Promise<Type>` is used as `Type`

### Pitfall 2: Circular Dependency Between storage.ts and runtimeState.ts
**What goes wrong:** If `storage.ts` imports from `runtimeState.ts` AND `runtimeState.ts` imports from `storage.ts`, the module system fails
**Why it happens:** `runtimeState.ts` already imports from `supabase/storage.ts` (not `storage.ts`), so the facade can safely import from both `runtimeState.ts` and `supabase/storage.ts`
**How to avoid:** Never change `runtimeState.ts` to import from `storage.ts`. The dependency chain must be: `storage.ts` -> `runtimeState.ts` -> `supabase/storage.ts` (one direction only)
**Warning signs:** `ReferenceError: Cannot access 'X' before initialization` at runtime

### Pitfall 3: Dual Import Sites in Same File
**What goes wrong:** `ConversationAnalysis.tsx` imports `getModelConfig` from `storage.ts` AND `saveLiveSession` from `supabase/storage.ts`. After consolidation, both should come from `storage.ts`
**Why it happens:** File was written when both modules were independently used
**How to avoid:** After facade is complete, audit `ConversationAnalysis.tsx` specifically to merge imports into a single `storage.ts` import
**Warning signs:** Same file importing from both storage paths

### Pitfall 4: Supabase Barrel Still Re-exports Old Names
**What goes wrong:** `supabase/index.ts` barrel re-exports all storage functions. If consumers import from `supabase/index.ts`, they bypass the facade
**Why it happens:** D-04 says keep the barrel, but it creates a parallel import path
**How to avoid:** Per D-04, keep barrel during transition. Document that new code should import from `storage.ts`. Consider deprecation comments.
**Warning signs:** Grep for `from.*supabase['"]` (bare import without `/storage`) finding storage consumers

### Pitfall 5: Import Count Mismatch
**What goes wrong:** CONTEXT.md says 7 legacy import sites, but actual count is 8 (geminiLive.ts and openaiRealtimeLive.ts also import from `./storage`)
**Why it happens:** Services in the same `src/services/` directory use relative `./storage` imports, which are harder to grep than `../../services/storage` component imports
**How to avoid:** Use comprehensive grep: `grep -rn "from.*storage" src/ --include="*.ts" --include="*.tsx"` and manually classify each result
**Warning signs:** Missing a file in the migration plan

### Pitfall 6: UserContext Type Duplication
**What goes wrong:** `UserContext` interface is defined in BOTH `src/services/storage.ts` (line 231) AND `src/types/settings.ts` (line 39). The facade must export from `types/settings.ts` only.
**Why it happens:** Legacy code defined the type locally before it was moved to the shared types directory
**How to avoid:** Facade re-exports `UserContext` from `../types/settings`, not a local definition
**Warning signs:** TypeScript "duplicate identifier" errors

## Code Examples

### Complete Legacy Import Site List (8 files, not 7)
```typescript
// Component imports (path: ../../services/storage)
src/components/discovery/DiscoveryPage.tsx    -> getGamification
src/components/layout/Header.tsx              -> getGamification
src/components/layout/Sidebar.tsx             -> getGamification
src/components/live-roleplay/ConversationAnalysis.tsx -> getModelConfig
src/config/images.ts                          -> getModelConfig (aliased as getModelConfigImport)
src/hooks/useTTS.ts                           -> getModelConfig

// Service imports (path: ./storage -- relative peer imports)
src/services/geminiLive.ts                    -> getGeminiKey, getModelConfig
src/services/openaiRealtimeLive.ts            -> getOpenAIKey, getModelConfig
```

### Complete Supabase Storage Import Site List (14 files)
```typescript
src/components/discovery/ExerciseMode.tsx     -> addCard
src/components/discovery/ImageMode.tsx         -> addCard
src/components/history/HistoryPage.tsx         -> clearLiveSessions, getLiveSessions
src/components/library/LibraryPage.tsx         -> getCards, deleteCard, updateCard, addCard
src/components/live-roleplay/ConversationAnalysis.tsx -> saveLiveSession (DUAL IMPORT!)
src/components/live-roleplay/ScenarioSetup.tsx -> getUserContext
src/components/paths/PathsPage.tsx             -> getPathProgress, markStepComplete
src/components/practice/PracticePage.tsx       -> getConversationTone, getUserContext
src/components/review/ReviewPage.tsx           -> getCardsDueForReview, updateCard
src/components/settings/SettingsPage.tsx       -> getModelConfig, saveModelConfig, getConversationTone,
                                                  saveConversationTone, getUserContext, saveUserContext, saveApiKeys
src/services/errorAnalysis.ts                  -> getCards
src/services/gamification.ts                   -> getCards, getGamification, saveGamification, saveSessionReport
src/services/runtimeState.ts                   -> getApiKey, getConversationTone, getGamification,
                                                  getModelConfig, getUserContext
```

### Signature Conflict Table (22 functions with identical names, different return types)
```
Function                  | Legacy (sync)       | Supabase (async)
--------------------------|---------------------|---------------------------
getCards()                | Card[]              | Promise<Card[]>
saveCards(cards)          | void                | Promise<void>
addCard(card)             | void                | Promise<void>
updateCard(card)          | void                | Promise<void>
deleteCard(id)            | void                | Promise<void>
getCardById(id)           | Card | undefined    | Promise<Card | undefined>
getCardsDueForReview()    | Card[]              | Promise<Card[]>
getGamification()         | GamificationState   | Promise<GamificationState>
saveGamification(state)   | void                | Promise<void>
getLiveSessions()         | LiveSession[]       | Promise<LiveSession[]>
saveLiveSession(session)  | void                | Promise<void>
clearLiveSessions()       | void                | Promise<void>
getPathProgress()         | PathProgress        | Promise<PathProgress>
savePathProgress(p)       | void                | Promise<void>
markStepComplete(...)     | void                | Promise<void>
isStepComplete(...)       | boolean             | Promise<boolean>
getTrailCompletedCount()  | number              | Promise<number>
getSessionReports()       | SessionReport[]     | Promise<SessionReport[]>
saveSessionReport(r)      | void                | Promise<void>
getModelConfig()          | ModelConfig         | Promise<ModelConfig>
getConversationTone()     | ConversationTone    | Promise<ConversationTone>
saveConversationTone(t)   | void                | Promise<void>
getUserContext()          | UserContext          | Promise<UserContext>
saveUserContext(c)        | void                | Promise<void>
saveModelConfig(c)        | void                | Promise<void>
```

### Sync vs Async Classification (per D-07, D-08)
```
SYNC (stay sync, read from runtimeState cache):
  getModelConfig()        -> getRuntimeModelConfig()
  getGamification()       -> getRuntimeGamification()
  getOpenAIKey()          -> getRuntimeApiKey('openai')
  getGeminiKey()          -> getRuntimeApiKey('gemini')
  getGroqKey()            -> getRuntimeApiKey('groq')
  getConversationTone()   -> getRuntimeConversationTone()
  getUserContext()        -> getRuntimeUserContext()

ASYNC (become async, delegate to supabase/storage):
  getCards, saveCards, addCard, updateCard, deleteCard, getCardById
  getCardsDueForReview
  saveGamification
  getLiveSessions, saveLiveSession, clearLiveSessions
  getPathProgress, savePathProgress, markStepComplete, isStepComplete, getTrailCompletedCount
  getSessionReports, saveSessionReport, getSessionReportsByDateRange, getLatestSessionReports
  saveModelConfig, saveConversationTone, saveUserContext
  saveApiKey, getApiKey, saveApiKeys
```

### Functions to Remove (dead code, no external consumers)
```typescript
// In legacy storage.ts -- zero consumers found outside storage.ts itself:
getCachedAudio(key: string): string | null
setCachedAudio(key: string, base64Audio: string): void
// KEYS.audioCache can also be removed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual import paths | Single facade module | Phase 5 (this phase) | All consumers import from one path |
| Sync localStorage reads | Hybrid: sync cache + async queries | Phase 5 (this phase) | Cached reads stay sync, queries become async |
| UserContext defined in storage.ts | UserContext in types/settings.ts | Pre-existing | Remove duplicate from storage.ts |

**Deprecated/outdated:**
- `getCachedAudio`/`setCachedAudio`: Zero consumers. Audio cache removed from openai.ts in Phase 4. Safe to delete.
- `KEYS` constant in legacy storage.ts: Most entries unused after facade gutting. Only keep if dev-mode fallback reads from localStorage.

## Open Questions

1. **Dev mode localStorage fallback for async query functions**
   - What we know: D-05 says dev mode falls back to localStorage reads. D-06 says reads are sufficient to render UI.
   - What's unclear: Should async query functions (`getCards`, `getLiveSessions`, etc.) read from localStorage in dev mode, or return empty arrays? If they read from localStorage, the `KEYS` constant and localStorage parsing logic must be preserved in the facade.
   - Recommendation: Return empty/default values in dev mode for query functions. Dev mode is for UI iteration, not data access. This simplifies the facade significantly.

2. **Supabase barrel deprecation timeline**
   - What we know: D-04 says keep the barrel during transition. `runtimeState.ts` and `gamification.ts` import directly from `supabase/storage.ts` (not barrel).
   - What's unclear: Whether to add deprecation comments to the barrel re-exports in this phase or leave that for later.
   - Recommendation: Add `@deprecated Import from 'services/storage' instead` JSDoc comments on barrel re-exports. Low effort, high future value.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | Yes | 20.20.2 | -- |
| Vitest | Validation tests | Yes | 4.0.18 | -- |
| jsdom | Test environment | Yes | 28 | -- |
| npm | Package management | Yes | (lockfile present) | -- |

**Missing dependencies with no fallback:**
- None -- all dependencies are available.

**Missing dependencies with fallback:**
- None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose 2>&1 | tail -20` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | All storage imports resolve to single facade module | unit | `npx vitest run src/services/storage.test.ts -t "facade"` | No -- Wave 0 |
| STOR-01 | Facade delegates to supabase/storage when authenticated | unit | `npx vitest run src/services/storage.test.ts -t "authenticated"` | No -- Wave 0 |
| STOR-01 | Facade falls back to defaults in dev mode | unit | `npx vitest run src/services/storage.test.ts -t "dev mode"` | No -- Wave 0 |
| STOR-02 | No duplicate exported function names | unit | `npx vitest run src/services/storage.test.ts -t "no duplicates"` | No -- Wave 0 |
| STOR-02 | Sync functions return non-Promise values | unit | `npx vitest run src/services/storage.test.ts -t "sync"` | No -- Wave 0 |
| STOR-02 | Async functions return Promises | unit | `npx vitest run src/services/storage.test.ts -t "async"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/storage.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/services/storage.test.ts` -- covers STOR-01 (facade delegation, dev mode fallback), STOR-02 (no duplicate names, correct sync/async signatures)
- [ ] No shared fixtures needed -- tests mock `runtimeState.ts` and `supabase/storage.ts` via `vi.mock()`

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of `src/services/storage.ts`, `src/services/supabase/storage.ts`, `src/services/runtimeState.ts`
- Import site audit via grep across entire `src/` directory
- `.planning/phases/05-storage-consolidation/05-CONTEXT.md` -- user decisions

### Secondary (MEDIUM confidence)
- `.planning/phases/04-secure-storage/04-CONTEXT.md` -- Phase 4 encryption context (referenced but not re-analyzed)

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing code analyzed
- Architecture: HIGH -- facade pattern directly supported by existing delegation in legacy storage.ts
- Pitfalls: HIGH -- identified from concrete source code analysis (signature conflicts, circular deps, dual imports)
- Import audit: HIGH -- comprehensive grep verified all 22 import sites

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no external dependencies, codebase-only changes)
