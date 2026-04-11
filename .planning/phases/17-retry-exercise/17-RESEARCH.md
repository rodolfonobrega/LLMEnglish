# Phase 17: Retry Exercise - Research

**Researched:** 2026-04-10
**Domain:** Exercise flow UX — retry, regenerate, and navigation after exercise completion
**Confidence:** HIGH

## Summary

This phase adds retry and post-exercise navigation options to SpeakLab's exercise flows. Currently, the app has two exercise components that end with evaluation results: `ExerciseMode` (phrases, texts, roleplay) and `ImageMode` (visual challenges). A third flow — `LiveRoleplayPage` — has its own completion flow through `ConversationAnalysis`. All three flows currently offer only a single "Tentar Outro" (Try Another) button that fully resets the exercise state, and a back button that navigates to the practice hub. There is no option to retry the **same** exercise (same prompt, re-record audio) or an explicit choice between "generate new" vs "go back to hub."

**Primary recommendation:** Modify the evaluation results screen in `ExerciseMode`, `ImageMode`, and `ConversationAnalysis` to add a "Retry Same Exercise" button alongside the existing "Tentar Outro" (now relabeled "New Exercise") and a "Back to Practice Hub" option. This requires minimal new state — only a `retryCount` or `isRetry` flag — since the prompt/image is already in state and the AudioRecorder already supports discard-and-rerecord.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2 | UI framework | Project standard [VERIFIED: npm registry] |
| react-router-dom | 7.13 | Navigation (`useNavigate`) | Project standard [VERIFIED: npm registry] |
| lucide-react | 0.563 | Icons (`RefreshCw`, `RotateCcw`, `Home`, etc.) | Project standard [VERIFIED: codebase] |
| vitest | 4.0 | Test runner | Project standard [VERIFIED: codebase] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3 | Component testing | For testing button rendering and click behavior |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline retry logic | Shared `useExerciseRetry` hook | Hook makes sense if 3+ components share identical retry logic; but ExerciseMode and ImageMode have different state shapes, so inline is simpler and more readable |

**Installation:** No new packages needed — all functionality uses existing dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/components/
├── discovery/
│   ├── ExerciseMode.tsx      # MODIFY: add retry button + back-to-hub in evaluation view
│   └── ImageMode.tsx          # MODIFY: add retry button + back-to-hub in evaluation view
├── live-roleplay/
│   └── ConversationAnalysis.tsx  # MODIFY: add retry option in bottom buttons
└── shared/
    └── EvaluationResults.tsx  # CONSIDER: add optional retry prop, or leave retry buttons in parent
```

### Pattern 1: Retry Same Exercise (keep prompt, clear evaluation)
**What:** After evaluation, user clicks "Retry" to re-attempt the same prompt without regenerating it.
**When to use:** In `ExerciseMode` and `ImageMode` evaluation views.
**Example:**
```typescript
// In ExerciseMode.tsx — the evaluation section (line ~426-463)
// Currently has only reset() which clears everything including prompt.
// Add a retry function that preserves prompt but clears evaluation/audio:

const retrySame = () => {
  setEvaluation(null);
  setError(null);
  setSaved(false);
  setUserAudioBase64(null);
  // Keep `prompt` intact — user sees the same exercise prompt again
};
```
```typescript
// In ImageMode.tsx — the evaluation section (line ~174-196)
// Same pattern: preserve imageUrl + question, clear evaluation:

const retrySame = () => {
  setEvaluation(null);
  setError(null);
  setSaved(false);
  setUserAudioBase64(null);
  // Keep imageUrl and question intact
};
```

### Pattern 2: Post-Exercise Navigation (New Exercise vs Back to Hub)
**What:** After evaluation, show clear choice between generating a new exercise or returning to practice hub.
**When to use:** In all exercise evaluation views.
**Example:**
```typescript
// Replace the single "Tentar Outro" button with a button group:

