---
phase: 13
slug: image-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0 |
| **Config file** | `vite.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | 999.5 | — | N/A | unit | `npx vitest run src/services/supabase/aiProxy.test.ts` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | 999.5 | — | N/A | unit | `npx vitest run src/services/supabase/aiProxy.test.ts` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | 999.6 | — | N/A | unit | `npx vitest run supabase/functions/ai-proxy/index.test.ts` | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 2 | 999.7 | — | N/A | unit | `npx vitest run src/config/images.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/supabase/aiProxy.test.ts` — stubs for option forwarding (999.5)
- [ ] `supabase/functions/ai-proxy/index.test.ts` — stubs for edge function option extraction (999.6)
- [ ] `src/config/images.test.ts` — stubs for image config correctness (999.7)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end image generation from UI | 999.5 | Requires live API keys + Gemini/OpenAI account | Generate image in ImageMode, ScenarioSetup, ExerciseMode |
| Gemini model API correctness | 999.6 | Requires live API keys | Test each model variant via Settings > image generation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
