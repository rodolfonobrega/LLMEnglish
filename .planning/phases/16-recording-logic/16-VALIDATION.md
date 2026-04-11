---
phase: 16
slug: recording-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0 |
| **Config file** | vite.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose 2>&1 \| head -50` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | AudioWorklet re-application | — | N/A | unit | `npx vitest run src/services/geminiLive.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | Blob URL cleanup | — | N/A | unit | `npx vitest run src/hooks/useAudioRecorder.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | PCM clamping consistency | — | N/A | unit | `npx vitest run src/services/geminiLive.test.ts` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | ReviewPage type fix | — | N/A | unit | `npx vitest run src/components/review/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/services/__tests__/geminiLive.test.ts` — stubs for AudioWorklet + PCM clamping tests
- [ ] `src/hooks/__tests__/useAudioRecorder.test.ts` — stubs for Blob URL cleanup tests
- [ ] Existing infrastructure covers remaining requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live audio streaming works end-to-end | AudioWorklet migration | Requires browser MediaDevices API | 1. Open Live Session 2. Grant mic permission 3. Verify audio flows to Gemini/OpenAI |
| Audio recording in exercise mode | Blob URL lifecycle | Requires browser MediaRecorder API | 1. Open Exercise mode 2. Record audio 3. Submit 4. Verify no console errors about revoked URLs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
