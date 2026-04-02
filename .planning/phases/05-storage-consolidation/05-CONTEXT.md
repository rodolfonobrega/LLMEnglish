# Phase 5: Storage Consolidation - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate the dual storage layer (legacy localStorage `storage.ts` + Supabase `supabase/storage.ts`) into a single `storage.ts` facade module. All consumers import from one path regardless of auth state, with no duplicate function signatures. Zero compile errors. All existing features continue working identically.

This phase does NOT:
- Add new storage capabilities
- Change the Supabase schema or Edge Functions
- Redesign any UI
- Modify encryption (locked in Phase 4)

</domain>

<decisions>
## Implementation Decisions

### Facade Strategy
- **D-01:** `src/services/storage.ts` becomes the single facade module — gut the localStorage implementation, delegate to `supabase/storage.ts` internally
- **D-02:** All 7 legacy import sites (`storage.ts`) keep their existing import paths — no import path changes needed
- **D-03:** `supabase/storage.ts` remains the Supabase implementation layer (the facade wraps it, not replaces it)
- **D-04:** `supabase/index.ts` barrel continues re-exporting for any existing consumers during transition

### Dev Mode Fallback
- **D-05:** Facade detects auth state — if Supabase session exists, delegate to `supabase/storage.ts`; if no session (dev mode), fall back to localStorage reads + `runtimeState` cache
- **D-06:** Dev mode provides read-only data sufficient to render UI — writes in dev mode are no-ops or log a warning

### Sync vs Async Migration
- **D-07:** Hybrid approach — functions backed by `runtimeState` cache (`getModelConfig`, `getGamification`, `getApiKey`, `getConversationTone`, `getUserContext`) stay synchronous via cache
- **D-08:** One-shot query functions (`getCards`, `getLiveSessions`, `getSessionReports`, `getPathProgress`, `getCardsDueForReview`) become async — callers must `await`
- **D-09:** Sync cached functions don't change their call sites; async query function callers add `await`/`.then()`

### API Key Function API
- **D-10:** Keep named wrappers (`getOpenAIKey`, `setOpenAIKey`, `getGeminiKey`, `setGeminiKey`, `getGroqKey`, `setGroqKey`) that delegate to generic `getApiKey(provider)` / `saveApiKey(provider, key)`
- **D-11:** Named wrappers read from `runtimeState` cache (sync) — consistent with hybrid sync/async decision

### Claude's Discretion
- Exact auth detection method (check Supabase client session vs runtimeState flag)
- How to structure the localStorage fallback code (inline vs helper functions)
- Whether to eventually deprecate `supabase/index.ts` storage re-exports or keep them
- Error messages for dev mode write attempts
- Whether to remove unused legacy functions (e.g., audio cache, some `KEYS` entries) during gutting

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Storage Architecture
- `src/services/storage.ts` — Legacy localStorage module being replaced with facade (current: 33 exports, sync)
- `src/services/supabase/storage.ts` — Supabase storage implementation (async, ~700 lines, the actual data layer)
- `src/services/supabase/index.ts` — Barrel re-exporting supabase/storage.ts exports
- `src/services/runtimeState.ts` — In-memory cache bridging Supabase reads to sync access (hydrateRuntimeState, getRuntime* getters)

### Prior Phase Context
- `.planning/phases/04-secure-storage/04-CONTEXT.md` — Encryption architecture decisions, dev mode handling, API key routing (all locked)
- `.planning/phases/01-dev-mode-routing/01-CONTEXT.md` — Dev mode requirements (full app must render without Supabase)

### Requirements
- `.planning/REQUIREMENTS.md` — STOR-01 (single storage module), STOR-02 (zero duplicate signatures)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `runtimeState.ts`: Already provides sync cached getters for model config, gamification, API keys, conversation tone, user context — facade can re-export these directly for sync access
- `supabase/storage.ts`: Complete async CRUD implementation for cards, gamification, sessions, paths, reports, settings — facade delegates to this
- `supabase/index.ts`: Barrel file already re-exports all supabase/storage.ts functions — pattern to follow

### Established Patterns
- `runtimeState.ts` uses `getRuntime*` prefix for sync cached getters — facade should re-use, not duplicate
- Legacy `storage.ts` already delegates some reads to runtimeState (e.g., `getGamification()` calls `getRuntimeGamification()`) — pattern to expand
- Import convention: `import { func } from '../../services/storage'` (components) or `'./storage'` (peer services)

### Integration Points
- 7 files importing from legacy `storage.ts`: DiscoveryPage, Header, Sidebar, ConversationAnalysis, images.ts, useTTS, geminiLive, openaiRealtimeLive
- 14 files importing from `supabase/storage.ts`: ExerciseMode, ImageMode, HistoryPage, LibraryPage, ConversationAnalysis (dual import!), ScenarioSetup, PathsPage, PracticePage, ReviewPage, SettingsPage, errorAnalysis, gamification, runtimeState, supabase/index
- `runtimeState.ts` hydrates from `supabase/storage.ts` on login — this dependency chain stays intact
- `storage.ts` currently imports from `runtimeState.ts` — circular dependency risk if facade also imports from runtimeState (mitigated: runtimeState doesn't import from storage.ts, it imports from supabase/storage.ts)

</code_context>

<specifics>
## Specific Ideas

- "Keep named wrappers" — user prefers minimal call site disruption over API purity
- Hybrid sync/async chosen specifically because most legacy imports already use cached data via runtimeState
- Auth-aware routing chosen because Phase 1 requires full dev mode support without Supabase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-storage-consolidation*
*Context gathered: 2026-04-02*
