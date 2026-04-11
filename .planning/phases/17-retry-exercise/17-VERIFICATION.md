---
phase: 17-retry-exercise
verified: 2026-04-11T20:42:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify 3-button layout renders correctly in both light and dark mode after exercise evaluation"
    expected: "Tentar Novamente (primary/blue), Novo Exercicio (secondary), Voltar ao Hub (ghost) — all visually distinct with correct contrast"
    why_human: "CSS styling cannot be verified programmatically; button variant colors depend on theme variables"
  - test: "Trigger full ExerciseMode exercise, evaluate it, click Tentar Novamente — confirm same prompt is shown again"
    expected: "Audio cleared, evaluation cleared, but exercise prompt text unchanged — user can re-record for the same prompt"
    why_human: "Requires browser interaction; runtime state transitions not testable via grep"
  - test: "Trigger full ImageMode exercise, evaluate it, click Tentar Novamente — confirm same image and question are shown again"
    expected: "Audio cleared, evaluation cleared, but imageUrl and question preserved — user sees same image to re-describe"
    why_human: "Requires browser interaction with real image generation service"
  - test: "Complete a live roleplay scenario, reach analysis view, click Tentar Novamente — confirm same scenario re-enters conversation phase"
    expected: "Turns cleared, phase transitions to 'conversation' with same scenario intact — LiveSession starts with same context"
    why_human: "Requires live Gemini/OpenAI connection; cannot verify session reconnection behavior statically"
---

# Phase 17: Retry Exercise Verification Report

**Phase Goal:** At the end of any exercise (speech, text, etc.), offer retry option, and after completion ask if they want to generate a new exercise or go back
**Verified:** 2026-04-11T20:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Note:** The v1.3 milestone audit (v1.3-MILESTONE-AUDIT.md) had flagged all 7 RETRY requirements as "code_reverted" due to a Phase 18 worktree accident. This verification confirms the implementation has since been re-applied and all 7 requirements are now satisfied in the current codebase.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After exercise evaluation, user sees 3 buttons: Tentar Novamente (retry same), Novo Exercicio (new), Voltar ao Hub (exit) | VERIFIED | ExerciseMode.tsx lines 469-482: `div.space-y-2` with 3 Button elements using primary/secondary/ghost variants |
| 2 | Retry clears evaluation/audio but preserves the exercise prompt | VERIFIED | ExerciseMode.tsx lines 235-241: `retrySame()` calls `setEvaluation(null)`, `setError(null)`, `setSaved(false)`, `setUserAudioBase64(null)` — does NOT call `setPrompt('')` |
| 3 | New Exercise clears all state and returns to setup | VERIFIED | ExerciseMode.tsx lines 226-233: `reset()` calls `setPrompt('')`, `setEvaluation(null)`, `setError(null)`, `setSaved(false)`, `setUserAudioBase64(null)`, `setSetupStep('theme')` |
| 4 | Voltar ao Hub navigates to /practice | VERIFIED | ExerciseMode.tsx line 478: `onClick={() => navigate('/practice')}` |
| 5 | After image exercise evaluation, same 3-button pattern works preserving imageUrl + question | VERIFIED | ImageMode.tsx lines 201-214: identical 3-button layout; `retrySame()` at lines 107-113 does NOT call `setImageUrl` or `setQuestion` |
| 6 | After live roleplay analysis, user can retry the same scenario (same scenario, clear turns, re-enter conversation) | VERIFIED | LiveRoleplayPage.tsx lines 34-38: `handleRetryScenario()` calls `setTurns([])`, `setPhase('conversation')` — does NOT call `setScenario(null)` |
| 7 | Existing 'Nova Conversa' button renamed and still provides setup reset | VERIFIED | ConversationAnalysis.tsx line 430-432: "Novo Cenario" (secondary) calls `onReset` which triggers `handleExit` → resets to setup |
| 8 | ConversationAnalysis receives and uses an onRetry callback | VERIFIED | ConversationAnalysis.tsx line 28: `onRetry?: () => void` in interface; line 56: destructured from props; line 426: `onClick={onRetry}` on Tentar Novamente button |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/discovery/ExerciseMode.tsx` | 3-button post-evaluation layout with retrySame function | VERIFIED | Contains `retrySame` (line 235), `Tentar Novamente` (line 472), `Novo Exercicio` (line 476), `Voltar ao Hub` (line 480), `navigate('/practice')` (line 478) |
| `src/components/discovery/ImageMode.tsx` | 3-button post-evaluation layout with retrySame function | VERIFIED | Contains `retrySame` (line 107), `Tentar Novamente` (line 204), `Novo Exercicio` (line 208), `Voltar ao Hub` (line 212), `navigate('/practice')` (line 210) |
| `src/components/live-roleplay/LiveRoleplayPage.tsx` | handleRetryScenario callback that preserves scenario, clears turns | VERIFIED | Contains `handleRetryScenario` (lines 34-38); `onRetry={handleRetryScenario}` passed to ConversationAnalysis (line 70) |
| `src/components/live-roleplay/ConversationAnalysis.tsx` | onRetry prop and retry button in action bar | VERIFIED | `onRetry?: () => void` in interface (line 28); 3-button layout with `Tentar Novamente`, `Novo Cenario`, `Ver Historico` (lines 425-438) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ExerciseMode.tsx` | `/practice` | `navigate('/practice')` | WIRED | Line 478: `onClick={() => navigate('/practice')}` |
| `ImageMode.tsx` | `/practice` | `navigate('/practice')` | WIRED | Line 210: `onClick={() => navigate('/practice')}` |
| `LiveRoleplayPage.tsx` | `ConversationAnalysis.tsx` | `onRetry={handleRetryScenario}` prop | WIRED | Line 70: `onRetry={handleRetryScenario}` passed in JSX |
| `LiveRoleplayPage.tsx` | `setPhase('conversation')` | `handleRetryScenario` sets phase | WIRED | Line 36: `setPhase('conversation')` inside `handleRetryScenario` |

