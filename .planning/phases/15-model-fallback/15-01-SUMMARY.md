---
phase: 15-model-fallback
plan: 01
subsystem: types
tags: [model-config, fallback, live-session, factory-pattern, typescript]

# Dependency graph
requires: []
provides:
  - imageFallbackModel and imageFallbackSource fields in ModelConfig type
  - migrateModelConfig support for legacy and new image fallback fields
  - Factory-pattern LiveSession.tsx that respects liveSource config
affects: [15-02, settings-ui, image-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [factory-pattern-for-live-session, image-fallback-type-extensions]

key-files:
  created: []
  modified:
    - src/types/settings.ts
    - src/components/live-roleplay/LiveSession.tsx

key-decisions:
  - "imageFallbackSource uses narrowed type matching imageSource (excludes groq) since Groq has no image models"
  - "Factory uses simple ternary (openai vs default) since liveSource only has 3 valid values and default fallback is Gemini"

patterns-established:
  - "Image fallback fields follow existing chat/stt/tts fallback pattern in ModelConfig"
  - "Live session factory reads runtime config to select provider class via ternary"

requirements-completed: [IMAGE-FALLBACK-TYPES, LIVE-FACTORY]

# Metrics
duration: 17min
completed: 2026-04-10
---

# Phase 15 Plan 01: Model Fallback Types & Live Factory Summary

**Extended ModelConfig with image fallback fields and refactored LiveSession to use factory pattern selecting Gemini or OpenAI provider based on liveSource config**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-10T01:48:03Z
- **Completed:** 2026-04-10T02:05:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `imageFallbackModel` and `imageFallbackSource` optional fields to ModelConfig interface
- Added migration support for both legacy `imageFallbackProvider` and new `imageFallbackSource` field names
- Refactored LiveSession.tsx from hardcoded `GeminiLiveSession` to factory pattern using `getRuntimeModelConfig().liveSource`
- Typed sessionRef as `ILiveSession` interface instead of concrete `GeminiLiveSession` class

## Task Commits

Each task was committed atomically:

1. **Task 1: Add image fallback fields to ModelConfig type system** - `e03b6c7` (feat)
2. **Task 2: Refactor LiveSession.tsx to use factory pattern based on liveSource config** - `8bba531` (feat)

## Files Created/Modified
- `src/types/settings.ts` - Added imageFallbackModel/imageFallbackSource to ModelConfig, added migration blocks in migrateModelConfig
- `src/components/live-roleplay/LiveSession.tsx` - Added imports for OpenAIRealtimeLiveSession, ILiveSession, getRuntimeModelConfig; changed sessionRef type; refactored session creation with factory ternary

## Decisions Made
- Used narrowed type `'genai' | 'vertex' | 'openai' | 'openrouter'` for `imageFallbackSource` matching `imageSource` since Groq has no image generation capability
- Factory ternary defaults to Gemini for any non-'openai' liveSource value (covers 'genai' and 'vertex')
- Migration handles both direct-copy (new field names) and legacy (imageFallbackProvider) paths

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failures in `audioCache.test.ts` (5 failures related to IndexedDB Blob mocking) - unrelated to this plan's changes, all 173 other tests pass

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- ModelConfig type system extended and ready for Plan 15-02 (fallback logic implementation)
- LiveSession factory pattern ready for settings UI to control liveSource selection
- Image fallback fields available for image generation fallback chain implementation

---
*Phase: 15-model-fallback*
*Completed: 2026-04-10*

## Self-Check: PASSED

- FOUND: src/types/settings.ts
- FOUND: src/components/live-roleplay/LiveSession.tsx
- FOUND: .planning/phases/15-model-fallback/15-01-SUMMARY.md
- FOUND: e03b6c7 (Task 1 commit)
- FOUND: 8bba531 (Task 2 commit)
