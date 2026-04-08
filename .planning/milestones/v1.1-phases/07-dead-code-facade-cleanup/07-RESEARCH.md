# Phase 7: Dead Code & Facade Cleanup - Research

**Researched:** 2026-04-07
**Domain:** Dead code removal, import consolidation, storage facade integrity
**Confidence:** HIGH

## Summary

Phase 7 addresses 4 tech debt items identified in the v1.0 milestone audit. Each item is straightforward dead code removal or import consolidation -- no new features, no architecture changes, no external dependencies. The research confirms all 4 items are safe to act on with clear scope.

**ChunkErrorFallback.tsx** is fully orphaned: exported but never imported by production code. Its functionality (chunk error detection + retry) is already handled inline by `ErrorFallback.tsx` via `isChunkError()` and `navigate(0)`. The associated test file is also orphaned.

**OpenAIRealtimeLiveSession** (in `openaiRealtimeLive.ts`) is an unused class implementing the `ILiveSession` interface. Production live-roleplay uses only `GeminiLiveSession`. The class has no production consumers -- only its own test file references it. Safe to remove both the implementation and its test.

**Orphaned aiProxy.ts exports** -- `withFallback()`, `getGeminiKeyForLive()`, and `getVertexLiveToken()` -- have zero consumers in production code. Two of them (`getGeminiKeyForLive`, `withFallback`) are re-exported through the `supabase/index.ts` barrel file but never imported by anyone from there either. `getVertexLiveToken` is exported from `aiProxy.ts` but not even re-exported from the barrel. All three are dead.

**SettingsPage.tsx dual import** -- SettingsPage imports `saveModelConfig`, `saveConversationTone`, `saveApiKeys` from the facade (`services/storage`) for writes, but directly imports `getModelConfig` and `getConversationTone` from `services/supabase/storage` for async reads. The facade only provides synchronous cached reads via runtimeState, but SettingsPage needs fresh async data from the server on page load. The fix requires either (a) adding async read functions to the facade that delegate to supabase/storage, or (b) accepting the dual import with a documented justification.

**Primary recommendation:** Delete the 3 dead code targets cleanly, then route SettingsPage exclusively through the facade by adding async read passthrough functions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2 | UI framework | Already in project |
| Vitest | 4.0 | Test runner | Already in project |

This phase requires no new packages -- it is purely deletion and refactoring of existing code.

### Alternatives Considered
N/A -- no library decisions in this phase.

## Architecture Patterns

### Current Storage Architecture
```
Components --> services/storage.ts (facade) --> services/supabase/storage.ts (impl)
                    |                                      |
                    v                                      v
            services/runtimeState.ts              Supabase client
            (sync cached reads)                   (async DB reads/writes)
```

### Pattern: Storage Facade
The facade (`services/storage.ts`) provides two tiers:
1. **Sync reads** -- delegate to `runtimeState.ts` cache (`getModelConfig()`, `getGamification()`, `getConversationTone()`)
2. **Async writes/queries** -- delegate to `supabase/storage.ts` with dev-mode guards

**Gap:** The facade does NOT expose async versions of `getModelConfig` or `getConversationTone` that fetch fresh data from Supabase. SettingsPage needs these on mount.

### Pattern: Barrel File (supabase/index.ts)
The barrel file re-exports from `./storage` and `./aiProxy`. It is marked `@deprecated` in comments. Two orphaned aiProxy exports pass through it (`getGeminiKeyForLive`, `withFallback`).

### Anti-Patterns to Avoid
- **Do not remove exports that have consumers:** Always grep for importers before deleting. The audit identified these as consumer-free but verification is mandatory at execution time.
- **Do not break the barrel file contract:** If removing re-exports from `supabase/index.ts`, verify no external consumer imports them (verified: none do).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A | N/A | N/A | This phase removes code, doesn't build new features |

## Runtime State Inventory

