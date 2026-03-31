# Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SpeakLab shell, visual foundation, and practice flows so the app feels like one product instead of a cluster of disconnected pages.

**Architecture:** Keep behavior changes incremental and testable. First stabilize shared tokens and route metadata, then replace the global shell, then introduce the new `Praticar` hub and guided setup flows, and only after that polish secondary pages that now sit under the same information architecture.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS v4 via `src/index.css`, Vitest, ESLint.

---

## Scope Guard

- This plan intentionally stays inside one subsystem: the logged-in product shell and the main learning flows.
- It does not redesign auth, Supabase storage, or AI service internals.
- It assumes the implementation happens in an isolated worktree. If work starts in the main worktree, create one first with `@using-git-worktrees`.

## File Structure

### Existing files that stay in place

- Modify: `src/index.css`
  - Owns design tokens, Tailwind theme variables, global motion/scrollbar/base styles.
- Modify: `src/App.tsx`
  - Owns route wiring for `/`, `/practice`, `/exercises`, `/live`, `/paths`, `/scripts`, `/history`, `/errors`.
- Modify: `src/components/layout/Header.tsx`
  - Owns the top bar, theme toggle, and compact account/progress summary.
- Modify: `src/components/layout/Sidebar.tsx`
  - Owns desktop primary navigation.
- Modify: `src/components/layout/Navigation.tsx`
  - Owns mobile primary navigation.
- Modify: `src/components/layout/Layout.tsx`
  - Owns the shared page frame.
- Modify: `src/components/discovery/DiscoveryPage.tsx`
  - Becomes the editorial dashboard home.
- Modify: `src/components/discovery/ExerciseMode.tsx`
  - Keeps generation/evaluation behavior, but the setup portion becomes a guided step flow instead of a flat form.
- Modify: `src/components/live-roleplay/LiveRoleplayPage.tsx`
  - Keeps the live phases (`setup`, `conversation`, `analysis`) but routes back into the new practice hub correctly.
- Modify: `src/components/live-roleplay/ScenarioSetup.tsx`
  - Keeps scenario generation behavior, but the setup UI becomes more clearly staged.
- Modify: `src/components/paths/PathsPage.tsx`
- Modify: `src/components/history/HistoryPage.tsx`
- Modify: `src/components/errors/ErrorDashboard.tsx`
- Modify: `src/components/library/LibraryPage.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/components/review/ReviewPage.tsx`
  - These pages keep their product responsibilities but adopt the new shell and token language.

### New files to create

- Create: `src/config/navigation.ts`
  - Single source of truth for primary navigation items and their route metadata.
- Create: `src/config/practice.ts`
  - Single source of truth for practice hub sections, primary modes, and secondary tools.
- Create: `src/config/navigation.test.ts`
  - Verifies route metadata and grouping expected by the new shell.
- Create: `src/config/practice.test.ts`
  - Verifies the practice hub metadata matches the spec and keeps secondary tools out of primary nav.
- Create: `src/components/practice/PracticeHubPage.tsx`
  - New `/practice` entry page that presents `Exercises` and `Live Simulation` as primary choices and `Paths`, `Scripts`, `History`, `Errors` as secondary tools.

## Implementation Order

1. Stabilize the shared visual and navigation foundation.
2. Change the shell to the new information architecture.
3. Add the new practice hub and retarget existing pages into it.
4. Rebuild the exercise and simulation setup experiences.
5. Polish supporting pages and finish regression verification.

### Task 1: Add stable metadata for navigation and practice IA

**Files:**
- Create: `src/config/navigation.ts`
- Create: `src/config/practice.ts`
- Create: `src/config/navigation.test.ts`
- Create: `src/config/practice.test.ts`

- [ ] **Step 1: Write the failing navigation metadata test**

```ts
import { describe, expect, it } from 'vitest';
import { primaryNavItems } from './navigation';

describe('primaryNavItems', () => {
  it('contains only the five approved top-level destinations', () => {
    expect(primaryNavItems.map(item => item.to)).toEqual([
      '/',
      '/practice',
      '/review',
      '/library',
      '/settings',
    ]);
  });
});
```

- [ ] **Step 2: Run the navigation test and confirm it fails**
  - Run: `npm run test -- src/config/navigation.test.ts`
  - Expected: fail because `src/config/navigation.ts` does not exist yet.

- [ ] **Step 3: Write the failing practice hub metadata test**

```ts
import { describe, expect, it } from 'vitest';
import { practicePrimaryModes, practiceSecondaryTools } from './practice';

describe('practice hub metadata', () => {
  it('keeps only exercises and live simulation as primary modes', () => {
    expect(practicePrimaryModes.map(item => item.id)).toEqual(['exercises', 'live']);
  });

  it('keeps paths, scripts, history, and errors as secondary tools', () => {
    expect(practiceSecondaryTools.map(item => item.id)).toEqual([
      'paths',
      'scripts',
      'history',
      'errors',
    ]);
  });
});
```

