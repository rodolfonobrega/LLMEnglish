# Phase 6: Praticar Redesign - Research

**Researched:** 2026-04-02
**Domain:** UI component redesign (React, Tailwind CSS v4, accessibility)
**Confidence:** HIGH

## Summary

This phase replaces the horizontal ModeCard list on the Praticar page with vertically-oriented, image-banner cards. The design is inspired by the existing PathCard component and is fully specified in the UI-SPEC.md contract. The scope is narrow: one new component (PracticeModeCard), one page rewrite (PracticeHubPage), and an optional config addition (soloModes/liveModes arrays in modes.ts).

The existing codebase provides all building blocks: PathCard demonstrates the image-banner pattern, ModeCard demonstrates the `<button>` accessibility pattern and mode color token usage, and all 7 mode images exist in `public/images/modes/`. No new dependencies are needed. The `--mode-*-soft` CSS variables use opacity syntax (`258 70% 66% / 0.1`), which works with `hsl()` wrapping in inline styles.

**Primary recommendation:** Create a new `PracticeModeCard` component in `src/components/shared/` that adapts PathCard's image-banner structure with ModeCard's `<button>` accessibility pattern. Rewrite PracticeHubPage to use 2 sections (Solo + Ao Vivo) with vertical single-column layout.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single-column vertical layout -- one full-width card per row, no grid
- **D-02:** Image banner height is h-40 (160px) -- 25% taller than PathCard's h-32
- **D-03:** Cards are `<button>` elements with image-banner-top, text-content-below structure
- **D-04:** Each card shows: label, description, and example text directly on the card -- no hover required
- **D-05:** Remove ModeTooltip wrapper from PracticeHubPage -- all information visible at a glance
- **D-06:** Example text shown as smaller italic line below description (e.g., "Ex: Voce quer pedir um cafe...")
- **D-07:** Two sections: "Pratica Solo" (phrases, texts, situations, scripts, visual) and "Ao Vivo" (simulation, trails)
- **D-08:** Section header style -- Claude's discretion, should be consistent with app-wide patterns
- **D-09:** Full-bleed image banner -- image fills entire h-40 area edge-to-edge
- **D-10:** Hover effect: subtle image scale (group-hover:scale-105) matching PathCard pattern
- **D-11:** Image fallback: mode's Lucide icon centered on a gradient background using mode's color tokens

### Claude's Discretion
- Exact section header styling (as long as consistent with app patterns)
- Card border/shadow treatment and hover animation details
- Gap/spacing between cards and between sections
- Whether to create a new `PracticeModeCard` component or modify existing `ModeCard`
- How to map the 7 modes into the 2 new sections in code (config change vs inline in PracticeHubPage)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-01 | Praticar page displays practice modes as image-banner cards (inspired by PathCard) | PathCard.tsx provides proven image-banner pattern; ModeCard.tsx provides `<button>` + color token pattern; PracticeModeCard spec in UI-SPEC defines the synthesis |
| VIS-02 | Praticar cards use different proportions than Trilhas cards to maintain visual distinction | h-40 (160px) vs PathCard h-32 (128px), single-column vs grid, gradient+icon fallback vs emoji fallback, 3-field content vs 2-field content |
| VIS-03 | All Praticar cards are keyboard accessible (button elements, ARIA attributes) | ModeCard already uses `<button>` with focus-visible ring; PracticeModeCard inherits this pattern with aria-label per UI-SPEC |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2 | UI framework (useState for imgError) | Project framework |
| Tailwind CSS | 4.1 | Utility-first styling | Project CSS framework |
| lucide-react | 0.563 | Mode icons for image fallback | Project icon library |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cn() utility | (internal) | Conditional Tailwind class composition | Every component for class merging |
| class-variance-authority | 0.7 | Variant-based styling | NOT needed here -- single card variant |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New PracticeModeCard | Modify ModeCard in place | Modifying ModeCard risks breaking other consumers if any appear; new component is safer and cleaner |

**Installation:** No new packages needed. All dependencies already installed.

