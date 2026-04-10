---
phase: 10-edge-function-modularization
plan: 01
subsystem: edge-function
tags: [deno, supabase-edge-function, modularization, crypto, api-keys, logging]
dependency_graph:
  requires: []
  provides: [crypto.ts, utils.ts, api-keys.ts, log.ts]
  affects: [supabase/functions/ai-proxy/]
tech-stack:
  added: []
  patterns: [Deno ES module imports with explicit .ts extensions, parameter injection instead of closure-captured state]
key-files:
  created:
    - supabase/functions/ai-proxy/crypto.ts
    - supabase/functions/ai-proxy/utils.ts
    - supabase/functions/ai-proxy/api-keys.ts
    - supabase/functions/ai-proxy/log.ts
  modified: []
decisions:
  - "Thread supabase client and encryptionKey as function parameters in api-keys.ts to avoid shared mutable state across modules"
  - "Use crypto.randomUUID() for request ID generation in log.ts (available in Deno Web Crypto API)"
metrics:
  duration: 5min
  completed: 2026-04-08
  tasks: 2
  files: 4
---

# Phase 10 Plan 01: Foundation Modules Summary

AES-256-GCM crypto, API key management, structured logging, and WAV conversion extracted from the ai-proxy monolith into 4 independent Deno modules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create crypto.ts and utils.ts | b22fc3e | crypto.ts, utils.ts |
| 2 | Create api-keys.ts and log.ts | d979fd1 | api-keys.ts, log.ts |

## What Changed

### crypto.ts (65 lines)
Exports 4 constants (`PBKDF2_ITERATIONS`, `SALT_LENGTH`, `IV_LENGTH`, `KEY_LENGTH`) and 3 functions (`deriveKey`, `decrypt`, `encrypt`). Code extracted verbatim from index.ts lines 29-93. No dependencies on other modules.

### utils.ts (48 lines)
Exports 3 pure functions (`str2ab`, `pcm16ToWav`, `writeString`). Code extracted verbatim from index.ts lines 907-918 and 1037-1079. No dependencies on other modules.

### api-keys.ts (110 lines)
Exports `sourceToDbColumn`, `normalizeSource`, `getApiKey`, `saveApiKey`. Imports `decrypt` and `encrypt` from `./crypto.ts`. Key design change: `getApiKey` and `saveApiKey` accept `supabase` and `encryptionKey` as explicit parameters instead of relying on closure-captured module-level variables. This avoids shared mutable state and makes the modules safe for Deno ES module isolation.

### log.ts (22 lines)
New module implementing EF-05 structured logging. Exports `createRequestLogger(requestId?)` returning an object with `info()`, `error()`, and `getRequestId()` methods. Uses `crypto.randomUUID()` for automatic request ID generation. Outputs structured JSON to `console.log`/`console.error` for Deno Edge Function log capture.

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Parameter injection over closure capture in api-keys.ts**: The original `getApiKey` and `saveApiKey` relied on module-level `supabase` and `ENCRYPTION_KEY` variables. The extracted versions accept these as explicit parameters, making dependency injection clear and avoiding shared mutable state across Deno modules.

## Self-Check: PASSED

- All 4 files verified present on disk
- Both commit hashes (b22fc3e, d979fd1) verified in git log
- All exports match plan success criteria
- All Deno imports use explicit .ts extensions