- [ ] **Step 4: Run the practice metadata test and confirm it fails**
  - Run: `npm run test -- src/config/practice.test.ts`
  - Expected: fail because `src/config/practice.ts` does not exist yet.

- [ ] **Step 5: Implement `src/config/navigation.ts`**

```ts
export const primaryNavItems = [
  { to: '/', label: 'Inicio', icon: 'home' },
  { to: '/practice', label: 'Praticar', icon: 'sparkles' },
  { to: '/review', label: 'Revisao', icon: 'rotate-ccw' },
  { to: '/library', label: 'Biblioteca', icon: 'book-open' },
  { to: '/settings', label: 'Configuracoes', icon: 'settings' },
] as const;
```

- [ ] **Step 6: Implement `src/config/practice.ts`**

```ts
export const practicePrimaryModes = [
  { id: 'exercises', to: '/exercises', title: 'Exercicios' },
  { id: 'live', to: '/live', title: 'Simulacao ao vivo' },
] as const;

export const practiceSecondaryTools = [
  { id: 'paths', to: '/paths', title: 'Trilhas' },
  { id: 'scripts', to: '/scripts', title: 'Scripts' },
  { id: 'history', to: '/history', title: 'Historico' },
  { id: 'errors', to: '/errors', title: 'Erros' },
] as const;
```

- [ ] **Step 7: Re-run both metadata tests and confirm they pass**
  - Run: `npm run test -- src/config/navigation.test.ts src/config/practice.test.ts`
  - Expected: both pass.

- [ ] **Step 8: Commit the metadata foundation**

```bash
git add src/config/navigation.ts src/config/practice.ts src/config/navigation.test.ts src/config/practice.test.ts
git commit -m "feat: define navigation and practice metadata"
```

### Task 2: Replace the token vocabulary and shared UI atoms

**Files:**
- Modify: `src/index.css`
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Textarea.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Dialog.tsx`
- Modify: `src/components/ui/AlertDialog.tsx`
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Write the failing legacy-token audit command**
  - Run: `grep -RIn "text-ink\\|bg-card-warm\\|border-edge\\|ring-sky" src`
  - Expected: multiple hits in `Select`, `Dialog`, and `AlertDialog`.

- [ ] **Step 2: Update `src/index.css` to the new editorial token set**
  - Keep one vocabulary for base surfaces, borders, text, brand accents, and soft backgrounds.
  - Remove duplicate or conflicting aliases that still require `--sky`, `--coral`, or `--leaf` outside the new system.

- [ ] **Step 3: Rewrite the shared atoms to consume the same tokens**
  - `Button`: keep backward-compatible variant mapping but make the actual classes reference the editorial tokens.
  - `Input`, `Textarea`, `Select`: ensure selected/focus/error text is always legible in both themes.
  - `Dialog`, `AlertDialog`, `card`: move to `bg-card`, `text-foreground`, `border-border`, and consistent focus rings.

- [ ] **Step 4: Re-run the legacy-token audit**
  - Run: `grep -RIn "text-ink\\|bg-card-warm\\|border-edge\\|ring-sky" src`
  - Expected: no output.

- [ ] **Step 5: Run lint**
  - Run: `npm run lint`
  - Expected: pass.

- [ ] **Step 6: Commit the visual foundation**

```bash
git add src/index.css src/components/ui/Button.tsx src/components/ui/Input.tsx src/components/ui/Textarea.tsx src/components/ui/Select.tsx src/components/ui/Dialog.tsx src/components/ui/AlertDialog.tsx src/components/ui/card.tsx
git commit -m "feat: unify editorial design tokens"
```

### Task 3: Rebuild the logged-in shell around the new IA

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/components/discovery/DiscoveryPage.tsx`
- Create: `src/components/practice/PracticeHubPage.tsx`

- [ ] **Step 1: Write the failing route-alignment test**

