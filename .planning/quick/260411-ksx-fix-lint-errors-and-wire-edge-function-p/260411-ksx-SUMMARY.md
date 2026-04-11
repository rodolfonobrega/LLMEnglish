---
phase: quick
plan: 260411-ksx
subsystem: edge-function
tags: [refactor, lint, ai-proxy, deduplication]
dependency_graph:
  requires: []
  provides: [clean-index-ts, lint-fix-exercisemode]
  affects: [supabase/functions/ai-proxy/index.ts, src/components/discovery/ExerciseMode.tsx]
tech_stack:
  added: []
  patterns: [namespace-import, module-delegation, closure-wrapper]
key_files:
  created: []
  modified:
    - supabase/functions/ai-proxy/index.ts
    - src/components/discovery/ExerciseMode.tsx
decisions:
  - sourceToDbColumn not imported in index.ts — it is only needed inside api-keys.ts, which already imports it from the module; no call site in index.ts serve() handler
  - base64urlEncode and uint8ToBase64url removed from index.ts — they were only used inside getVertexAccessToken which now lives in providers/vertex.ts
  - getApiKey and saveApiKey kept as thin closure wrappers — their signatures differ from the module functions (no supabase/ENCRYPTION_KEY params), preserving serve() handler call sites unchanged
metrics:
  duration: ~5min
  completed: "2026-04-11"
  tasks_completed: 2
  files_modified: 2
---

# Quick 260411-ksx: Fix Lint Errors and Wire Edge Function Modules — Summary

**One-liner:** Removed unused icon imports from ExerciseMode.tsx and refactored ai-proxy index.ts to delegate to sibling modules, eliminating ~1000 lines of duplicate inline code.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Commit ExerciseMode.tsx lint fix | 274ac0e | src/components/discovery/ExerciseMode.tsx |
| 2 | Wire module imports into index.ts, remove duplicate inline code | 885e5dc | supabase/functions/ai-proxy/index.ts |

## What Was Done

**Task 1:** The unused `ImageIcon` and `Mic` imports were already removed from ExerciseMode.tsx (pre-applied change). Staged and committed.

**Task 2:** Rewrote `supabase/functions/ai-proxy/index.ts` from 1464 lines to 375 lines:
- Added namespace imports for all 5 provider modules (`Gemini`, `OpenAI`, `Groq`, `OpenRouter`, `Vertex`)
- Added imports for `uint8ToBase64` from `./utils.ts` and `normalizeSource`, `getApiKey`/`saveApiKey` aliases from `./api-keys.ts`
- Removed all duplicate inline function bodies: encryption utilities, source helpers, API key retrieval, all chat/TTS/STT/image provider functions
- Kept 3 local functions: `isSafeImageUrl` (SSRF guard, not in any module), `getApiKey` wrapper, `saveApiKey` wrapper (closures over module-level `supabase` + `ENCRYPTION_KEY`)
- All serve() handler routing logic preserved exactly — only call sites updated from `openaiChat(...)` style to `OpenAI.chat(...)` style

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Module import chain is co-located in the same Edge Function bundle.

## Self-Check: PASSED

- `supabase/functions/ai-proxy/index.ts` exists and is 375 lines
- `src/components/discovery/ExerciseMode.tsx` exists
- Commit 274ac0e exists: `fix: remove unused ImageIcon and Mic imports from ExerciseMode`
- Commit 885e5dc exists: `fix: wire module imports into ai-proxy index.ts, remove duplicate inline code`
- `grep -c "^async function\|^function" index.ts` returns 3
- File ends with `})` closing the serve() handler
