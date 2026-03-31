# Product Redesign Specification

## Overview
- **Goal:** deliver a Studio Editorial delivery of the SpeakLab experience by consolidating navigation, stabilizing the visual foundation, and reshaping the live/practice flows so the product feels cohesive again.
- **Context:** current UI has duplicated navigation items, inconsistent tokens (`text-ink`, `bg-card-warm`, `--sky`), and fragmented flows (Exercícios, Simulação, Trilhas, Scripts, Histórico, Erros) that fight the user for attention. The new direction prioritizes a focused `Praticar` hub and a refined navigation shell (`Início`, `Praticar`, `Revisão`, `Biblioteca`, `Configurações`) surfaced against Studio Editorial type/spacing.

## Architecture
- **Navigation:** reduce to five primary destinations (`Início`, `Praticar`, `Revisão`, `Biblioteca`, `Configurações`). Move `Trilhas`, `Scripts`, `Histórico` and `Erros` under `Praticar` or as contextual helpers rather than separate nav entries.
- **Practice hub:** centralize content creation. Provide two primary modes (`Exercícios`, `Simulação`) surfaced as prominent cards/sections; advanced modes (`Trilhas`, `Scripts`) stay contextual but accessible from within the hub.
- **Visual foundation:** align on a single set of CSS variables and component tokens (primary, coral, danger, leaf, etc.) so inputs/cards/dialogs share consistent states. Remove legacy classes and ensure parity between light/dark.
- **Flows:** Introduce a wizard-like `Exercícios` flow with clear step boundaries, and a structured `Simulação` setup that separates everyday vs professional modes, theme selection, and scenario generation before placement.

## Visual Language
- **Studio Editorial:** warm neutrals, editorial typography, fewer competing cards, stronger typographic hierarchy. Keep `light` and `dark` equally polished.
- **States:** define hover/active/focus/selected/disabled/loading/empty/error for interactive components (buttons, cards, lists, dialogs). Prevent white-on-white issues by explicitly pairing background/text tokens.
- **Accent usage:** use brand gradients sparingly for highlights (e.g., Hero card on home, focus states), rely on full-area backgrounds for readability.

## Key Screens
1. **Início:** dashboard-only. Show progress, streak, the `Praticar` hero (with CTA that opens hub, not direct custom scenario), success metrics. Provide quick-card navigation but no complex settings.
2. **Praticar hub:** highlight the two primary modes with clear calls to prologue the wizard. Within mode, steps show current selections and actions (format → type → theme → generate → record → evaluate). Additional cards link to `Trilhas` or `Scripts` but are clearly subordinate.
3. **Simulação:** explicit mode switch (everyday/professional), theme chips, intensity selection, optional custom prompt. CTA enters live conversation; exit/back flows return to hub.
4. **Supporting pages:** `Revisão`, `Biblioteca`, `Configurações` keep their purpose but adopt revamped tokens/components from the new system.

## Component Foundation
- **Tokens:** centralize in `src/index.css` with CSS variables for base colors (`--background`, `--foreground`, `--card`, `--border`, etc.), brand colors (primary, coral, leaf, special) and their soft variants. Use `@theme` to expose `--color-*` values for tailwind utilities.
- **Atoms:** `Button`, `Input`, `Textarea`, `Select`, `Dialog`, `AlertDialog`, `Card` need consistent classes referencing tokens. Update any shadowed classes (`text-ink`, `border-edge`, `ring-sky`, etc.).
- **Feedback:** ensure toasts/cards show success/danger messaging using consistent tokens (e.g., `bg-[var(--danger-soft)] border-[var(--danger)]/30` replaced with `bg-danger/10 border-danger/20` where appropriate).

## Risks
- Navigation refactor risks breaking deep links; ensure routes for `Exercícios`, `Simulação`, `Trilhas`, `Histórico`, `Erros` remain reachable.
- Incomplete token migration could leave selects/dialogs unreadable; verify every component uses new tokens.
- `Dark mode` must be kept first-class; style reset must mirror light version to avoid regressions.

## Validation
- Manual walkthrough for every page in light/dark (hover/focus states, empty/error states, CTA flows).
- Tests/guards around routing and high-level components if logic is introduced (e.g., new wizard step state).
- Visual QA for new tokens and component combos.