```ts
import { describe, expect, it } from 'vitest';
import { primaryNavItems } from '../../config/navigation';

describe('primary navigation routes', () => {
  it('includes /practice and excludes /paths, /scripts, /live as top-level nav items', () => {
    expect(primaryNavItems.some(item => item.to === '/practice')).toBe(true);
    expect(primaryNavItems.some(item => item.to === '/paths')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/scripts')).toBe(false);
    expect(primaryNavItems.some(item => item.to === '/live')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the route-alignment test**
  - Run: `npm run test -- src/config/navigation.test.ts`
  - Expected: pass now that metadata exists.

- [ ] **Step 3: Add the new hub route in `src/App.tsx`**
  - `/practice` must point to `PracticeHubPage`.
  - `/scripts` must keep its own page instead of sharing the hub route.

- [ ] **Step 4: Point desktop and mobile nav to `src/config/navigation.ts`**
  - Remove hard-coded nav arrays from `Sidebar.tsx` and `Navigation.tsx`.
  - Keep icons in metadata or map them in one place.

- [ ] **Step 5: Update the shared frame**
  - `Header`, `Sidebar`, `Navigation`, and `Layout` should use the new spacing, typography, and reduced item count.
  - `DiscoveryPage` should become the editorial dashboard home with a single clear path into `Praticar`.

- [ ] **Step 6: Create `PracticeHubPage.tsx`**

```tsx
export function PracticeHubPage() {
  return (
    <div>
      <h1>Praticar</h1>
      <p>Escolha um modo principal ou abra uma ferramenta secundaria.</p>
    </div>
  );
}
```

- [ ] **Step 7: Run lint**
  - Run: `npm run lint`
  - Expected: pass.

- [ ] **Step 8: Commit the shell rewrite**

```bash
git add src/App.tsx src/components/layout/Header.tsx src/components/layout/Sidebar.tsx src/components/layout/Navigation.tsx src/components/layout/Layout.tsx src/components/discovery/DiscoveryPage.tsx src/components/practice/PracticeHubPage.tsx
git commit -m "feat: rebuild product shell around practice hub"
```

### Task 4: Turn exercises into a guided setup flow

**Files:**
- Modify: `src/components/exercises/ExercisesPage.tsx`
- Modify: `src/components/discovery/ExerciseMode.tsx`
- Modify: `src/components/shared/ThemeSelector.tsx`

- [ ] **Step 1: Capture the current exercise state model**
  - Document the existing state inputs already used by `ExerciseMode`: `exerciseType`, `outputFormat`, `theme`, `targetVocab`, `context`, generation/evaluation state.

- [ ] **Step 2: Write the failing setup-order test**

```ts
import { describe, expect, it } from 'vitest';
import { exerciseSetupSteps } from '../../config/practice';

describe('exerciseSetupSteps', () => {
  it('keeps the agreed setup order', () => {
    expect(exerciseSetupSteps).toEqual(['format', 'type', 'theme', 'generate']);
  });
});
```

- [ ] **Step 3: Run the failing setup-order test**
  - Run: `npm run test -- src/config/practice.test.ts`
  - Expected: fail because `exerciseSetupSteps` is not exported yet.

- [ ] **Step 4: Add `exerciseSetupSteps` to `src/config/practice.ts`**

```ts
export const exerciseSetupSteps = ['format', 'type', 'theme', 'generate'] as const;
```

- [ ] **Step 5: Rebuild the setup portion of `ExerciseMode.tsx`**
  - Keep generation/evaluation logic intact.
  - Replace the flat setup screen with a stepped layout that surfaces one decision group at a time while preserving current async behavior.
  - Ensure selected states use explicit foreground/background pairs so the current white-on-white bug disappears.

- [ ] **Step 6: Update the page wrapper in `ExercisesPage.tsx`**
  - Make the page title, supporting copy, and container align with the new editorial hierarchy and hub language.

- [ ] **Step 7: Run tests and lint**
  - Run: `npm run test -- src/config/practice.test.ts`
  - Run: `npm run lint`
  - Expected: both pass.

- [ ] **Step 8: Commit the exercise flow rewrite**

```bash
git add src/config/practice.ts src/components/exercises/ExercisesPage.tsx src/components/discovery/ExerciseMode.tsx src/components/shared/ThemeSelector.tsx
git commit -m "feat: convert exercises setup into guided flow"
```

### Task 5: Reframe live simulation as a justified setup experience

**Files:**
- Modify: `src/components/live-roleplay/LiveRoleplayPage.tsx`
- Modify: `src/components/live-roleplay/ScenarioSetup.tsx`

- [ ] **Step 1: Write the failing live-setup metadata test**

```ts
import { describe, expect, it } from 'vitest';
import { liveSetupModes } from '../../config/practice';

