---
phase: 17-retry-exercise
verified: 2026-04-11T03:15:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Complete an ExerciseMode exercise, verify 3-button layout appears post-evaluation with Tentar Novamente, Novo Exercicio, Voltar ao Hub"
    expected: "Three buttons visible, retry keeps same prompt, new exercise resets to theme selection, Voltar goes to /practice"
    why_human: "Requires running app and completing AI-powered exercise flow; cannot verify button visibility without render"
  - test: "Complete an ImageMode exercise, verify 3-button layout appears post-evaluation"
    expected: "Three buttons visible, retry keeps same image+question, new exercise clears image and question"
    why_human: "Requires image generation and AI evaluation flow to reach post-evaluation state"
  - test: "Complete a LiveRoleplay session, verify 3-button layout appears in ConversationAnalysis"
    expected: "Three buttons: Tentar Novamente (retries same scenario), Novo Cenario (goes to setup), Ver Historico (navigates to /history)"
    why_human: "Requires live audio conversation with AI to reach analysis phase"
  - test: "Click Tentar Novamente in all three modes and verify exercise content is preserved"
    expected: "ExerciseMode: same prompt text. ImageMode: same image and question. LiveRoleplay: same scenario object."
    why_human: "Visual verification of state preservation across retry"
---

# Phase 17: Retry Exercise Verification Report

