---
phase: 10-edge-function-modularization
plan: 03
subsystem: edge-function
tags: [deno, supabase-edge-function, thin-router, structured-logging, modularization]

# Dependency graph
requires:
  - phase: 10-edge-function-modularization/01
    provides: [crypto.ts, utils.ts, api-keys.ts, log.ts]
  - phase: 10-edge-function-modularization/02
    provides: [providers/openai.ts, providers/gemini.ts, providers/groq.ts, providers/openrouter.ts, providers/vertex.ts]
provides:
  - supabase/functions/ai-proxy/index.ts - Thin router delegating to all extracted modules
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [Thin router with action handler functions, provider dispatch via lookup objects, shared helper closures for key/save]

key-files:
  created: []
  modified:
    - supabase/functions/ai-proxy/index.ts

key-decisions:
  - "Used lookup objects for provider dispatch (e.g., { openai: openai.chat, genai: gemini.chat }[source]) to avoid verbose if/else chains"
  - "Extracted resolveImage helper to deduplicate the data-URL-fetch-to-base64 pattern shared by vertex and genai imageMode chat"
  - "Created vertexCtx helper closure to deduplicate the recurring Promise.all([vertex.getAccessToken(), vertex.getConfig(supabase, userId)]) pattern"
  - "Kept Gemini imageMode dynamic import inline in handleChat rather than adding chatWithImage to gemini.ts, avoiding a second touch of the provider module"

patterns-established:
  - "Thin router pattern: index.ts as serve() handler with switch/case delegating to handler functions"
  - "Closure aliases (key, save, vertexCtx) to reduce parameter-passing verbosity for repeated calls"

requirements-completed: [EF-01, EF-02, EF-03, EF-05]

# Metrics
duration: 4min
started: 2026-04-08T03:52:48Z
completed: 2026-04-08T03:56:30Z
tasks: 1
files: 1
---

# Phase 10 Plan 03: Thin Router Summary

1364-line monolith rewritten as 106-line thin router that delegates to 4 extracted foundation modules and 5 provider modules, with structured logging wrapping every request.

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T03:52:48Z
- **Completed:** 2026-04-08T03:56:30Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced 1364-line monolith with 106-line thin router (92% reduction)
- All 8 action types produce identical response shapes as original
- Structured logging with request ID on every request
- No raw console.log/console.error in index.ts (all through log module)

## Task Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | Rewrite index.ts as thin router with structured logging | 3a93d92 | feat |

## Files Modified
- `supabase/functions/ai-proxy/index.ts` - Thin router with 4 action handlers (handleChat, handleTts, handleStt, handleImage), CORS, auth verification, structured logging

## Decisions Made
1. **Lookup objects for provider dispatch** -- Used `{ openai: openai.chat, genai: gemini.chat }[source]` instead of verbose if/else chains, cutting the handler functions from ~30 lines each to ~5-8 lines
2. **resolveImage helper** -- Extracted the data-URL parsing and remote-fetch-to-base64 pattern into a shared helper, eliminating duplication between vertex and genai imageMode chat paths
3. **vertexCtx closure** -- Created `const vertexCtx = (uid) => Promise.all([vertex.getAccessToken(), vertex.getConfig(supabase, uid)])` to deduplicate the recurring Vertex auth+config pattern
4. **Inline Gemini imageMode dynamic import** -- Kept the `@google/generative-ai@0.21.0` dynamic import in handleChat rather than adding a `chatWithImage` export to gemini.ts, avoiding a second modification of the provider module

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Module Structure (Complete)

```
supabase/functions/ai-proxy/
  index.ts              (106 lines) - Thin router + CORS + auth + action dispatch
  crypto.ts             (65 lines)  - AES-256-GCM encrypt/decrypt
  api-keys.ts           (110 lines) - API key CRUD + source normalization
  log.ts                (22 lines)  - Structured logging with request ID
  utils.ts              (48 lines)  - pcm16ToWav, writeString, str2ab
  providers/
    openai.ts           (117 lines) - chat, tts, stt, image
    gemini.ts           (158 lines) - chat, tts, stt, image
    groq.ts             (87 lines)  - chat, tts, stt
    openrouter.ts       (139 lines) - chat, tts, stt, image
    vertex.ts           (304 lines) - getAccessToken, getConfig, chat, chatWithImage, tts, stt, image
```
Total: 9 files, ~1156 lines (from original 1364 lines in 1 file)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Module split is complete (9 files total: EF-01)
- index.ts is under 120 lines (EF-02)
- All action types produce identical response shapes (EF-03)
- Structured logging with request ID on every request (EF-05)
- EF-04 (local testing) requires Supabase CLI deployment verification

## Self-Check: PASSED

- index.ts verified present on disk
- Commit hash 3a93d92 verified in git log
- Line count: 106 (under 120 limit)
- All 5 provider imports verified
- api-keys.ts and log.ts imports verified
- createRequestLogger usage verified
- No raw console.log/console.error in index.ts
- All 8 response shapes match client contract

---
*Phase: 10-edge-function-modularization*
*Completed: 2026-04-08*
