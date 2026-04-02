# Phase 5: Storage Consolidation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 05-storage-consolidation
**Areas discussed:** Facade strategy, Dev mode fallback, Sync vs async migration, API key function API

---

## Facade Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite storage.ts as facade | Keep import path, gut localStorage, delegate to supabase/storage.ts | ✓ |
| Use supabase/index.ts as THE import | All consumers import from barrel. Name collision risk with auth exports. | |
| New dedicated facade module | Create storageAdapter.ts. Cleanest separation but every import changes. | |

**User's choice:** Rewrite storage.ts as facade
**Notes:** Recommended option. Preserves all 7 existing import paths from legacy consumers. Only internals change.

---

## Dev Mode Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Auth-aware routing | Facade detects session. Authenticated → supabase. Dev mode → localStorage + runtimeState cache. | ✓ |
| Supabase-only + env vars | Always delegate to supabase. Dev mode reads from runtimeState (env vars). Throws on persist. | |
| Full localStorage fallback | Complete dual code path — full dev mode parity but more maintenance. | |

**User's choice:** Auth-aware routing
**Notes:** Balances Phase 1 dev mode requirement with clean Supabase delegation. Dev mode gets read-only data sufficient to render.

---

## Sync vs Async Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: cached=sync, queries=async | runtimeState-backed functions stay sync. One-shot reads (getCards, etc.) become async. | ✓ |
| All async everywhere | Every function async. Cleanest long-term but touches many call sites. | |
| Cache-everything sync reads | Pre-fetch all data at login. All reads sync. Writes async fire-and-forget. | |

**User's choice:** Hybrid — cached=sync, queries=async
**Notes:** Most legacy imports already use cached data (gamification, model config, API keys). Only true query functions need async migration.

---

## API Key Function API

| Option | Description | Selected |
|--------|-------------|----------|
| Keep named wrappers | getOpenAIKey() wraps getApiKey('openai'). Zero caller changes. ~12 lines of wrappers. | ✓ |
| Generic only, update callers | Remove named functions. All callers use getApiKey('openai'). Consistent with Supabase design. | |

**User's choice:** Keep named wrappers
**Notes:** User prefers minimal call site disruption. Named wrappers delegate to generic API internally.

---

## Claude's Discretion

- Exact auth detection method
- localStorage fallback code structure
- supabase/index.ts re-export deprecation timing
- Dev mode write error messages
- Removal of unused legacy functions during gutting

## Deferred Ideas

None — discussion stayed within phase scope