> This is a cleanup/refactor phase. Runtime state audit:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None -- no database keys/collections reference any of the 4 targets | None |
| Live service config | None -- Supabase Edge Function not affected by client-side dead code removal | None |
| OS-registered state | None -- purely browser SPA, no OS registrations | None |
| Secrets/env vars | None -- no env var names change | None |
| Build artifacts | `dist/` will need rebuild after changes (standard) | `npm run build` verification |

## Common Pitfalls

### Pitfall 1: Removing code that's imported by barrel re-exports
**What goes wrong:** Deleting an export from `aiProxy.ts` without also removing it from `supabase/index.ts` causes a build error.
**Why it happens:** The barrel file re-exports `getGeminiKeyForLive` and `withFallback` from `aiProxy.ts`.
**How to avoid:** When removing an export from `aiProxy.ts`, also remove it from the re-export block in `supabase/index.ts` (lines 77-90).
**Warning signs:** TypeScript build fails with "Module has no exported member" in `supabase/index.ts`.

### Pitfall 2: Breaking SettingsPage by removing supabase/storage import without providing facade alternative
**What goes wrong:** If you delete the direct `supabase/storage` import from SettingsPage without adding async `getModelConfig`/`getConversationTone` to the facade, the page can't load fresh settings.
**Why it happens:** The facade only has sync cached reads, not async server reads.
**How to avoid:** Add async `getModelConfigAsync()` and `getConversationToneAsync()` (or similar) to the facade first, then switch the import.
**Warning signs:** Settings page shows stale/default config after login.

### Pitfall 3: Removing test files that still pass
**What goes wrong:** Deleting test files without verifying they only test removed code.
**Why it happens:** Test files like `openaiRealtimeLive.test.ts` test a class being removed, but may also test shared utilities.
**How to avoid:** Read each test file before deleting to confirm it only tests the dead code. Verified: `openaiRealtimeLive.test.ts` only tests `OpenAIRealtimeLiveSession`, and `ChunkErrorFallback.test.tsx` only tests `ChunkErrorFallback`.

### Pitfall 4: Forgetting to update the barrel file's deprecation status
**What goes wrong:** The barrel file (`supabase/index.ts`) is already marked `@deprecated`. After removing orphaned re-exports, it should be evaluated for complete removal.
**Why it happens:** Tunnel vision on individual exports.
**How to avoid:** After cleanup, check if the barrel file still serves any purpose. If only `storage` re-exports remain, consider whether it's still needed.

## Code Examples

### Target 1: ChunkErrorFallback.tsx (DELETE)
```typescript
// src/components/errors/ChunkErrorFallback.tsx -- FULL FILE
// This component is NEVER imported in production code.
// Chunk error handling is done inline by ErrorFallback.tsx (lines 5-30).
// The isChunkError() function in ErrorFallback.tsx detects chunk errors
// and handleRetry() calls navigate(0) for soft retry.
```

### Target 2: OpenAIRealtimeLiveSession (DELETE)
```typescript
// src/services/openaiRealtimeLive.ts -- exports OpenAIRealtimeLiveSession
// Production uses ONLY GeminiLiveSession (src/services/geminiLive.ts)
// LiveSession.tsx (line 44): const sessionRef = useRef<GeminiLiveSession | null>(null);
// LiveSession.tsx (line 60): const session = new GeminiLiveSession({ ... });
// No production code imports OpenAIRealtimeLiveSession.
```

### Target 3: Orphaned aiProxy exports (DELETE)
```typescript
// src/services/supabase/aiProxy.ts -- 3 exports with zero consumers:
// Line 223: export async function getGeminiKeyForLive()
// Line 239: export async function getVertexLiveToken()
// Line 256: export async function withFallback<T>()
//
// Barrel re-exports (src/services/supabase/index.ts lines 77-90):
//   getGeminiKeyForLive -- RE-EXPORTED but never consumed
//   withFallback -- RE-EXPORTED but never consumed
//   getVertexLiveToken -- NOT re-exported, also not consumed
```

