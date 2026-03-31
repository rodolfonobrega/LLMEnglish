# Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the SpeakLab experience by standardizing the visual foundation, consolidating navigation around a single `Praticar` hub, and rebuilding the home/practice/simulation flows under the Studio Editorial language.

**Architecture:** Cleanly separate the work into a multi-phase refactor so redirected navigation, tokens, and flows evolve together. Phase 1 rebuilds the style system and atoms; Phase 2 reshapes the layout/nav shell; Phase 3 introduces the new practice hub flows and `Simulação` wizard while keeping supporting pages consistent.

**Tech Stack:** React + TypeScript, Tailwind CSS v4 with `@theme`, Vitest (jsdom), npm scripts (`make` wrappers), existing shadcn-style component library.

---

### Task 1: Redesign Design Tokens & Global Styles

**Files:**
- Modify: `src/index.css`
- Modify: `src/utils/cn.ts` (ensure tailwind-friendly tokens if needed)
- Test: `npm run lint`

- [ ] **Step 1: Research current token usage**
  - Search for legacy variables/classes mentioned in the spec (`text-ink`, `bg-card-warm`, `border-edge`, `ring-sky`, `--sky`, `--coral`, `--leaf`).
  - Note components still referencing them to verify after the update.

- [ ] **Step 2: Update `src/index.css`**
  - Replace the existing CSS variables with the Studio Editorial token set in the spec (base colors, brand, soft variants, z-index values).
  - Update the `@theme` block to expose `--color-*` values for tailwind utilities and define consistent radius/animation tokens.
  - Refresh the `@layer base` section to apply tokens, reduced-motion, and scrollbar styles aligned with the new vocabulary.

- [ ] **Step 3: Verify legacy tokens removed**
  - Run `rg "text-ink\\|bg-card-warm\\|border-edge\\|ring-sky" -n src` expecting no results; document any remaining occurrences.

- [ ] **Step 4: Run lint**
  - Command: `npm run lint`
  - Expected: `Done in ...` with all lint rules passing; no new issues introduced by CSS changes.

- [ ] **Step 5: Record & commit**
  - Capture the node search and lint outputs (`rg` list + lint summary) in the task notes before committing.
  - `git add src/index.css`
  - `git commit -m "feat: reset design tokens for editorial system"`

### Task 2: Update Core UI Atoms

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/Textarea.tsx`
- Modify: `src/components/ui/Select.tsx`
- Modify: `src/components/ui/Dialog.tsx`
- Modify: `src/components/ui/AlertDialog.tsx`
- Test: `npm run lint`

- [ ] **Step 1: Add failing guard**
  - Add temporary Storybook-style vignette? Instead, document that the new tests will look for `button`/`input` class names referencing the tokens to keep states consistent; there is no existing automated test so rely on lint/test run in Step 4.

- [ ] **Step 2: Rework atoms**
  - Ensure each component references the new tokens (e.g., `bg-card`, `text-foreground`, `border-border`, `focus-visible:ring-primary`).
  - Harmonize variants (primary/coral/outline/ghost) with the editorial palette, explicitly specifying hover/focus/active states using tokens.
  - Update `Select`/`Dialog`/`AlertDialog` to drop legacy classes and add explicit `text-foreground`/`bg-card` usage, plus consistent focus rings.

- [ ] **Step 3: Assert RTL and accessibility tokens**
  - Confirm components keep `aria` props intact and text remains legible with the new colors (manual note).

- [ ] **Step 4: Run lint**
  - Command: `npm run lint`
  - Expected: pass.

- [ ] **Step 5: Commit changes**
  - `git add` the modified component files.
  - `git commit -m "feat: align UI atoms with editorial tokens"`

### Task 3: Rebuild Layout & Navigation Shell

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/layout/Navigation.tsx`
- Modify: `src/components/layout/Layout.tsx`
- Test: `npm run lint`