describe('liveSetupModes', () => {
  it('supports everyday and skill practice', () => {
    expect(liveSetupModes.map(mode => mode.id)).toEqual(['everyday', 'skill']);
  });
});
```

- [ ] **Step 2: Run the live-setup metadata test**
  - Run: `npm run test -- src/config/practice.test.ts`
  - Expected: fail because `liveSetupModes` is not exported yet.

- [ ] **Step 3: Add `liveSetupModes` to `src/config/practice.ts`**

```ts
export const liveSetupModes = [
  { id: 'everyday', title: 'Day-to-day scenarios' },
  { id: 'skill', title: 'Interview and professional' },
] as const;
```

- [ ] **Step 4: Rebuild `ScenarioSetup.tsx`**
  - Keep the scenario-generation logic and AI prompts.
  - Reframe the UI into a more clearly staged setup: mode switch, theme picker, intensity/custom description, final CTA.
  - Make back/exit behavior lead to `/practice` instead of dumping the user into unrelated pages.

- [ ] **Step 5: Update `LiveRoleplayPage.tsx`**
  - Keep `setup`, `conversation`, and `analysis` phases.
  - Align the page chrome and back button copy with the new hub-based navigation.

- [ ] **Step 6: Run lint**
  - Run: `npm run lint`
  - Expected: pass.

- [ ] **Step 7: Commit the simulation setup rewrite**

```bash
git add src/config/practice.ts src/components/live-roleplay/LiveRoleplayPage.tsx src/components/live-roleplay/ScenarioSetup.tsx
git commit -m "feat: redesign live simulation setup"
```

### Task 6: Retarget secondary pages without changing their product purpose

**Files:**
- Modify: `src/components/paths/PathsPage.tsx`
- Modify: `src/components/history/HistoryPage.tsx`
- Modify: `src/components/errors/ErrorDashboard.tsx`
- Modify: `src/components/library/LibraryPage.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Modify: `src/components/review/ReviewPage.tsx`

- [ ] **Step 1: Audit copy and CTA destinations**
  - Identify links/buttons that still send the user to an obsolete top-level area or use the old wording.

- [ ] **Step 2: Update the pages that now live under the new IA**
  - `PathsPage`, `HistoryPage`, and `ErrorDashboard` should feel like tools attached to the practice hub.
  - `ReviewPage`, `LibraryPage`, and `SettingsPage` keep their top-level role but must adopt the same token language and hierarchy.

- [ ] **Step 3: Run the legacy-token audit again**
  - Run: `grep -RIn "text-ink\\|bg-card-warm\\|border-edge\\|ring-sky" src/components`
  - Expected: no output.

- [ ] **Step 4: Run lint**
  - Run: `npm run lint`
  - Expected: pass.

- [ ] **Step 5: Commit the supporting-page polish**

```bash
git add src/components/paths/PathsPage.tsx src/components/history/HistoryPage.tsx src/components/errors/ErrorDashboard.tsx src/components/library/LibraryPage.tsx src/components/settings/SettingsPage.tsx src/components/review/ReviewPage.tsx
git commit -m "feat: align supporting pages with new information architecture"
```

### Task 7: Final regression pass

**Files:**
- Modify: `docs/superpowers/plans/2026-03-25-product-redesign-plan.md` (check off completed items during execution only)

- [ ] **Step 1: Run the focused metadata tests**
  - Run: `npm run test -- src/config/navigation.test.ts src/config/practice.test.ts`
  - Expected: pass.

- [ ] **Step 2: Run the full test suite**
  - Run: `npm run test`
  - Expected: pass.

- [ ] **Step 3: Run lint**
  - Run: `npm run lint`
  - Expected: pass.

- [ ] **Step 4: Run a production build**
  - Run: `npm run build`
  - Expected: TypeScript build and Vite bundle both pass.

- [ ] **Step 5: Execute manual QA in both themes**
  - Verify `/`, `/practice`, `/exercises`, `/live`, `/paths`, `/scripts`, `/history`, `/errors`, `/review`, `/library`, `/settings`.
  - Check hover, focus, selected, loading, empty, error, and back-navigation states.

- [ ] **Step 6: Commit the verified integration state**

```bash
git add src/App.tsx src/index.css src/config/navigation.ts src/config/practice.ts src/config/navigation.test.ts src/config/practice.test.ts src/components/layout/Header.tsx src/components/layout/Sidebar.tsx src/components/layout/Navigation.tsx src/components/layout/Layout.tsx src/components/discovery/DiscoveryPage.tsx src/components/discovery/ExerciseMode.tsx src/components/exercises/ExercisesPage.tsx src/components/live-roleplay/LiveRoleplayPage.tsx src/components/live-roleplay/ScenarioSetup.tsx src/components/paths/PathsPage.tsx src/components/history/HistoryPage.tsx src/components/errors/ErrorDashboard.tsx src/components/library/LibraryPage.tsx src/components/settings/SettingsPage.tsx src/components/review/ReviewPage.tsx src/components/practice/PracticeHubPage.tsx src/components/shared/ThemeSelector.tsx
git commit -m "feat: ship product redesign"
```

## Manual Review Notes

- Use the reviewer criteria from `/home/node/.codex/superpowers/skills/writing-plans/plan-document-reviewer-prompt.md`.
- Approval bar:
  - no TODO placeholders
  - spec requirements covered
  - tasks actionable without repo folklore
  - no route ambiguity between `/practice` and `/scripts`
