---
phase: 17-retry-exercise
verified: 2026-04-11T00:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "ExerciseMode — Tentar Novamente button clears evaluation and re-shows same prompt"
    expected: "Tapping 'Tentar Novamente' after exercise evaluation clears the score/feedback, keeps the original exercise prompt visible, and shows a fresh AudioRecorder ready to record again"
    why_human: "State transition from evaluation -> active session requires visual confirmation that AudioRecorder remounts correctly and prompt is unchanged"
  - test: "ImageMode — Tentar Novamente button clears evaluation and re-shows same image+question"
    expected: "Tapping 'Tentar Novamente' after image exercise evaluation clears the score/feedback, keeps the original image and question visible, and shows a fresh AudioRecorder"
    why_human: "Image URL preservation and AudioRecorder remount require visual confirmation"
  - test: "LiveRoleplay — Tentar Novamente retries same scenario without going to setup"
    expected: "After a live conversation analysis, tapping 'Tentar Novamente' enters a new conversation with the same scenario (same brandName, aiRole, situation) without going through ScenarioSetup"
    why_human: "LiveSession reconnection with preserved scenario needs end-to-end manual test — automated checks cannot exercise Gemini/OpenAI live session reconnection"
  - test: "3-button visual hierarchy (primary/secondary/ghost) renders correctly in both light and dark mode"
    expected: "Tentar Novamente is teal/filled (primary), Novo Exercicio/Cenario is outlined (secondary), Voltar ao Hub/Ver Historico is transparent (ghost); correct spacing (space-y-2 = 8px gap)"
    why_human: "Visual appearance of button variants and dark mode rendering requires human review"
---

# Phase 17: Retry Exercise — Verification Report

**Phase Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Verified:** 2026-04-11
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After exercise evaluation, user sees 3 buttons: Tentar Novamente (retry same), Novo Exercicio (new), Voltar ao Hub (exit) | VERIFIED | ExerciseMode.tsx lines 462-475: `div.space-y-2` with 3 `Button` elements; labels confirmed at lines 465, 469, 473 |
| 2 | Retry clears evaluation/audio but preserves the exercise prompt | VERIFIED | `retrySame` (lines 228-234) calls `setEvaluation(null)`, `setError(null)`, `setSaved(false)`, `setUserAudioBase64(null)` — does NOT call `setPrompt` |
| 3 | New Exercise clears all state and returns to setup | VERIFIED | `reset` (lines 219-226) calls `setPrompt('')`, `setEvaluation(null)`, `setError(null)`, `setSaved(false)`, `setUserAudioBase64(null)`, `setSetupStep('theme')` |
| 4 | Voltar ao Hub navigates to /practice | VERIFIED | ExerciseMode.tsx line 471: `onClick={() => navigate('/practice')}` — key link verified by gsd-tools |
| 5 | After image exercise evaluation, same 3-button pattern works preserving imageUrl + question | VERIFIED | ImageMode.tsx lines 201-213: identical 3-button group; `retrySame` (lines 107-113) does NOT call `setImageUrl` or `setQuestion` |
| 6 | After live roleplay analysis, user can retry the same scenario (same scenario, clear turns, re-enter conversation) | VERIFIED | LiveRoleplayPage.tsx lines 34-38: `handleRetryScenario` calls `setTurns([])` and `setPhase('conversation')` — does NOT call `setScenario(null)` |
| 7 | Existing 'Nova Conversa' button still works (goes to setup) | VERIFIED | ConversationAnalysis.tsx line 431: `onClick={onReset}` on "Novo Cenario" button; `onReset={handleExit}` in LiveRoleplayPage (line 69) — `handleExit` calls `setPhase('setup')` and `setScenario(null)` |
| 8 | ConversationAnalysis receives and uses an onRetry callback | VERIFIED | Props interface (line 28): `onRetry?: () => void`; destructured in signature (line 56); passed from LiveRoleplayPage `onRetry={handleRetryScenario}` (line 70); used at line 426 `onClick={onRetry}` |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/discovery/ExerciseMode.tsx` | 3-button post-evaluation layout with retrySame function | VERIFIED | Contains `retrySame`, `useNavigate`, 3-button group, all required strings |
| `src/components/discovery/ImageMode.tsx` | 3-button post-evaluation layout with retrySame function | VERIFIED | Contains `retrySame`, `useNavigate`, 3-button group, all required strings |
| `src/components/live-roleplay/LiveRoleplayPage.tsx` | handleRetryScenario callback that preserves scenario, clears turns | VERIFIED | `handleRetryScenario` defined at line 34; `onRetry={handleRetryScenario}` at line 70 |
| `src/components/live-roleplay/ConversationAnalysis.tsx` | onRetry prop and retry button in action bar | VERIFIED | Interface updated (line 28), destructured (line 56), button at lines 426-429 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExerciseMode.tsx` | `/practice` | `navigate('/practice')` | WIRED | Pattern found at line 471 |
| `ImageMode.tsx` | `/practice` | `navigate('/practice')` | WIRED | Pattern found at line 210 |
| `LiveRoleplayPage.tsx` | `ConversationAnalysis.tsx` | `onRetry={handleRetryScenario}` prop | WIRED | Pattern found at line 70 |
| `LiveRoleplayPage.tsx` | `setPhase` | `handleRetryScenario` sets phase to 'conversation' | WIRED | Pattern found at line 36 |

