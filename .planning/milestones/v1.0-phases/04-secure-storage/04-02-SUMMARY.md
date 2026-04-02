---
phase: 04-secure-storage
plan: 02
subsystem: security
tags: [proxy, api-keys, client-cleanup, edge-function, dev-mode]

# Dependency graph
requires:
  - phase: 04-01
    provides: Server-side PBKDF2 encryption/decryption in Edge Function, auto-migration of plaintext keys
provides:
  - All AI calls routed through Edge Function proxy (no direct browser-to-provider calls)
  - Client-side encryption code removed (encryption.ts gutted to session token only)
  - Dev mode shows env-var-only notice and read-only key fields in Settings
  - No hardcoded fallback secret in client code
affects: [storage-consolidation, praticar-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [proxy-only AI dispatch, dev-mode-gated settings, thin dispatcher pattern]

key-files:
  created: []
  modified:
    - src/services/openai.ts
    - src/utils/encryption.ts
    - src/services/supabase/aiProxy.ts
    - src/components/settings/SettingsPage.tsx
    - src/services/openai.test.ts

key-decisions:
  - "openai.ts rewritten as thin dispatcher -- no direct API calls, no key access"
  - "withFallback kept for API compatibility but never executes direct fallback"
  - "Dev mode uses isDevMode flag (no VITE_SUPABASE_URL) for read-only key fields"
  - "Audio cache removed from openai.ts as tradeoff for proxy-only security"

patterns-established:
  - "Proxy-only dispatch: all AI calls go through aiProxy.ts, openai.ts is a thin router"
  - "Dev mode gating: isDevMode pattern for read-only fields and env-var-only notice"

requirements-completed: [SEC-01, SEC-04]

# Metrics
duration: 4min
completed: 2026-04-02
---

# Phase 04 Plan 02: Client Cleanup & Proxy-Only AI Calls Summary

**All AI calls routed through Edge Function proxy with client-side encryption fully removed and dev-mode-gated Settings page**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-02T17:55:41Z
- **Completed:** 2026-04-02T18:00:34Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Eliminated all direct browser-to-provider API calls -- openai.ts is now a thin dispatcher to aiProxy.ts
- Gutted encryption.ts to only storeSessionToken/clearSessionToken, removing fallback-secret and all crypto functions
- Updated withFallback to proxy-only (parameter kept for API compatibility but never executes direct calls)
- Added dev mode detection with amber notice banner and disabled key fields in Settings
- Updated openai.test.ts to mock aiProxy instead of storage/direct calls

## Task Commits

Each task was committed atomically:

1. **Task 1: Redirect openai.ts through aiProxy and gut encryption.ts** - `b20f49b` (feat)
2. **Task 2: Update SettingsPage dev mode and verify realtime key flow** - `68d2200` (feat)

## Files Created/Modified
- `src/services/openai.ts` - Rewritten as thin proxy dispatcher; removed all direct API calls, key access, and audio caching
- `src/utils/encryption.ts` - Gutted to session token storage only (28 lines, down from 252)
- `src/services/supabase/aiProxy.ts` - withFallback updated to proxy-only (never executes direct fallback)
- `src/components/settings/SettingsPage.tsx` - Added isDevMode detection, amber notice banner, disabled key fields
- `src/services/openai.test.ts` - Updated to mock aiProxy instead of storage, testing proxy dispatch pattern

## Decisions Made
- openai.ts completely rewritten rather than patched -- cleaner than wrapping individual functions
- Audio cache (getCachedAudio/setCachedAudio) removed from openai.ts as acceptable security tradeoff since proxy responses don't include cacheable base64 audio the same way
- withFallback parameter signature preserved for API compatibility -- consumers still pass two functions but only the proxy call executes
- detectProvider kept as-is from original file for model ID to provider resolution
- Groq image fallback to gemini-2.5-flash preserved in chatCompletionWithImage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated openai.test.ts to match new proxy architecture**
- **Found during:** Task 1 (Rewrite openai.ts)
- **Issue:** Test file mocked `./storage` and `@google/genai` which are no longer imported by the rewritten openai.ts -- tests would fail
- **Fix:** Rewrote test file to mock `./supabase/aiProxy` and `./runtimeState` instead, updated all test cases to verify proxy dispatch behavior
- **Files modified:** src/services/openai.test.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** b20f49b (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Test update was necessary for correctness -- old tests would not compile against the rewritten module.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SEC-01 (no hardcoded fallback secret): resolved (removed from encryption.ts)
- SEC-04 (no direct browser-to-provider calls): resolved (all calls through proxy)
- Ready for Phase 05 (Storage Consolidation) -- storage.ts API key functions still exist but are no longer called by openai.ts

## Self-Check: PASSED

- FOUND: src/services/openai.ts
- FOUND: src/utils/encryption.ts
- FOUND: src/services/supabase/aiProxy.ts
- FOUND: src/components/settings/SettingsPage.tsx
- FOUND: src/services/openai.test.ts
- FOUND: commit b20f49b
- FOUND: commit 68d2200
- FOUND: 04-02-SUMMARY.md

---
*Phase: 04-secure-storage*
*Completed: 2026-04-02*
