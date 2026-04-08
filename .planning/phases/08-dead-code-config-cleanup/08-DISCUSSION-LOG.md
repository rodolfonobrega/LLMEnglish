# Phase 8: Dead Code & Config Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 08-dead-code-config-cleanup
**Areas discussed:** Cleanup scope, Coverage config, Empty server block

---

## Cleanup Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All three files | Remove dead proxy from vite.config.ts + vitest.smoke.config.ts + nginx.conf | ✓ |
| vite.config.ts only | Stick to DC-01 spec, leave other files for separate cleanup | |

**User's choice:** All three files (Recommended)
**Notes:** Clean sweep avoids confusion later. Zero consumers confirmed in `src/`.

---

## Coverage Config

| Option | Description | Selected |
|--------|-------------|----------|
| Remove stale ref only | Just remove openaiRealtimeLive.ts from include list | ✓ |
| Remove coverage config entirely | Current 2-file setup provides minimal value | |
| Expand coverage scope | Add more files and raise thresholds | |

**User's choice:** Remove stale ref only (Recommended)
**Notes:** Conservative — only fix what's broken. Keep remaining coverage config as-is.

---

## Empty Server Block

| Option | Description | Selected |
|--------|-------------|----------|
| Remove server key entirely | No proxy means no server config needed | ✓ |
| Leave empty server block | Placeholder for future proxy configs | |

**User's choice:** Remove server key entirely (Recommended)
**Notes:** Clean config — no empty keys.

---

## Claude's Discretion

- Whether to clean `/api/groq` comments from vite.config.ts header if they become misleading after removal.

## Deferred Ideas

None — discussion stayed within phase scope.