- [ ] **Step 1: Define new nav structure**
  - Update the nav arrays in `Sidebar` & `Navigation` to only include `Início`, `Praticar`, `Revisão`, `Biblioteca`, `Configurações`.
  - Document unused routes (e.g., `/paths`, `/scripts`, `/live` still exist but will be surfaced differently).

- [ ] **Step 2: Rework layout visuals**
  - Apply editorial spacing/typography to `Header`, `Sidebar`, and mobile nav (hero tile, card accent).
  - Ensure the `Layout` uses the updated `Navigation` array and that the `Outlet` container mimics the new wide center experience.

- [ ] **Step 3: Validate navigation routes**
  - Confirm `App.tsx` still routes to `/live`, `/exercises`, etc., but the nav now directs to the new hub (the hub component will still mount at `/practice` or alias `/praticar`).

- [ ] **Step 4: Run lint**
  - Command: `npm run lint`
  - Expected: pass.

- [ ] **Step 5: Commit**
  - `git add src/components/layout/{Header,Sidebar,Navigation,Layout}.tsx`
  - `git commit -m "feat: streamlined navigation shell"`

### Task 4: Build Practice Hub & Home Dashboard

**Files:**
- Modify: `src/components/discovery/DiscoveryPage.tsx`
- Create/Modify: `src/components/practice/PracticeHub.tsx` (new summary hub)
- Modify: `src/components/practice/PracticePage.tsx`
- Modify: `src/components/discovery/ExerciseMode.tsx` (if used)
- Modify: `src/components/live-roleplay/ScenarioSetup.tsx` & `LiveRoleplayPage.tsx`
- Test: `npm run test` (or targeted component tests)

- [ ] **Step 1: Identify Wizard States**
  - Document the steps for `Exercícios` (format→type→theme→generate).
  - Outline the `Simulação` steps (mode switch, theme chips, intensity, custom prompt).

- [ ] **Step 2: Implement Practice Hub**
  - Introduce `PracticeHub` component that highlights `Exercícios` & `Simulação` as cards with CTA into the wizard, plus links to `Trilhas`, `Scripts`, `Histórico`, and `Erros`.
  - Replace `DiscoveryPage` hero CTA to lead into this hub rather than jumping straight to `/live`.

- [ ] **Step 3: Redesign `PracticePage` flows**
  - Convert the existing form into a structured wizard with cards/steps showing selection identity. Use editorial typography and tokens.
  - Update `ScenarioSetup` and `LiveRoleplayPage` to reflect the mode switch and guided setup described in the spec.
  - Ensure `PracticePage` exposes the correct CTA per mode and retains ability to save/evaluate.

- [ ] **Step 4: Run tests**
  - Command: `npm run test -- --watch=false`
  - Expected: suite passes; focus on any unit tests covering practice/live components.

- [ ] **Step 5: Commit**
  - `git add` all modified practice/live components.
  - `git commit -m "feat: build practice hub and flows"`

### Task 5: Stabilize Supporting Pages

**Files:**
- Modify: `src/components/paths/PathsPage.tsx`
- Modify: `src/components/history/HistoryPage.tsx`
- Modify: `src/components/errors/ErrorDashboard.tsx`
- Modify: `src/components/library/LibraryPage.tsx`
- Modify: `src/components/settings/SettingsPage.tsx`
- Test: `npm run lint`

- [ ] **Step 1: Re-graft these views under Practice**
  - Update copy/CTA to signal they are supporting the `Praticar` hub (e.g., link from PracticeHub).
  - Ensure UI tokens in these components use new design tokens.

- [ ] **Step 2: Confirm `dark mode` parity**
  - Review each page in both modes manually (note in plan how to toggle via theme switch).
  - Document any component needing tweaks.

- [ ] **Step 3: Run lint & regression tests**
  - `npm run lint`
  - Optional: rerun `npm run test` if previous step touched logic.

- [ ] **Step 4: Commit**
  - `git add` the supporting page files.
  - `git commit -m "feat: polish supporting pages under new practice hub"`