### Target 4: SettingsPage dual import (FIX)
```typescript
// CURRENT (SettingsPage.tsx lines 1-10):
import { saveModelConfig, saveConversationTone, saveApiKeys } from '../../services/storage';
import { getModelConfig as supabaseGetModelConfig, getConversationTone as supabaseGetConversationTone } from '../../services/supabase/storage';

// FIXED -- add async passthrough to facade, then SettingsPage uses single import:
import { saveModelConfig, saveConversationTone, saveApiKeys, getModelConfigAsync, getConversationToneAsync } from '../../services/storage';
```

## Detailed Findings Per Target

### Target 1: ChunkErrorFallback.tsx
- **File:** `src/components/errors/ChunkErrorFallback.tsx` (30 lines)
- **Test:** `src/components/errors/__tests__/ChunkErrorFallback.test.tsx`
- **Importers:** ZERO in production code. Only its own test file imports it.
- **Functionality overlap:** `ErrorFallback.tsx` already handles chunk errors via `isChunkError()` helper and `navigate(0)` retry.
- **Verdict:** Safe to delete both files. No migration needed.

### Target 2: OpenAIRealtimeLiveSession
- **File:** `src/services/openaiRealtimeLive.ts`
- **Test:** `src/services/openaiRealtimeLive.test.ts`
- **Importers:** ZERO in production code. Only its own test file and internal imports (`storage.ts` for `getOpenAIKey`/`getModelConfig`, `liveSession.ts` for types).
- **Production live-roleplay path:** `LiveRoleplayPage.tsx` -> `LiveSession.tsx` -> `GeminiLiveSession` (hardcoded).
- **Verdict:** Safe to delete both files. The `ILiveSession` interface in `liveSession.ts` is still used by `GeminiLiveSession` and should be kept.
- **Note:** Removing this class means only one implementation of `ILiveSession` exists. The interface pattern is still valid for future provider additions.

### Target 3: Orphaned aiProxy exports
- **File:** `src/services/supabase/aiProxy.ts`
- **Orphaned exports:**
  1. `getGeminiKeyForLive()` (line 223) -- re-exported from barrel, zero consumers
  2. `getVertexLiveToken()` (line 239) -- not re-exported, zero consumers
  3. `withFallback<T>()` (line 256) -- re-exported from barrel, zero consumers
- **Barrel file impact:** `supabase/index.ts` lines 83-84 must also be updated to remove `getGeminiKeyForLive` and `withFallback` from the re-export block.
- **Verdict:** Safe to delete all 3 functions and their barrel re-exports. No consumers anywhere in the codebase.

### Target 4: SettingsPage dual import
- **File:** `src/components/settings/SettingsPage.tsx`
- **Current state:** Lines 3-10 import from both `services/storage` (facade) and `services/supabase/storage` (direct).
- **Why dual import exists:** Facade provides sync `getModelConfig()` (reads from runtimeState cache), but SettingsPage needs fresh async data from server on mount (`useEffect` at line 96 calls `supabaseGetModelConfig()` and `supabaseGetConversationTone()`).
- **Fix approach:** Add async passthrough functions to the facade that delegate to `supabase/storage.ts`:
  ```typescript
  // In services/storage.ts, add:
  export async function getModelConfigAsync(): Promise<ModelConfig> {
    if (isDevMode()) return getRuntimeModelConfig();
    return supabaseGetModelConfig(); // already imported
  }
  export async function getConversationToneAsync(): Promise<ConversationTone> {
    if (isDevMode()) return getRuntimeConversationTone();
    return supabaseGetConversationTone(); // already imported
  }
  ```