### Data-Flow Trace (Level 4)

Not applicable — phase adds UI state transitions (button layout, navigation), not data-rendering components. No dynamic data fetching introduced.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `retrySame` in ExerciseMode does not reset prompt | `grep -A8 "const retrySame" ExerciseMode.tsx \| grep setPrompt` | no output | PASS |
| `retrySame` in ImageMode does not reset imageUrl/question | `grep -A8 "const retrySame" ImageMode.tsx \| grep "setImageUrl\|setQuestion"` | no output | PASS |
| `handleRetryScenario` does not reset scenario | `grep -A5 "handleRetryScenario" LiveRoleplayPage.tsx \| grep setScenario` | no output | PASS |
| "Tentar Outro" removed from all affected files | `grep "Tentar Outro" ExerciseMode.tsx ImageMode.tsx ConversationAnalysis.tsx` | no output | PASS |
| TypeScript compilation | `npx tsc --noEmit` | clean (no output) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RETRY-01 | 17-01-PLAN.md | Retry same exercise in ExerciseMode — retrySame function + 3-button layout | SATISFIED | `retrySame()` at ExerciseMode.tsx:235, 3-button layout at lines 469-482 |
| RETRY-02 | 17-01-PLAN.md | 3-button post-evaluation layout in ExerciseMode (Tentar Novamente / Novo Exercicio / Voltar ao Hub) | SATISFIED | Lines 469-482: `div.space-y-2` with 3 buttons, correct labels present |
| RETRY-03 | 17-01-PLAN.md | Voltar ao Hub navigation to /practice from ExerciseMode | SATISFIED | Line 478: `navigate('/practice')` on ghost button |
| RETRY-04 | 17-01-PLAN.md | Retry same exercise in ImageMode — retrySame preserving imageUrl + question + 3-button layout | SATISFIED | `retrySame()` at ImageMode.tsx:107 preserves state; 3-button layout at lines 201-214 |
| RETRY-05 | 17-02-PLAN.md | onRetry? prop in ConversationAnalysis — wired from LiveRoleplayPage | SATISFIED | Interface at line 28, prop passed at LiveRoleplayPage:70 |
| RETRY-06 | 17-02-PLAN.md | LiveRoleplayPage handleRetryScenario — clears turns, preserves scenario | SATISFIED | Function at LiveRoleplayPage:34-38: `setTurns([])`, `setPhase('conversation')`, no `setScenario` call |
| RETRY-07 | 17-02-PLAN.md | 3-button layout in ConversationAnalysis (Tentar Novamente / Novo Cenario / Ver Historico) | SATISFIED | Lines 425-438: 3-button `div.space-y-2` with correct labels and variants |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ExerciseMode.tsx | 285, 297 | `placeholder=` attribute | Info | HTML input placeholder text — not a stub pattern |

No blocking anti-patterns found. All 4 modified files contain substantive implementations with real state management logic.

### Human Verification Required

#### 1. Button Visual Styling in Light/Dark Mode

**Test:** Start an exercise in ExerciseMode, complete it, trigger evaluation. Observe the 3-button group.
**Expected:** "Tentar Novamente" renders as primary (blue/brand), "Novo Exercicio" as secondary (muted), "Voltar ao Hub" as ghost (minimal). Both light and dark themes should maintain appropriate contrast.
**Why human:** CSS variable resolution and Tailwind variant rendering cannot be verified programmatically.

#### 2. ExerciseMode Retry Flow — Same Prompt Preserved

**Test:** Generate an exercise prompt, record audio, receive evaluation. Click "Tentar Novamente".
**Expected:** Evaluation panel disappears, audio recording UI reappears, and the same exercise prompt text is still visible. No new prompt is generated.
**Why human:** Requires browser interaction to verify runtime state transitions and React re-render behavior.

#### 3. ImageMode Retry Flow — Same Image Preserved

**Test:** Generate an image exercise, record audio description, receive evaluation. Click "Tentar Novamente".
**Expected:** Evaluation panel disappears, the same image is still displayed with the same question text. Audio recording UI reappears.
**Why human:** Requires browser interaction with image generation service and visual confirmation.

#### 4. Live Roleplay Retry — Same Scenario Reconnects

**Test:** Complete a live roleplay conversation, reach the analysis view, click "Tentar Novamente".
**Expected:** Analysis view disappears, the conversation phase starts again with the same scenario (same role names, same context). User does not return to the scenario setup screen.
**Why human:** Requires live AI service connection; session reconnection behavior depends on runtime state not verifiable via static analysis.

### Gaps Summary

No gaps found. All 7 RETRY requirements (RETRY-01 through RETRY-07) are satisfied in the current codebase. The v1.3 milestone audit had flagged these as reverted, but the implementation has since been re-applied correctly.

4 items require human verification for visual/behavioral confirmation (button styling, runtime state preservation during retry interactions, live session reconnection).

---

_Verified: 2026-04-11T20:42:00Z_
_Verifier: Claude (gsd-verifier)_
