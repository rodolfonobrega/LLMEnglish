---
phase: 7
slug: dead-code-facade-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts (test block) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | Delete ChunkErrorFallback | grep | `grep -r "ChunkErrorFallback" src/` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | Delete OpenAIRealtimeLiveSession | grep | `grep -r "OpenAIRealtimeLiveSession" src/` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | Remove orphaned aiProxy exports | grep | `grep -E "withFallback\|getGeminiKeyForLive\|getVertexLiveToken" src/` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | Fix SettingsPage dual import | unit + grep | `npx vitest run && grep "from.*supabase/storage" src/components/settings/SettingsPage.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/supabase/__tests__/storage.test.ts` — existing test coverage for storage facade
- [ ] `src/components/settings/` — existing SettingsPage test if any

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SettingsPage loads and saves correctly | Facade fix | Needs running app with Supabase | Navigate to Settings, change model config, verify persistence |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
