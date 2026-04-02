---
phase: 04-secure-storage
verified: 2026-04-02T19:15:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/9
  gaps_closed:
    - "Edge Function encrypts API keys with PBKDF2-derived key (600K+ iterations) and random salt before storing in DB"
    - "Edge Function decrypts keys on read using the same PBKDF2 key derivation"
    - "Plaintext keys in DB are auto-migrated to encrypted format on first read"
    - "Encryption uses PBKDF2 with 600K+ iterations and a unique random salt per user"
  gaps_remaining: []
  regressions: []
---

# Phase 04: Secure Storage Verification Report

**Phase Goal:** User API keys are properly encrypted at rest and never sent directly to AI providers from the browser
**Verified:** 2026-04-02T19:15:00Z
**Status:** passed
**Re-verification:** Yes -- after gap closure (PBKDF2 cherry-pick commit 049d100 merged to main)

## Goal Achievement

### Observable Truths

Plan 04-01 must-haves (4 truths):

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Edge Function encrypts API keys with PBKDF2-derived key (600K+ iterations) and random salt before storing in DB | VERIFIED | `saveApiKey()` at line 142 calls `await encrypt(key, ENCRYPTION_KEY)`. `encrypt()` at line 77 generates random 16-byte salt via `crypto.getRandomValues`, uses `deriveKey()` with PBKDF2 600K iterations (line 33). Result stored as `JSON.stringify(encrypted)` with `{ciphertext, iv, salt}` format. |
| 2 | Edge Function decrypts keys on read using the same PBKDF2 key derivation | VERIFIED | `decrypt()` at line 61 accepts `(ciphertext, iv, salt, key)` -- 4 params with salt. Calls `deriveKey(key, saltBytes)` then `crypto.subtle.decrypt` with AES-GCM. `getApiKey()` at line 124 calls `decrypt(parsed.ciphertext, parsed.iv, parsed.salt, ENCRYPTION_KEY)`. |
| 3 | Plaintext keys in DB are auto-migrated to encrypted format on first read | VERIFIED | `getApiKey()` at lines 120-135: tries JSON parse, checks for new format `{ciphertext, iv, salt}`, falls through on old format or parse failure, then calls `await saveApiKey(userId, provider, plaintextValue)` at line 134 to re-encrypt and store. Returns plaintext immediately. |
| 4 | No hardcoded fallback secret exists in the encryption path | VERIFIED | `grep -rn "fallback-secret" src/ supabase/` returns zero matches in source code. Only found in planning/documentation files. Edge Function requires `ENCRYPTION_KEY` env var (line 19-22). Client-side `encryption.ts` has no fallback patterns. |

