---
phase: 04-secure-storage
plan: 01
subsystem: security
tags: [pbkdf2, aes-256-gcm, encryption, edge-function, deno, supabase]

# Dependency graph
requires:
  - phase: none
    provides: n/a - first plan in phase
provides:
  - PBKDF2 key derivation with 600K iterations in Edge Function
  - Server-side encrypt/decrypt with random salt per operation
  - Auto-migration of plaintext and legacy-encrypted API keys
affects: [04-02, storage-consolidation]

# Tech tracking
tech-stack:
  added: []
  patterns: [PBKDF2-AES-GCM encryption, encrypt-on-save/decrypt-on-read, transparent plaintext migration]

key-files:
  created: []
  modified:
    - supabase/functions/ai-proxy/index.ts

key-decisions:
  - "600K PBKDF2 iterations with SHA-256 for key derivation (OWASP recommended minimum)"
  - "Random 16-byte salt per encryption operation prevents rainbow table attacks"
  - "Auto-migration re-encrypts plaintext keys on first read transparently"

patterns-established:
  - "Encrypt-on-save, decrypt-on-read: all keys encrypted at rest with PBKDF2-derived AES-256-GCM"
  - "Transparent migration: getApiKey auto-detects plaintext/old-format and re-encrypts server-side"

requirements-completed: [SEC-01, SEC-02, SEC-03]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 04 Plan 01: Server-Side Encryption Summary

**PBKDF2 key derivation (600K iterations) with random salt and AES-256-GCM encryption for API keys in the Edge Function, plus transparent plaintext migration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T17:49:40Z
- **Completed:** 2026-04-02T17:51:51Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced raw-key AES-GCM decryption with PBKDF2-derived keys (600K iterations, SHA-256)
- Added encrypt() function with random 16-byte salt and 12-byte IV per operation
- saveApiKey now encrypts keys server-side before storing in database
- getApiKey decrypts new-format keys and auto-migrates plaintext/legacy keys by re-encrypting

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PBKDF2 encryption utilities** - `ee26eb2` (feat)
2. **Task 2: Wire encryption into saveApiKey/getApiKey with migration** - `46c7845` (feat)

## Files Created/Modified
- `supabase/functions/ai-proxy/index.ts` - Added PBKDF2 deriveKey(), encrypt(), decrypt(); wired into saveApiKey/getApiKey with plaintext auto-migration

## Decisions Made
- 600K PBKDF2 iterations chosen per OWASP recommendation for AES-GCM key derivation
- Random salt (16 bytes) generated per encryption operation to prevent rainbow table and related-key attacks
- Old format keys ({ciphertext, iv} without salt) treated as broken encryption and migrated to new format on first read
- Plaintext keys detected by JSON parse failure and migrated transparently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required. The ENCRYPTION_KEY environment variable was already required by the Edge Function.

## Next Phase Readiness
- SEC-01 (no hardcoded fallback secret): resolved
- SEC-02 (PBKDF2 600K+ iterations): resolved
- SEC-03 (random salt per encryption): resolved
- Ready for Plan 04-02 (client-side cleanup and proxy-only AI calls)

## Self-Check: PASSED

- FOUND: supabase/functions/ai-proxy/index.ts
- FOUND: commit ee26eb2
- FOUND: commit 46c7845
- FOUND: 04-01-SUMMARY.md

---
*Phase: 04-secure-storage*
*Completed: 2026-04-02*
