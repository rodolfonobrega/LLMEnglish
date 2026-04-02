# Phase 4: Secure Storage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-secure-storage
**Areas discussed:** Encryption key source, Realtime API routing, Key migration, Dev mode handling

---

## Encryption Key Source

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side only | Client sends plaintext over HTTPS to Edge Function, which encrypts. Client never encrypts/decrypts. | ✓ |
| Client encrypts with session token | Dual-key system where client derives key from Supabase access token hash | |
| User-supplied password | Zero-knowledge encryption with master password. Keys lost if password forgotten. | |

**User's choice:** Server-side only
**Notes:** Simplest and most secure. Edge Function already exists with encrypt/decrypt capability. Removes entire `encryption.ts` client-side problem (hardcoded fallback, low iterations, deterministic salt).

---

## Realtime API Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Accept client-side for WebSockets | Keys loaded from server into JS memory for WebSocket duration only. Never persisted client-side. | ✓ |
| Server-generated ephemeral tokens | Custom token exchange — major new feature, provider-dependent, may not be supported | |

**User's choice:** Accept client-side for WebSockets
**Notes:** Keys live only in JS memory for the WebSocket session. Loaded via Edge Function `get_key` action. This is the pragmatic choice — WebSocket APIs fundamentally need the key client-side.

---

## Key Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-migrate on login | Edge Function detects plaintext keys and re-encrypts with server-side key. Seamless for users. | ✓ |
| Force re-entry | Clear all keys, require users to re-enter via Settings | |
| Dual-read transition | Edge Function reads plaintext during transition period | |

**User's choice:** Auto-migrate on login
**Notes:** Edge Function checks key format on read — if plaintext (or old client-side encrypted), re-encrypts with proper server-side key and writes back. User is unaware.

---

## Dev Mode Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Env vars only | Dev mode uses VITE_* env vars (already works via runtimeState.ts). Settings page shows notice. | ✓ |
| Hide key management | Grey out Settings key fields in dev mode | |
| Require real login | Dev mode requires Supabase login for Settings — defeats purpose of dev mode | |

**User's choice:** Env vars only
**Notes:** Dev mode already loads env vars as fallback. Settings page shows "API keys from environment — sign in to manage your own keys." No encryption needed in dev mode.

---

## Claude's Discretion

- Exact PBKDF2 iteration count (600K minimum)
- Whether to keep `encryption.ts` as a thin shim or remove entirely
- Migration timing (batch vs lazy per-user)
- Edge Function `get_key` response structure for realtime use

## Deferred Ideas

None — discussion stayed within phase scope.