import { RotateCcw, Sparkles, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// In the evaluation JSX, replace the single reset button with:
<div className="space-y-3">
  <Button variant="coral" size="lg" onClick={retrySame} className="w-full rounded-2xl cursor-pointer">
    <RotateCcw size={18} />
    Tentar Novamente
  </Button>
  <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
    <Sparkles size={18} />
    Novo Exercicio
  </Button>
  <Button variant="ghost" size="lg" onClick={() => navigate('/practice')} className="w-full rounded-2xl cursor-pointer">
    <Home size={18} />
    Voltar ao Hub
  </Button>
</div>
```

### Pattern 3: Live Roleplay Retry
**What:** In `ConversationAnalysis`, the existing `onReset` callback already goes back to setup. A "Tentar Novamente" button at line 249 already exists but uses `onReset` which goes to setup. The phase goal is to offer retry — for live sessions this means re-entering the same scenario, which requires keeping the `scenario` object while clearing `turns`.
**When to use:** In `ConversationAnalysis.tsx`.
**Example:**
```typescript
// In LiveRoleplayPage.tsx, add a new handler:
const handleRetryScenario = () => {
  setTurns([]);
  setPhase('conversation');
  // Keep scenario intact — re-enters LiveSession with same scenario
};

// Pass to ConversationAnalysis:
<ConversationAnalysis
  scenario={scenario}
  turns={turns}
  onReset={handleExit}
  onRetry={handleRetryScenario}
/>
```

### Anti-Patterns to Avoid
- **Duplicating retry logic across components without abstraction:** If both ExerciseMode and ImageMode grow complex retry logic, extract a shared hook. But for now, the logic is 5 lines of state resets — inline is clearer.
- **Breaking the AudioRecorder contract:** The AudioRecorder component manages its own recording state via `useAudioRecorder` hook. On retry, the parent clears evaluation state, which unmounts/remounts AudioRecorder, giving a fresh recorder. Do NOT try to imperatively reset the AudioRecorder from outside.
- **Adding routing state to URL search params for retry:** Do not add `?retry=true` to the URL. The retry is ephemeral UI state — use component state only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Navigation after exercise | Custom back handler | `useNavigate()` from react-router-dom | Already used throughout the codebase |
| Button variants for action hierarchy | Custom button styles | `Button` component with `variant="coral"` / `"secondary"` / `"ghost"` | Existing design system |
| Audio re-recording | Custom reset logic in AudioRecorder | Unmount/remount AudioRecorder by clearing evaluation state | AudioRecorder already initializes fresh on mount |

**Key insight:** The "retry" feature is fundamentally about **selective state clearing** — keep the prompt/image, clear the evaluation and audio. No new infrastructure needed.

## Common Pitfalls

### Pitfall 1: Stale AudioRecorder State After Retry
**What goes wrong:** User clicks retry, evaluation clears, but AudioRecorder still shows the old recording.
**Why it happens:** The AudioRecorder manages its own internal state via `useAudioRecorder`. If the component doesn't unmount, it retains old blob/url.
**How to avoid:** The retry function clears `evaluation` to `null`. In ExerciseMode, the `hasActiveSession && !evaluation` branch (line 371) renders — this renders a fresh `AudioRecorder` because the JSX tree structure changes (evaluation branch unmounts, active session branch mounts). Verify this is the case — if the AudioRecorder is keyed the same, React may reuse it.
**Warning signs:** After clicking retry, the "play/submit" buttons from a previous recording still appear.

### Pitfall 2: Confusing "Retry" vs "New Exercise" Labels
**What goes wrong:** Users don't understand the difference between retrying the same exercise and getting a new one.
**Why it happens:** Both involve recording audio again, but one keeps the same prompt.
**How to avoid:** Use clear Portuguese labels: "Tentar Novamente" (retry same) vs "Novo Exercicio" (generate new) vs "Voltar ao Hub" (exit). Use distinct button variants (coral for retry, secondary for new, ghost for exit) and distinct icons (RotateCcw, Sparkles, Home).

### Pitfall 3: Live Session Retry Requires Scenario Preservation
**What goes wrong:** After a live roleplay analysis, clicking retry clears the scenario and sends user back to setup.
**Why it happens:** The existing `onReset` in `LiveRoleplayPage` sets `scenario` to `null` and `phase` to `'setup'`.
**How to avoid:** Add a new `onRetry` callback that only clears `turns` and sets `phase` back to `'conversation'`, keeping `scenario` intact.

### Pitfall 4: XP Double-Counting on Retry
**What goes wrong:** User retries the same exercise, gets evaluated again, and earns XP twice for essentially the same prompt.
**Why it happens:** `handleAudioReady` calls `addXP()` unconditionally on every evaluation.
**How to avoid:** This is a design decision for the planner. Options: (a) accept double XP since user did extra work, (b) track retry count and skip XP on retries, (c) reduce XP on retries. Recommend option (a) for simplicity — the user is doing additional practice.

## Code Examples

### Current ExerciseMode Evaluation View (what we're modifying)
```tsx
// Source: src/components/discovery/ExerciseMode.tsx lines 426-463
if (evaluation) {
  return (
    <div className="space-y-5">
      {/* Original exercise card */}
      <div className="bg-card rounded-2xl p-5 border border-border">...</div>
      {/* Evaluation results */}
      <EvaluationResults result={evaluation} onSaveToLibrary={...} showSaveButton={!saved} />
      {/* Save confirmation */}
      {saved && <div className="bg-leaf-soft rounded-2xl p-4 text-center">...</div>}
      {/* SINGLE button — this is what changes */}
      <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
        <RefreshCw size={18} />
        Tentar Outro
      </Button>
    </div>
  );
}
```

### Current reset() function (clears everything)
```typescript
// Source: src/components/discovery/ExerciseMode.tsx lines 217-224
const reset = () => {
  setPrompt('');
  setEvaluation(null);
  setError(null);
  setSaved(false);
  setUserAudioBase64(null);
  setSetupStep('theme');
};
```

### Retry function (keeps prompt, clears evaluation only)
```typescript
const retrySame = () => {
  setEvaluation(null);
  setError(null);
  setSaved(false);
  setUserAudioBase64(null);
  // Keep prompt — user will see the exercise prompt again and re-record
};
```

### Modified evaluation view with 3-button layout
```tsx
if (evaluation) {
  return (
    <div className="space-y-5">
      {/* ... existing exercise card, EvaluationResults, saved confirmation ... */}
      <div className="space-y-3">
        <Button variant="coral" size="lg" onClick={retrySame} className="w-full rounded-2xl cursor-pointer">
          <RotateCcw size={18} />
          Tentar Novamente
        </Button>
        <Button variant="secondary" size="lg" onClick={reset} className="w-full rounded-2xl cursor-pointer">
          <RefreshCw size={18} />
          Novo Exercicio
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate('/practice')} className="w-full rounded-2xl cursor-pointer">
          <ChevronLeft size={18} />
          Voltar ao Hub
        </Button>
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single "Tentar Outro" button | Will become 3-button layout | This phase | Clearer post-exercise navigation |

**Deprecated/outdated:**
- None — this is a new feature addition, not a migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | XP should still be awarded on retry (user did extra practice) | Common Pitfalls | If users abuse retry to farm XP, a cap may be needed |
| A2 | The "back to practice hub" navigation should use `navigate('/practice')` — same as the existing back button in ExercisesPage | Code Examples | Wrong route would break navigation |
| A3 | Live roleplay retry should re-enter `LiveSession` with the same scenario (not regenerate the scenario) | Pattern 3 | If scenario has one-time state (e.g., expired tokens), retry may fail |
| A4 | The `PracticePage` (Scripts) does not need retry — it generates dialogue scripts, not evaluated exercises | Architecture | If scripts have evaluation in the future, this will need revisiting |

## Open Questions

1. **Should retry preserve the previous evaluation for comparison?**
   - What we know: Currently `retrySame` clears evaluation entirely.
   - What's unclear: Would users benefit from seeing their previous score alongside the new one?
   - Recommendation: Start simple (clear evaluation). Can add comparison in a future phase.

2. **Should the "Voltar ao Hub" button appear inside the EvaluationResults component or outside it?**
   - What we know: EvaluationResults is a shared component used by both ExerciseMode and ImageMode.
   - What's unclear: Whether navigation buttons belong inside or outside this shared component.
   - Recommendation: Keep retry/new/hub buttons in the parent components (ExerciseMode, ImageMode), NOT inside EvaluationResults. This keeps EvaluationResults purely about displaying results.

3. **Does the live roleplay ConversationAnalysis need a "Novo Cenario" (New Scenario) option?**
   - What we know: It already has `onReset` which goes to setup, and line 434-442 has two buttons: "Ver Historico" and "Tentar Novamente".
   - What's unclear: Whether "Tentar Novamente" should mean retry-same-scenario or go-to-setup.
   - Recommendation: Rename existing "Tentar Novamente" to "Novo Cenario" (goes to setup via onReset), add new "Tentar Novamente" that retries same scenario.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all changes are component-level React/TypeScript with existing packages)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section, lines 15-34) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (TBD) | Retry button clears evaluation but preserves prompt | unit | `npx vitest run src/components/discovery/ExerciseMode.test.tsx` | No — Wave 0 |