Plan 04-02 must-haves (5 truths):

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | All non-WebSocket AI calls route through Edge Function proxy (no direct browser-to-provider calls) | VERIFIED | `src/services/openai.ts` (174 lines) imports only from `./supabase/aiProxy` and `./runtimeState`. No direct API URLs (`api.openai.com`, `api.groq.com`, etc.) in the file. `grep` confirms zero matches. All exported functions (chatCompletion, textToSpeech, speechToText, generateImage, chatCompletionWithImage) delegate to proxyChat/proxyTTS/proxySTT/proxyImage. |
| 6 | Client-side encryption code (encryption.ts) is gutted -- no encrypt/decrypt/deriveUserKey functions exported | VERIFIED | `src/utils/encryption.ts` is 28 lines, exports only `storeSessionToken` and `clearSessionToken`. Comment: "All encryption/decryption is handled server-side by the Edge Function." |
| 7 | Realtime WebSocket connections still receive decrypted keys from Edge Function get_key action | VERIFIED | Edge Function `get_key` handler at line 623-625 calls `getApiKey(userId, body.provider)` and returns decrypted key. `src/services/supabase/aiProxy.ts` exports `getGeminiKeyForLive()` which calls `callAIProxy({ action: 'get_key', provider: 'gemini' })`. `openaiRealtimeLive.ts` at line 37 uses `wss://api.openai.com` -- this is the expected WebSocket realtime exception per D-03. |
| 8 | Dev mode shows env-var-only notice and read-only key fields in Settings | VERIFIED | `SettingsPage.tsx`: `isDevMode = !import.meta.env.VITE_SUPABASE_URL` (line 50). Amber banner with "API keys loaded from environment variables." Three key inputs disabled at lines 350, 362, 374 with `disabled={isDevMode}`. Save handler guarded at line 159 with `if (isDevMode) return`. |
| 9 | No hardcoded fallback secret remains in client-side code | VERIFIED | `grep -rn "fallback-secret" src/` returns zero matches. `encryption.ts` has no fallback patterns. `withFallback` in `aiProxy.ts` never executes direct fallback call. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/functions/ai-proxy/index.ts` | Server-side PBKDF2 encryption with 600K iterations, random salt, encrypt/decrypt, migration | VERIFIED | PBKDF2_ITERATIONS=600_000, deriveKey(), encrypt(), decrypt() all present. saveApiKey encrypts, getApiKey decrypts+migrates. |
| `src/utils/encryption.ts` | Only storeSessionToken and clearSessionToken (no encryption) | VERIFIED | 28 lines, only session token functions exported. |
| `src/services/supabase/aiProxy.ts` | Proxy-only AI calls with no direct fallback | VERIFIED | `withFallback` at line 216-222 always calls `proxyCall()`, never `fallbackCall()`. `_fallbackCall` parameter prefixed with underscore (unused). |
| `src/services/openai.ts` | Thin dispatcher to aiProxy.ts (no direct API calls) | VERIFIED | 174 lines, imports from `./supabase/aiProxy` only. No direct API URLs, no key access, no storage imports. |
| `src/components/settings/SettingsPage.tsx` | Dev mode notice and read-only key fields | VERIFIED | isDevMode detection, amber banner, 3 disabled inputs, guarded save handler. |

### Key Link Verification

**Plan 04-01 Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| saveApiKey() | encrypted_api_keys table | encrypt-then-store with PBKDF2 deriveKey | WIRED | Line 142: `await encrypt(key, ENCRYPTION_KEY)`, line 143: `JSON.stringify(encrypted)`, line 152: stored via Supabase update/insert. |
| getApiKey() | encrypted_api_keys table | read-then-decrypt with PBKDF2 + migration | WIRED | Line 103: Supabase select, line 124: `decrypt(parsed.ciphertext, parsed.iv, parsed.salt, ENCRYPTION_KEY)`, line 134: auto-migrate via `saveApiKey()`. |

**Plan 04-02 Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ExerciseMode.tsx | aiProxy.ts | import chain through openai.ts (chatCompletion, speechToText, textToSpeech) | WIRED | ExerciseMode.tsx has 5 matches for these function names. openai.ts delegates all to proxy functions. |
| SettingsPage.tsx | supabase/storage.ts saveApiKeys | saveApiKeys() call | WIRED | Line 6: import, line 163: `await saveApiKeys(...)`, line 159: isDevMode guard. |
| auth.ts | encryption.ts | storeSessionToken, clearSessionToken only | WIRED | Line 9: imports both functions, used at lines 66, 96, 139, 152. No encryption functions imported. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| supabase/functions/ai-proxy/index.ts saveApiKey() | encryptedValue | encrypt(key, ENCRYPTION_KEY) with PBKDF2 + random salt | Stores `{ciphertext, iv, salt}` JSON to DB | FLOWING |
| supabase/functions/ai-proxy/index.ts getApiKey() | decrypted key | decrypt() with PBKDF2 or plaintext migration | Returns plaintext key for AI actions | FLOWING |
| src/services/openai.ts | proxyChat/proxyTTS/proxySTT/proxyImage | aiProxy.ts callAIProxy() | Routes to Edge Function proxy | FLOWING |
| SettingsPage.tsx key inputs | isDevMode | import.meta.env.VITE_SUPABASE_URL | Controls disabled state and notice banner | FLOWING |
| Edge Function get_key handler | key | getApiKey() decrypts from DB | Returns plaintext for realtime WebSocket | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED (Edge Function runs on Deno/Supabase, not locally testable. Client-side changes verified via code inspection. TypeScript compiles cleanly with `npx tsc --noEmit`.)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 04-01, 04-02 | API keys not decryptable with hardcoded fallback secret | SATISFIED | No `fallback-secret` in source code. Edge Function requires ENCRYPTION_KEY env var. Client-side encryption.ts gutted. |
| SEC-02 | 04-01 | Encryption uses OWASP-recommended PBKDF2 iterations (600K+) | SATISFIED | `PBKDF2_ITERATIONS = 600_000` at line 33. `deriveKey()` uses PBKDF2 with SHA-256. |
| SEC-03 | 04-01 | Each user gets unique random salt for encryption | SATISFIED | `encrypt()` generates random 16-byte salt via `crypto.getRandomValues(new Uint8Array(SALT_LENGTH))` per operation. |
| SEC-04 | 04-02 | API keys not sent directly to AI providers from browser | SATISFIED | openai.ts is thin proxy dispatcher. No direct API URLs. withFallback is proxy-only. Exception: WebSocket realtime connections use `wss://` with key from Edge Function `get_key` action (by design per D-03). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/services/openaiRealtimeLive.ts | 37 | `wss://api.openai.com` direct WebSocket URL | Info | Expected per design (D-03): realtime WebSocket connections hold keys in memory, obtained from Edge Function `get_key` action. Not a regular API call. |

No blocker or warning anti-patterns found in modified files.

### Human Verification Required

None required -- all 9 truths verified programmatically. The only item that would benefit from manual confirmation:

1. **End-to-end key encryption flow** -- In a running environment with Supabase, verify that saving an API key through Settings results in encrypted `{ciphertext, iv, salt}` JSON in the `encrypted_api_keys` table, and that subsequent AI calls successfully decrypt and use the key. This requires a live Supabase environment.

### Gaps Summary

**All gaps from previous verification have been closed.** Commit `049d100` ("feat(04-01): cherry-pick PBKDF2 encryption into Edge Function") successfully merged the PBKDF2 encryption code into main. All 9 observable truths across both plans are verified:

- Plan 04-01 (server-side encryption): PBKDF2 with 600K iterations, random salt per encryption, encrypt-on-save, decrypt-on-read, and transparent plaintext migration all present and wired in the Edge Function.
- Plan 04-02 (client cleanup): openai.ts is a thin proxy dispatcher, encryption.ts gutted to session tokens only, withFallback is proxy-only, SettingsPage has dev mode gating, and no fallback-secret in client code.

All 4 security requirements (SEC-01 through SEC-04) are satisfied. TypeScript compiles cleanly with zero errors.

---

_Verified: 2026-04-02T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