### Data-Flow Trace (Level 4)

Not applicable — this phase is UI state management only (no data fetch, no DB queries). All state flows are local component state transitions.

### Behavioral Spot-Checks

Step 7b: SKIPPED — retry features require browser interaction (button clicks, audio recording). No runnable CLI entry points.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RETRY-01 | 17-01-PLAN.md | Retry same exercise in ExerciseMode | SATISFIED | `retrySame` function in ExerciseMode.tsx preserves prompt |
| RETRY-02 | 17-01-PLAN.md | 3-button post-evaluation layout in ExerciseMode | SATISFIED | `div.space-y-2` with 3 buttons at lines 462-475 |
| RETRY-03 | 17-01-PLAN.md | Voltar ao Hub navigation from ExerciseMode | SATISFIED | `navigate('/practice')` at line 471 |
| RETRY-04 | 17-01-PLAN.md | Retry same exercise in ImageMode | SATISFIED | `retrySame` function in ImageMode.tsx preserves imageUrl+question |
| RETRY-05 | 17-02-PLAN.md | Retry same scenario in LiveRoleplay | SATISFIED | `handleRetryScenario` in LiveRoleplayPage preserves scenario |
| RETRY-06 | 17-02-PLAN.md | ConversationAnalysis receives onRetry prop | SATISFIED | `onRetry?: () => void` in props interface; threaded from LiveRoleplayPage |
| RETRY-07 | 17-02-PLAN.md | 3-button vertical layout in ConversationAnalysis | SATISFIED | `div.space-y-2` with Tentar Novamente / Novo Cenario / Ver Historico |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ExerciseMode.tsx | 278, 290 | `placeholder=` attribute | Info | HTML input placeholder — not a stub, correct usage |

No stub code, empty handlers, or hardcoded empty returns found in any modified file. All "placeholder" strings are HTML input element attributes (correct usage). `retrySame` functions are fully implemented — not TODOs.

### Human Verification Required

#### 1. ExerciseMode — Tentar Novamente clears evaluation and re-shows prompt

**Test:** Complete an ExerciseMode exercise (any type: phrase/text/roleplay). After seeing the evaluation results, click "Tentar Novamente."
**Expected:** The evaluation card and score disappear. The original exercise prompt is still visible in the exercise card. A fresh AudioRecorder is shown (no pre-existing recording state). The "Tentar Novamente" / "Novo Exercicio" / "Voltar ao Hub" buttons are gone.
**Why human:** AudioRecorder remount (state reset via component unmount/remount from evaluation branch change) requires visual confirmation that no stale recording UI persists.

#### 2. ImageMode — Tentar Novamente preserves image and question

**Test:** Complete an ImageMode exercise. After seeing the evaluation results, click "Tentar Novamente."
**Expected:** The evaluation card disappears. The original challenge image and question text are still shown. A fresh AudioRecorder is visible.
**Why human:** Image URL preservation and correct branch re-render require visual confirmation.

#### 3. LiveRoleplay — Tentar Novamente retries same scenario without re-running setup

**Test:** Complete a live roleplay session. After the ConversationAnalysis screen loads, click "Tentar Novamente."
**Expected:** A new live conversation begins with the same scenario name, location, and AI role — without going through ScenarioSetup. The previous conversation turns are cleared.
**Why human:** LiveSession reconnection with the preserved scenario requires end-to-end testing that exercises the Gemini or OpenAI live session stack, which cannot be validated statically.

#### 4. 3-button visual hierarchy renders correctly in light and dark mode

**Test:** Navigate to the post-evaluation screen in ExerciseMode or ImageMode. Switch between light and dark mode.
**Expected:** "Tentar Novamente" is filled teal (primary variant). "Novo Exercicio" / "Novo Cenario" has a white/outlined appearance (secondary variant). "Voltar ao Hub" / "Ver Historico" is transparent (ghost variant). Buttons are full-width, rounded, with 8px gap between them.
**Why human:** Visual rendering of the Button component's variant system in both color modes cannot be verified statically.

### Gaps Summary

No gaps found. All 8 observable truths are verified against the actual codebase. All 4 artifacts exist, are substantive, and are correctly wired. All 4 key links are confirmed. All 7 requirement IDs (RETRY-01 through RETRY-07) are accounted for and satisfied.

The 4 human verification items above are UX/visual quality checks that require manual browser testing — they are not code defects.

---

_Verified: 2026-04-11_
_Verifier: Claude (gsd-verifier)_