| (TBD) | "New Exercise" button resets all state | unit | `npx vitest run src/components/discovery/ExerciseMode.test.tsx` | No — Wave 0 |
| (TBD) | "Back to Hub" navigates to /practice | unit | `npx vitest run src/components/discovery/ExerciseMode.test.tsx` | No — Wave 0 |
| (TBD) | ImageMode retry preserves image and question | unit | `npx vitest run src/components/discovery/ImageMode.test.tsx` | No — Wave 0 |
| (TBD) | LiveRoleplay retry re-enters conversation with same scenario | unit | `npx vitest run src/components/live-roleplay/LiveRoleplayPage.test.tsx` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/discovery/ExerciseMode.test.tsx` — covers retry/new/hub button rendering and click behavior
- [ ] `src/components/discovery/ImageMode.test.tsx` — covers retry preserving imageUrl/question
- [ ] `src/components/live-roleplay/LiveRoleplayPage.test.tsx` — covers retry-same-scenario flow

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth changes |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | no | N/A — no new user input |
| V6 Cryptography | no | N/A |

No security concerns — this is a UI-only change adding navigation buttons to existing screens.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/discovery/ExerciseMode.tsx` (467 lines) — complete exercise flow with state management
- Codebase analysis: `src/components/discovery/ImageMode.tsx` (203 lines) — image exercise flow
- Codebase analysis: `src/components/live-roleplay/LiveRoleplayPage.tsx` (68 lines) — live session orchestration
- Codebase analysis: `src/components/live-roleplay/ConversationAnalysis.tsx` (446 lines) — post-conversation analysis with navigation buttons
- Codebase analysis: `src/components/shared/AudioRecorder.tsx` (127 lines) — recording state management
- Codebase analysis: `src/components/shared/EvaluationResults.tsx` (126 lines) — evaluation display component

### Secondary (MEDIUM confidence)
- [VERIFIED: npm registry] react 19.2.5, react-router-dom 7.14.0, vitest 4.1.4

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all existing codebase patterns
- Architecture: HIGH — analyzed all 3 exercise completion flows in detail
- Pitfalls: HIGH — identified concrete risks from code analysis (AudioRecorder remounting, XP double-counting, scenario preservation)

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable — React patterns unlikely to change)