**Phase Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Verified:** 2026-04-11T03:15:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                 | Status     | Evidence                                                                                             |
| --- | --------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| 1   | ExerciseMode shows 3-button post-evaluation layout                    | VERIFIED   | Lines 464-476: primary retrySame, secondary reset, ghost navigate('/practice')                       |
| 2   | ImageMode shows 3-button post-evaluation layout                       | VERIFIED   | Lines 203-215: primary retrySame, secondary reset, ghost navigate('/practice')                       |
| 3   | LiveRoleplay shows 3-button post-analysis layout                      | VERIFIED   | ConversationAnalysis lines 425-438: primary onRetry, secondary onReset, ghost navigate('/history')   |
| 4   | retrySame preserves exercise content, clears evaluation state         | VERIFIED   | ExerciseMode:230-234 clears evaluation/error/saved/audio, keeps prompt. ImageMode:108-113 keeps imageUrl+question. LiveRoleplay:34-37 keeps scenario, clears turns, resets phase. |
| 5   | "Novo Exercicio"/"Novo Cenario" fully resets exercise                | VERIFIED   | ExerciseMode reset() clears prompt+evaluation+step. ImageMode reset() clears imageUrl+question. ConversationAnalysis onReset calls handleExit which clears scenario+turns. |
| 6   | "Voltar ao Hub" navigates to /practice                               | VERIFIED   | ExerciseMode:472 navigate('/practice'). ImageMode:211 navigate('/practice').                        |
| 7   | All exercise completion points covered (ExerciseMode, ImageMode, LiveRoleplay) | VERIFIED | Grep for evaluation/Evaluation across src/components/ confirms only these three modes are exercise completion endpoints. ReviewPage is a review tool, not an exercise. PracticePage/PracticeHubPage are navigation hubs. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/components/discovery/ExerciseMode.tsx` | 3-button post-evaluation layout with retry | VERIFIED | 488 lines. retrySame function (line 229), reset function (line 220), 3-button UI (lines 463-476). Imports useNavigate, RotateCcw. |
| `src/components/discovery/ImageMode.tsx` | 3-button post-evaluation layout with retry | VERIFIED | 224 lines. retrySame function (line 108), reset function (line 99), 3-button UI (lines 202-215). Imports useNavigate, RotateCcw, ChevronLeft. |
| `src/components/live-roleplay/LiveRoleplayPage.tsx` | handleRetryScenario callback wired to ConversationAnalysis | VERIFIED | 75 lines. handleRetryScenario (line 34) clears turns, sets phase to 'conversation', preserves scenario. Passed as onRetry prop (line 70). |
| `src/components/live-roleplay/ConversationAnalysis.tsx` | 3-button post-analysis layout with onRetry prop | VERIFIED | 441 lines. onRetry optional prop (line 28). 3-button UI (lines 425-438): Tentar Novamente, Novo Cenario, Ver Historico. Imports useNavigate, RotateCcw, Clock. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| ExerciseMode retrySame button | Evaluation state reset | onClick={retrySame} | WIRED | Clears evaluation, error, saved, userAudioBase64. Preserves prompt. |
| ExerciseMode "Novo Exercicio" button | Full state reset | onClick={reset} | WIRED | Clears prompt, evaluation, error, saved, audio, resets setupStep to 'theme'. |
| ExerciseMode "Voltar ao Hub" button | /practice route | navigate('/practice') | WIRED | useNavigate from react-router-dom. |
| ImageMode retrySame button | Evaluation state reset | onClick={retrySame} | WIRED | Clears evaluation, error, saved, userAudioBase64. Preserves imageUrl and question. |
| ImageMode "Novo Exercicio" button | Full state reset | onClick={reset} | WIRED | Clears imageUrl, question, evaluation, error, saved, audio. |
| ImageMode "Voltar ao Hub" button | /practice route | navigate('/practice') | WIRED | useNavigate from react-router-dom. |
| LiveRoleplayPage handleRetryScenario | ConversationAnalysis onRetry prop | onRetry={handleRetryScenario} | WIRED | Clears turns, resets phase to 'conversation', preserves scenario object. |
| ConversationAnalysis "Novo Cenario" button | LiveRoleplayPage handleExit | onClick={onReset} | WIRED | onReset maps to handleExit which clears scenario and turns. |
| ConversationAnalysis "Ver Historico" button | /history route | navigate('/history') | WIRED | useNavigate from react-router-dom. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ExerciseMode retrySame | evaluation, prompt | useState + AI eval | Yes -- evaluation cleared, prompt preserved from prior AI generation | FLOWING |
| ImageMode retrySame | evaluation, imageUrl, question | useState + AI image gen | Yes -- evaluation cleared, imageUrl+question preserved | FLOWING |
| LiveRoleplayPage handleRetryScenario | turns, scenario, phase | useState + live session | Yes -- turns cleared, scenario preserved, phase reset to 'conversation' | FLOWING |
| ConversationAnalysis onRetry | onClick handler | LiveRoleplayPage prop | Yes -- handleRetryScenario passed as onRetry | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| SKIP | No runnable entry points for retry flow (requires live AI exercise completion) | N/A | SKIP -- requires running app with AI backend |

Step 7b: SKIPPED (no runnable entry points -- retry flow requires completing AI-powered exercises)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RETRY-01 | 17-01 | ExerciseMode retry same exercise | SATISFIED | retrySame function + Tentar Novamente button |
| RETRY-02 | 17-01 | ExerciseMode new exercise after completion | SATISFIED | reset function + Novo Exercicio button |
| RETRY-03 | 17-01 | ImageMode retry same exercise | SATISFIED | retrySame function + Tentar Novamente button |
| RETRY-04 | 17-01 | ImageMode new exercise after completion | SATISFIED | reset function + Novo Exercicio button |
| RETRY-05 | 17-02 | LiveRoleplay retry same scenario | SATISFIED | handleRetryScenario + Tentar Novamente button |
| RETRY-06 | 17-02 | LiveRoleplay new scenario after completion | SATISFIED | handleExit via onReset + Novo Cenario button |
| RETRY-07 | 17-02 | LiveRoleplay post-analysis navigation to history | SATISFIED | Ver Historico button + navigate('/history') |

Note: RETRY requirement definitions were not found in a standalone REQUIREMENTS.md file. Requirement descriptions are derived from PLAN summaries and the two plans' declared requirements-completed fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| ExerciseMode.tsx | 279,291 | `placeholder="..."` | Info | HTML input placeholder attributes, not stub patterns |
| ConversationAnalysis.tsx | 426 | Optional onRetry passed to onClick without null check | Warning | If no parent supplies onRetry, button renders but does nothing. Per REVIEW WR-05. Low impact since LiveRoleplayPage always supplies it. |

### Human Verification Required

### 1. ExerciseMode 3-Button Post-Evaluation Layout

**Test:** Complete an ExerciseMode exercise (select theme, generate, record/submit, get evaluation), then verify three buttons appear.
**Expected:** "Tentar Novamente" (primary), "Novo Exercicio" (secondary), "Voltar ao Hub" (ghost) in vertical stack. Retry keeps same prompt. New exercise resets to theme selection. Voltar navigates to /practice.
**Why human:** Requires running app and completing AI-powered exercise flow to reach post-evaluation state.

### 2. ImageMode 3-Button Post-Evaluation Layout

**Test:** Complete an ImageMode exercise (generate image, record/submit, get evaluation), then verify three buttons appear.
**Expected:** "Tentar Novamente" (primary), "Novo Exercicio" (secondary), "Voltar ao Hub" (ghost). Retry keeps same image+question. New exercise clears image and question.
**Why human:** Requires image generation and AI evaluation flow to reach post-evaluation state.

### 3. LiveRoleplay 3-Button Post-Analysis Layout

**Test:** Complete a live roleplay session (setup scenario, have conversation, end session), then verify three buttons in analysis view.
**Expected:** "Tentar Novamente" (primary), "Novo Cenario" (secondary), "Ver Historico" (ghost). Retry re-enters conversation with same scenario. Novo Cenario goes to setup. Ver Historico navigates to /history.
**Why human:** Requires live audio conversation with AI to reach analysis phase.

### 4. Retry State Preservation Across All Modes

**Test:** In each mode, click "Tentar Novamente" and verify exercise content is preserved.
**Expected:** ExerciseMode: same prompt text visible. ImageMode: same image and question visible. LiveRoleplay: same scenario title/description visible.
**Why human:** Visual verification of state preservation requires rendered UI.

### Gaps Summary

No code gaps found. All four artifacts exist with substantive retry implementations (selective state clearing for retry, full reset for new exercise, navigation for exit). All key links are wired -- buttons are connected to handler functions which manipulate the correct state variables. Data flows correctly in all three modes.

One warning from the code review: ConversationAnalysis passes optional `onRetry` directly to onClick without a null check (line 426). This is safe in practice because LiveRoleplayPage always supplies the prop, but it could be defensively improved.

The phase goal is fully met from a code perspective. Human verification is needed to confirm the visual layout and end-to-end flow works in the running application.

---

_Verified: 2026-04-11T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
