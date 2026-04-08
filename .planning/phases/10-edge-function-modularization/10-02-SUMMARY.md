---
phase: 10-edge-function-modularization
plan: 02
subsystem: edge-function
tags: [deno, supabase-edge-function, provider-modules, openai, gemini, groq, openrouter, vertex-ai]

# Dependency graph
requires:
  - phase: 10-edge-function-modularization/01
    provides: [crypto.ts, utils.ts, api-keys.ts, log.ts]
provides:
  - providers/openai.ts - OpenAI chat, TTS, STT, image generation
  - providers/gemini.ts - Gemini chat, TTS, STT, image generation with dynamic imports
  - providers/groq.ts - Groq chat, TTS, STT
  - providers/openrouter.ts - OpenRouter chat, TTS, STT, image generation with SpeakLab headers
  - providers/vertex.ts - Vertex AI auth, config, chat, chatWithImage, TTS, STT, image
affects: [10-edge-function-modularization/03-router-refactor]

# Tech tracking
tech-stack:
  added: []
  patterns: [Provider modules with consistent export signatures, parameter injection for supabaseClient in vertex getConfig]

key-files:
  created:
    - supabase/functions/ai-proxy/providers/openai.ts
    - supabase/functions/ai-proxy/providers/gemini.ts
    - supabase/functions/ai-proxy/providers/groq.ts
    - supabase/functions/ai-proxy/providers/openrouter.ts
    - supabase/functions/ai-proxy/providers/vertex.ts
  modified: []

key-decisions:
  - "Vertex getConfig accepts supabaseClient as explicit parameter instead of closure-captured variable, matching api-keys.ts pattern from plan 01"
  - "Provider function names shortened (e.g., openaiChat becomes chat) since the module itself provides namespace"

patterns-established:
  - "Provider module pattern: each file exports chat/tts/stt/image with identical signatures per provider"
  - "Explicit .ts extensions on all relative Deno imports"

requirements-completed: [EF-01, EF-03]

# Metrics
duration: 7min
completed: 2026-04-08
tasks: 2
files: 5
---

# Phase 10 Plan 02: Provider Modules Summary

5 provider modules extracted from the ai-proxy monolith, each encapsulating a single AI provider's API calls with identical function signatures per action type.

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-08T03:41:06Z
- **Completed:** 2026-04-08T03:47:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Extracted 22 provider functions across 5 modules from the 1364-line monolith
- Preserved all dynamic imports (Gemini @google/generative-ai SDK) exactly as-is
- Vertex AI module accepts supabaseClient as parameter, avoiding shared mutable state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create OpenAI, Gemini, and Groq provider modules** - `56cd1fa` (feat)
2. **Task 2: Create OpenRouter and Vertex AI provider modules** - `4223e03` (feat)

## Files Created/Modified
- `supabase/functions/ai-proxy/providers/openai.ts` - OpenAI chat, TTS, STT, image (4 functions, no imports)
- `supabase/functions/ai-proxy/providers/gemini.ts` - Gemini chat, TTS, STT, image (4 functions, imports pcm16ToWav)
- `supabase/functions/ai-proxy/providers/groq.ts` - Groq chat, TTS, STT (3 functions, no imports)
- `supabase/functions/ai-proxy/providers/openrouter.ts` - OpenRouter chat, TTS, STT, image (4 functions, SpeakLab headers)
- `supabase/functions/ai-proxy/providers/vertex.ts` - Vertex AI auth, config, chat, chatWithImage, TTS, STT, image (7 functions, imports str2ab + pcm16ToWav)

## Decisions Made
- Vertex getConfig accepts supabaseClient as explicit parameter instead of closure-captured variable, matching the api-keys.ts pattern established in plan 01
- Provider function names shortened (e.g., openaiChat becomes chat) since the module itself provides namespace, reducing verbosity at call sites

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 provider modules ready for import by the thin router (plan 03)
- Function signatures match original monolith exactly, enabling drop-in replacement
- Gemini dynamic import for @google/generative-ai@0.21.0 preserved in both TTS and STT

## Self-Check: PASSED

- All 5 provider files verified present on disk
- Both commit hashes (56cd1fa, 4223e03) verified in git log
- All exports match plan success criteria (22 total functions)
- All Deno imports use explicit .ts extensions

---
*Phase: 10-edge-function-modularization*
*Completed: 2026-04-08*