- **Then in SettingsPage.tsx:** Replace direct supabase/storage import with facade async functions.
- **Note:** The supabase/storage functions `getModelConfig` and `getConversationTone` are already imported in the facade file (lines 24-48) under different names. We just need to re-export them as async functions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dual import (facade + direct) | Single facade import | Phase 7 | Cleaner dependency graph |
| Orphaned error components | Single ErrorFallback | Phase 2 (partial) | Completes Phase 2 cleanup |
| Unused live session classes | Single provider (Gemini) | Phase 7 | Smaller bundle |

**Deprecated/outdated:**
- `ChunkErrorFallback.tsx`: Superseded by `ErrorFallback.tsx` inline chunk detection.
- `OpenAIRealtimeLiveSession`: Never wired, superseded by Gemini-only live path.
- `supabase/index.ts` barrel file: Already marked `@deprecated`.

## Open Questions

1. **Barrel file fate after cleanup**
   - What we know: `supabase/index.ts` is marked `@deprecated` and only re-exports from `./storage` and `./aiProxy`.
   - What's unclear: Whether anything still imports from the barrel. Grep shows zero imports of `from '...supabase/index'` or `from '...supabase'` in production code (only test files import from `./supabase/storage` directly).
   - Recommendation: After removing orphaned aiProxy re-exports, evaluate whether the barrel file can be deleted entirely in a follow-up task or this phase.

2. **Naming convention for async facade functions**
   - What we know: The facade has sync `getModelConfig()` (from cache) and needs async `getModelConfig` from server.
   - What's unclear: Best naming to distinguish sync vs async versions.
   - Recommendation: Use `getModelConfigFresh()` and `getConversationToneFresh()` to indicate server-fetch semantics. Alternative: `fetchModelConfig()` / `fetchConversationTone()`. Either works -- planner's choice.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (main), `vitest.smoke.config.ts` (smoke) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
This is a gap-closure phase with no specific requirement IDs. Validation focuses on:

| Target | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ChunkErrorFallback removal | Build succeeds after deletion | build | `npx tsc --noEmit` | N/A (deletion) |
| OpenAIRealtimeLive removal | Build succeeds after deletion | build | `npx tsc --noEmit` | N/A (deletion) |
| aiProxy export removal | Build succeeds, barrel updated | build | `npx tsc --noEmit` | N/A (deletion) |
| SettingsPage facade fix | Settings page loads config correctly | unit | `npx vitest run src/components/settings` | No test exists |
| SettingsPage facade fix | No direct supabase/storage import | lint | `grep -r "supabase/storage" src/components/settings/` | N/A (grep check) |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit` (type check only, fast)
- **Per wave merge:** `npx vitest run` (full test suite)
- **Phase gate:** `npx tsc --noEmit && npx vitest run` green before `/gsd:verify-work`

### Wave 0 Gaps
- No new test files needed for deletion tasks (the tests being deleted test code being deleted)
- SettingsPage has no existing test -- manual verification of settings load after facade change is sufficient for this tech-debt phase
- Existing `storage.test.ts` should continue passing after facade additions

## Sources

### Primary (HIGH confidence)
- Source code analysis: `src/components/errors/ChunkErrorFallback.tsx`, `src/components/errors/ErrorFallback.tsx`
- Source code analysis: `src/services/openaiRealtimeLive.ts`, `src/components/live-roleplay/LiveSession.tsx`
- Source code analysis: `src/services/supabase/aiProxy.ts`, `src/services/supabase/index.ts`
- Source code analysis: `src/components/settings/SettingsPage.tsx`, `src/services/storage.ts`
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` -- v1.0 audit findings

### Secondary (MEDIUM confidence)
- Grep-based import analysis across full `src/` directory

## Metadata

**Confidence breakdown:**
- Dead code identification: HIGH -- exhaustive grep confirmed zero consumers for all 4 targets
- SettingsPage fix approach: HIGH -- facade already imports the needed supabase functions
- Barrel file cleanup: HIGH -- verified no consumers import from barrel
- Pitfalls: HIGH -- all pitfalls identified from code structure analysis

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase, no fast-moving dependencies)