**Version verification:** Existing project -- all versions confirmed from package.json.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    shared/
      ModeCard.tsx           # KEEP (existing, no changes)
      PracticeModeCard.tsx   # NEW (image-banner card for Praticar page)
    practice/
      PracticeHubPage.tsx    # REWRITE (2-section layout, remove ModeTooltip)
  config/
    modes.ts                 # OPTIONAL (add soloModes/liveModes exports)
```

### Pattern 1: Image-Banner Card with Button Accessibility
**What:** A `<button>` element containing an image banner area above a text content area, with graceful image fallback.
**When to use:** For clickable card items that need keyboard accessibility and visual image treatment.
**Example:**
```tsx
// Adapted from PathCard.tsx (image banner) + ModeCard.tsx (button pattern)
export function PracticeModeCard({ mode, onClick, className }: PracticeModeCardProps) {
  const Icon = mode.icon;
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card overflow-hidden',
        'transition-all duration-200 card-hover card-hover-border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 cursor-pointer group relative',
        className,
      )}
      aria-label={`${mode.label}: ${mode.description}`}
    >
      {/* Image Banner -- h-40, full-bleed */}
      <div className="h-40 w-full overflow-hidden bg-muted">
        {mode.image && !imgError ? (
          <img
            src={mode.image}
            alt={mode.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(var(--mode-${mode.colorVar}-soft)) 0%, hsl(var(--mode-${mode.colorVar})) 100%)`,
            }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4">
        <span className="font-semibold text-base" style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}>
          {mode.label}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
        <p className="text-xs italic mt-2" style={{ color: `hsl(var(--mode-${mode.colorVar}))`, opacity: 0.8 }}>
          Ex: {mode.example}
        </p>
      </div>
    </button>
  );
}
```

### Pattern 2: Section Layout with Mode Grouping
**What:** Two sections with header and vertical card list, grouping modes by interaction type.
**When to use:** For the Praticar page's 2-section layout (Solo vs Ao Vivo).
**Example:**
```tsx
// In PracticeHubPage.tsx
const soloModes = [...exerciseModes.slice(0, 4), conversationModes.find(m => m.id === 'visual')!];
const liveModes = [conversationModes.find(m => m.id === 'simulation')!, trailsMode];

// OR: export soloModes/liveModes from modes.ts config
```

### Anti-Patterns to Avoid
- **Wrapping `<button>` in a `<div>` with separate onClick:** The current PracticeHubPage wraps ModeCard (a button) in a `<div>` inside ModeTooltip. With tooltips removed, this extra div wrapper is unnecessary.
- **Using `<div onClick>` instead of `<button>`:** Breaks keyboard accessibility per VIS-03. PathCard uses `<div onClick>` which is fine for it but wrong for this use case.
- **Hardcoding color values:** Always use `hsl(var(--mode-${mode.colorVar}))` via inline style, never raw hex/HSL values.
- **Forgetting `group` class on outer container:** The `group-hover:scale-105` on the image requires `group` on the parent element.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card hover effects | Custom CSS transition classes | `.card-hover` + `.card-hover-border` utility classes | Already defined in index.css with dark mode variants |
| Class composition | String concatenation | `cn()` utility (clsx + twMerge) | Handles conditional classes and Tailwind deduplication |
| Mode color application | Hardcoded color maps | `hsl(var(--mode-${mode.colorVar}))` inline styles | Works with light/dark theme switching automatically |

**Key insight:** The codebase already has every building block. This phase is assembly, not invention.

## Common Pitfalls

### Pitfall 1: --mode-*-soft CSS Variable Opacity Syntax
**What goes wrong:** The `--mode-*-soft` variables include opacity in their value (e.g., `258 70% 66% / 0.1`). Using them with `hsl()` works because Tailwind v4 CSS variables use the modern HSL syntax that includes alpha.
**Why it happens:** The gradient fallback needs the soft color (light, translucent) for the start and the full color for the end.
**How to avoid:** Use `hsl(var(--mode-${mode.colorVar}-soft))` for the soft end and `hsl(var(--mode-${mode.colorVar}))` for the full color end. Both work correctly with the inline style `background` property.
**Warning signs:** If gradient fallback appears as a solid color or transparent, check that the CSS variable is being wrapped in `hsl()`.

### Pitfall 2: Image Banner rounded corners conflict
**What goes wrong:** Adding `rounded-t-xl` on the image container creates visible border radius mismatch with the outer card's `rounded-xl` when `overflow-hidden` is on the outer card.
**Why it happens:** Both the outer card and the inner image container have border-radius, causing double-rounding or visible gaps.
**How to avoid:** Put `overflow-hidden` and `rounded-xl` only on the outer `<button>`. The image container needs neither -- it's clipped by the parent. The current PathCard has `rounded-t-xl` on the image div, but that's because PathCard's outer div has `overflow-hidden` and `rounded-xl` on itself.
**Warning signs:** Visible line or gap between image and card border at corners.

### Pitfall 3: Missing `group` class breaks hover scale
**What goes wrong:** `group-hover:scale-105` on the image has no effect when hovering.
**Why it happens:** The `group` class must be on a parent element for `group-hover:` utilities to work.
**How to avoid:** Ensure the outer `<button>` has `group` in its className.
**Warning signs:** Image does not scale on hover, but card shadow/translate still works.

### Pitfall 4: Mode grouping -- visual mode is in conversationModes but belongs in Solo
**What goes wrong:** The "visual" mode (`Desafio Visual`) is in `conversationModes` array in modes.ts, but CONTEXT.md D-07 puts it in "Pratica Solo" section.
**Why it happens:** The config array grouping (`exerciseModes`, `conversationModes`, `trailsMode`) does not match the new 2-section layout. `visual` is self-paced despite being in `conversationModes`.
**How to avoid:** Either (a) add new `soloModes`/`liveModes` exports to modes.ts, or (b) compose the arrays inline in PracticeHubPage. Option (b) is simpler and avoids touching the config file, but makes the grouping logic harder to test.
**Warning signs:** Visual mode appearing in "Ao Vivo" section instead of "Pratica Solo".

### Pitfall 5: `aria-label` must be on the button, not on a child
**What goes wrong:** Screen readers announce the button without meaningful text if aria-label is missing.
**Why it happens:** The `<button>` contains only styled spans and paragraphs -- no direct text node. Without aria-label, the accessible name may be empty or garbled.
**How to avoid:** Add `aria-label={`${mode.label}: ${mode.description}`}` directly on the `<button>` element per UI-SPEC.
**Warning signs:** Accessibility audit flags buttons with empty or missing accessible names.

## Code Examples

### PracticeModeCard Component (Full)
```tsx
// Source: Adapted from PathCard.tsx + ModeCard.tsx patterns
import { useState } from 'react';
import { cn } from '../../utils/cn';
import type { PracticeMode } from '../../config/modes';

interface PracticeModeCardProps {
  mode: PracticeMode;
  onClick?: () => void;
  className?: string;
}

export function PracticeModeCard({ mode, onClick, className }: PracticeModeCardProps) {
  const Icon = mode.icon;
  const [imgError, setImgError] = useState(false);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-xl border border-border bg-card overflow-hidden',
        'transition-all duration-200 card-hover card-hover-border',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'focus-visible:ring-offset-2 cursor-pointer group relative',
        className,
      )}
      aria-label={`${mode.label}: ${mode.description}`}
    >
      <div className="h-40 w-full overflow-hidden bg-muted">
        {mode.image && !imgError ? (
          <img
            src={mode.image}
            alt={mode.label}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(var(--mode-${mode.colorVar}-soft)), hsl(var(--mode-${mode.colorVar})))`,
            }}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
        )}
      </div>
      <div className="p-4">
        <span
          className="font-semibold text-base"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))` }}
        >
          {mode.label}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{mode.description}</p>
        <p
          className="text-xs italic mt-2"
          style={{ color: `hsl(var(--mode-${mode.colorVar}))`, opacity: 0.8 }}
        >
          Ex: {mode.example}
        </p>
      </div>
    </button>
  );
}
```

