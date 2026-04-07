# Phase 8: Dead Code & Config Cleanup - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove dead Groq proxy configuration and stale coverage references from build/deployment config files. This is a clean-up phase that prepares a clean foundation for subsequent v1.2 phases (Model Catalog, Edge Function Modularization, etc.).

**Scope:** Config file edits only — no source code changes, no new files.
**Files touched:** `vite.config.ts`, `vitest.smoke.config.ts`, `nginx.conf`

</domain>

<decisions>
## Implementation Decisions

### Cleanup Scope
- **D-01:** Remove dead `/api/groq` proxy from all 3 files, not just `vite.config.ts`:
  - `vite.config.ts` — server.proxy block (DC-01)
  - `vitest.smoke.config.ts` — identical proxy block (discovered during scout)
  - `nginx.conf` — `location /api/groq/` reverse proxy block (discovered during scout)
  - Zero consumers confirmed — no references to `/api/groq` anywhere in `src/`

### Coverage Config
- **D-02:** Remove only the stale `openaiRealtimeLive.ts` reference from coverage include in `vite.config.ts` (DC-02). Keep remaining coverage config (2 files, current thresholds) as-is. No expansion.

### Config Structure
- **D-03:** Remove the entire `server: {}` key from `vite.config.ts` after proxy removal — empty keys add noise.

### Claude's Discretion
- Whether to also clean `/api/groq` comments from `vite.config.ts` header (lines 6-10) if they become misleading after removal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Dead Code Cleanup (DC) — DC-01 and DC-02 requirements

### Config files to modify
- `vite.config.ts` — main build config, lines 23-44 targeted
- `vitest.smoke.config.ts` — smoke test config with identical proxy block
- `nginx.conf` — production server config with `/api/groq/` location block

### Project context
- `.planning/ROADMAP.md` §Phase 8 — success criteria and dependencies
- `.planning/PROJECT.md` — constraints (no breaking changes, client-side only)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None needed — this is a deletion-only phase.

### Established Patterns
- `vite.config.ts` is the single Vite config for both dev server and Vitest
- `vitest.smoke.config.ts` is a separate config for smoke tests — mirrors vite.config.ts structure
- `nginx.conf` is the production deployment config

### Integration Points
- `src/services/openaiRealtimeLive.ts` was deleted in v1.1 (Phase 7) — only the coverage reference remains
- Groq API calls now route through the Supabase Edge Function `ai-proxy` — the `/api/groq` proxy is vestigial

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward config cleanup. All changes are deletions.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-dead-code-config-cleanup*
*Context gathered: 2026-04-07*
