---
phase: 15
slug: model-fallback
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| head -50` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose 2>&1 | head -50`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | IMAGE-FALLBACK-TYPES | T-15-03 | Type-enforced source union | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | LIVE-FACTORY | T-15-01 | Authenticated user config drives selection | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 15-02-01 | 02 | 2 | IMAGE-FALLBACK, IMAGE-CHAT-FALLBACK | T-15-04, T-15-05 | Typed fallback source, proxy validation | unit | `npx vitest run src/services/openai.test.ts` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | SETTINGS-UI | T-15-06 | Curated model lists only | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fallback model triggers on API failure | IMAGE-FALLBACK | Requires live API key invalidation | Set invalid API key, verify fallback model used |
| Live roleplay provider switches | LIVE-FACTORY | Requires WebSocket connection | Configure openai live source, verify OpenAI session created |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (after execution)

**Approval:** pending
