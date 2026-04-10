---
phase: 15-model-fallback
verified: 2026-04-10T09:25:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "LiveSession.tsx creates the correct live provider based on liveSource config"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Navigate to Settings page, scroll to image generation section, verify FallbackSection appears"
    expected: "A second dropdown group labeled Fallback with source and model selectors"
    why_human: "Visual layout and UI rendering quality cannot be verified programmatically"
  - test: "Set liveSource to openai in Settings, start a live roleplay session"
    expected: "Session connects via OpenAI Realtime API instead of Gemini"
    why_human: "Requires running app with valid API keys and WebSocket connection"
---

# Phase 15: Model Fallback Verification Report

**Phase Goal:** Add fallback model configuration for all modes so users don't get stuck when their primary model is unavailable
**Verified:** 2026-04-10T09:25:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (commit 218a15b re-applied factory pattern)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ModelConfig type includes imageFallbackModel and imageFallbackSource fields | VERIFIED | `src/types/settings.ts:61-62` -- optional fields with narrowed source type |
| 2 | DEFAULT_MODEL_CONFIG has no image fallback defaults (undefined) | VERIFIED | Fields are optional, not present in DEFAULT_MODEL_CONFIG object |
| 3 | migrateModelConfig preserves image fallback fields through migration | VERIFIED | `src/types/settings.ts:416-422` -- handles both direct-copy and legacy provider-to-source migration |
| 4 | LiveSession.tsx creates the correct live provider based on liveSource config | VERIFIED | Commit 218a15b re-applied factory. Lines 3-5: imports. Line 47: ILiveSession ref. Lines 86-90: factory ternary reads liveSource, selects OpenAI or Gemini |
| 5 | generateImage() tries fallback model when primary fails | VERIFIED | `src/services/openai.ts:196-207` -- try/catch with imageFallbackModel/imageFallbackSource fallback |
| 6 | chatCompletionWithImage() tries chat fallback when primary fails | VERIFIED | `src/services/openai.ts:89-96` -- try/catch with chatFallbackModel/chatFallbackSource, modelOverride guard |
| 7 | Settings page shows FallbackSection for image generation mode | VERIFIED | `src/components/settings/SettingsPage.tsx:640` -- FallbackSection rendered with IMAGE_SOURCES and IMAGE_MODELS |
| 8 | User can configure image fallback source and model in Settings | VERIFIED | `src/components/settings/SettingsPage.tsx:168,188,206` -- 'image' field in handleFallbackSourceChange and handleFallbackModelChange handlers |
| 9 | Existing fallback tests still pass | VERIFIED | 15/15 tests pass (10 existing + 5 new image fallback tests) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/settings.ts` | imageFallbackModel/Source in ModelConfig, migration support | VERIFIED | 6 matches for imageFallback fields across interface and migration |
| `src/components/live-roleplay/LiveSession.tsx` | Factory-based live session creation | VERIFIED | Lines 3-5: OpenAIRealtimeLiveSession, ILiveSession, getRuntimeModelConfig imported. Line 47: ILiveSession ref. Lines 86-90: factory ternary |
| `src/services/openai.ts` | Fallback logic in generateImage() and chatCompletionWithImage() | VERIFIED | imageFallbackModel referenced 3 times, chatFallbackModel referenced for chat-image |
| `src/services/openai.test.ts` | Tests for image and image-chat fallback | VERIFIED | 5 new tests, all 15 pass |
| `src/components/settings/SettingsPage.tsx` | Image fallback UI section | VERIFIED | 6 imageFallback matches, FallbackSection at line 640, image field in handlers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| LiveSession.tsx | geminiLive.ts | GeminiLiveSession import | WIRED | Line 2: import exists. Line 89: used in factory ternary as default provider |
| LiveSession.tsx | openaiRealtimeLive.ts | OpenAIRealtimeLiveSession import | WIRED | Line 3: import exists. Line 89: used in factory ternary when liveSource === 'openai' |
| LiveSession.tsx | runtimeState.ts | getRuntimeModelConfig call | WIRED | Line 5: import. Line 86: called to read liveSource config |
| openai.ts | supabase/aiProxy.ts | proxyImage call with fallback | WIRED | Lines 196-207: proxyImage called with imageFallbackSource/imageFallbackModel on failure |
| SettingsPage.tsx | types/settings.ts | imageFallback config fields | WIRED | References config.imageFallbackModel and config.imageFallbackSource |
| SettingsPage.tsx | services/runtimeState.ts | config update saves image fallback | WIRED | updateConfig called with imageFallbackSource/imageFallbackModel via handlers |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| LiveSession.tsx | config.liveSource | getRuntimeModelConfig() -> runtimeState | Yes -- reads from runtime state hydrated from Supabase | FLOWING |
| openai.ts generateImage() | config.imageFallbackModel/Source | getRuntimeModelConfig() -> runtimeState | Yes -- reads from runtime state hydrated from Supabase | FLOWING |
| openai.ts chatCompletionWithImage() | config.chatFallbackModel/Source | getRuntimeModelConfig() -> runtimeState | Yes -- same pattern as existing chat fallback | FLOWING |
| SettingsPage.tsx FallbackSection | config.imageFallbackModel/Source | runtimeState via updateConfig | Yes -- reads and writes through handlers | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | No errors | PASS |
| All openai tests pass | `npx vitest run src/services/openai.test.ts` | 15/15 pass | PASS |
| imageFallbackModel in settings.ts | `grep -c imageFallbackModel src/types/settings.ts` | 6 matches | PASS |
| imageFallback in openai.ts | `grep -c imageFallbackModel src/services/openai.ts` | 3 matches | PASS |
| imageFallback in SettingsPage | `grep -c imageFallbackModel src/components/settings/SettingsPage.tsx` | 6 matches | PASS |
| liveSource in LiveSession.tsx | `grep -c liveSource src/components/live-roleplay/LiveSession.tsx` | 1 match | PASS |
| OpenAI provider in LiveSession.tsx | `grep -c OpenAIRealtimeLiveSession src/components/live-roleplay/LiveSession.tsx` | 1 match | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| IMAGE-FALLBACK-TYPES | 15-01 | Image fallback fields in ModelConfig | SATISFIED | Fields at lines 61-62, migration at lines 416-422 |
| LIVE-FACTORY | 15-01 | Factory pattern for live session based on liveSource | SATISFIED | Commit 218a15b re-applied. Lines 86-90: factory ternary |
| IMAGE-FALLBACK | 15-02 | generateImage tries fallback on primary failure | SATISFIED | Fallback logic at lines 196-207, 3 passing tests |
| IMAGE-CHAT-FALLBACK | 15-02 | chatCompletionWithImage tries chat fallback on failure | SATISFIED | Fallback logic at lines 89-96, 2 passing tests |
| SETTINGS-UI | 15-02 | Settings UI for image fallback configuration | SATISFIED | FallbackSection at line 640, handlers extended for 'image' |

No orphaned requirements found. All 5 requirements declared in plans are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| SettingsPage.tsx | 378,390,402,414,430 | `placeholder="sk-..."` | Info | Legitimate HTML input placeholders for API key hints, not stub code |

No blocker or warning anti-patterns found.

### Human Verification Required

### 1. Image Fallback Settings UI Visual Check

**Test:** Navigate to Settings page, scroll to "Geracao de Imagem" section, verify FallbackSection appears below the primary model selector
**Expected:** A second dropdown group labeled "Fallback" with source and model selectors, including a "Nenhum (sem fallback)" empty option
**Why human:** Visual layout and UI rendering quality cannot be verified programmatically

### 2. Live Session Provider Selection

**Test:** Set liveSource to 'openai' in Settings, start a live roleplay session
**Expected:** Session should attempt to connect via OpenAI Realtime API instead of Gemini
**Why human:** Requires running app with valid API keys and WebSocket connection -- cannot test without live services

### Gaps Summary

No gaps found. All 9 truths verified. The previously identified gap (LIVE-FACTORY) has been closed by commit `218a15b` which re-applied the factory pattern to LiveSession.tsx. All artifacts exist, are substantive, and are properly wired. All 5 requirements are satisfied. 15/15 tests pass. TypeScript compiles cleanly.

---

_Verified: 2026-04-10T09:25:00Z_
_Verifier: Claude (gsd-verifier)_
