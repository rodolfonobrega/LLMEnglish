---
phase: 9
slug: model-catalog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1` |
| **Full suite command** | `npx vitest run --reporter=verbose 2>&1` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1`
- **After every plan wave:** Run `npx vitest run --reporter=verbose 2>&1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | MC-01 | — | Catalog lookup returns correct source for all known models | unit | `npx vitest run src/types/settings.test.ts` | W0 | pending |
| 09-01-02 | 01 | 1 | MC-01 | — | Multi-source models return Set of sources | unit | `npx vitest run src/types/settings.test.ts` | W0 | pending |
| 09-01-03 | 01 | 1 | MC-02 | — | Unknown models fall back to heuristic | unit | `npx vitest run src/types/settings.test.ts` | W0 | pending |
| 09-02-01 | 02 | 1 | MC-01 | — | detectSource() uses catalog instead of heuristics | unit | `npx vitest run src/services/openai.test.ts` | W0 | pending |
| 09-02-02 | 02 | 1 | MC-04 | — | Chat/TTS/STT chains produce identical results | unit | `npx vitest run src/services/openai.test.ts` | W0 | pending |
| 09-03-01 | 03 | 2 | MC-03 | — | Warning badge renders for unknown model+source combos | unit | `npx vitest run src/components/settings/` | W0 | pending |

*Status: pending - green - red - flaky*

---

## Wave 0 Requirements

- [ ] `src/types/settings.test.ts` — existing tests covering ModelOption and Source types
- [ ] `src/services/openai.test.ts` — existing tests covering detectSource behavior

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Warning badge visibility in Settings UI | MC-03 | Visual rendering requires browser | Open Settings, select a model not in catalog, verify warning badge appears |