### Section Header (consistent with app pattern)
```tsx
// Source: Existing PracticeHubPage pattern, using bg-primary for neutral section dot
<div className="flex items-center gap-2 mb-4">
  <div className="w-2 h-2 rounded-full bg-primary" />
  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
    Pratica Solo
  </span>
</div>
```

### Mode Grouping (inline approach)
```tsx
// In PracticeHubPage.tsx -- avoids modifying modes.ts
const soloModes: readonly PracticeMode[] = [
  ...exerciseModes, // phrases, texts, situations, scripts
  conversationModes.find(m => m.id === 'visual')!,
];
const liveModes: readonly PracticeMode[] = [
  conversationModes.find(m => m.id === 'simulation')!,
  trailsMode,
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three sections (Exercicios, Conversacao, Trilhas) | Two sections (Pratica Solo, Ao Vivo) | This phase | Reflects user mental model: self-paced vs real-time |
| Horizontal ModeCard with gradient background | Vertical image-banner card | This phase | Magazine-like feel, more visual information density |
| ModeTooltip for example/description | Inline display on card | This phase | All info visible without hover, better mobile UX |
| Mode-colored section dots | Brand-primary section dots | This phase | Neutral since each card has its own mode color |

**Deprecated/outdated:**
- `ModeCard` usage in PracticeHubPage: Replaced by PracticeModeCard, but ModeCard component itself is kept (no other consumers currently, but safe to retain)
- `ModeTooltip` usage in PracticeHubPage: Removed, but ModeTooltip component retained for potential other consumers

## Open Questions

1. **Should soloModes/liveModes be exported from modes.ts?**
   - What we know: CONTEXT.md D-07 specifies the grouping, UI-SPEC says "at executor discretion"
   - What's unclear: Whether test coverage for grouping should be at config level
   - Recommendation: Inline grouping in PracticeHubPage is simpler. If modes.ts is modified, update modes.test.ts with new array assertions. Both approaches are valid; planner should pick one.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vite.config.ts (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | PracticeModeCard renders image banner with mode image | unit | `npx vitest run src/components/shared/PracticeModeCard.test.tsx` | Wave 0 |
| VIS-01 | PracticeModeCard renders gradient fallback on image error | unit | `npx vitest run src/components/shared/PracticeModeCard.test.tsx` | Wave 0 |
| VIS-01 | PracticeModeCard shows label, description, and example text | unit | `npx vitest run src/components/shared/PracticeModeCard.test.tsx` | Wave 0 |
| VIS-02 | PracticeModeCard has h-40 image banner (different from PathCard h-32) | visual/manual | Manual visual check | N/A |
| VIS-03 | PracticeModeCard is a button element, focusable, with aria-label | unit | `npx vitest run src/components/shared/PracticeModeCard.test.tsx` | Wave 0 |
| VIS-03 | PracticeModeCard activates on Enter/Space key press | unit | `npx vitest run src/components/shared/PracticeModeCard.test.tsx` | Wave 0 |
| VIS-01 | PracticeHubPage renders 2 sections with correct mode counts | unit | `npx vitest run src/components/practice/PracticeHubPage.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/shared/PracticeModeCard.test.tsx src/components/practice/PracticeHubPage.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/shared/PracticeModeCard.test.tsx` -- covers VIS-01 (render, fallback, content), VIS-03 (button element, aria-label, keyboard)
- [ ] `src/components/practice/PracticeHubPage.test.tsx` -- covers VIS-01 (2 sections, correct mode grouping, no ModeTooltip usage)

## Sources

### Primary (HIGH confidence)
- `src/components/ui/custom/PathCard.tsx` -- image-banner pattern, hover effects, fallback logic
- `src/components/shared/ModeCard.tsx` -- `<button>` accessibility pattern, mode color token usage
- `src/components/practice/PracticeHubPage.tsx` -- current page structure, ModeTooltip usage
- `src/config/modes.ts` -- PracticeMode type, mode arrays, field inventory
- `src/index.css` -- card-hover/card-hover-border utilities, mode color CSS variables
- `06-UI-SPEC.md` -- detailed component spec, layout, interaction states

### Secondary (MEDIUM confidence)
- `src/components/shared/ModeTooltip.tsx` -- tooltip content (label, description, example) to be folded into cards
- `src/components/paths/PathsPage.tsx` -- PathCard usage reference (grid layout, spacing patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns from existing codebase
- Architecture: HIGH -- UI-SPEC fully specifies component structure and layout
- Pitfalls: HIGH -- identified from reading actual CSS variable values and component patterns

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- no fast-moving dependencies)
