# Phase 6: Praticar Redesign - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current horizontal ModeCard list on the Praticar page with vertically-oriented, image-banner cards inspired by the existing PathCard component. The page must feel visually polished and distinct from the Trilhas page, while maintaining full keyboard accessibility.

Scope is limited to PracticeHubPage.tsx and its direct card component. No new practice modes, no route changes, no backend work.

</domain>

<decisions>
## Implementation Decisions

### Card Layout & Proportions
- **D-01:** Single-column vertical layout — one full-width card per row, no grid
- **D-02:** Image banner height is h-40 (160px) — 25% taller than PathCard's h-32, providing visually distinct proportions per VIS-02
- **D-03:** Cards are `<button>` elements (inheriting current ModeCard's keyboard accessibility) with image-banner-top, text-content-below structure

### Content Density & Info
- **D-04:** Each card shows: label, description, and example text directly on the card — no hover required
- **D-05:** Remove ModeTooltip wrapper from PracticeHubPage — all information is visible at a glance
- **D-06:** Example text shown as smaller italic line below description (e.g., "Ex: Você quer pedir um café. Como você diria isso?")

### Section Layout & Grouping
- **D-07:** Two sections instead of current three:
  - **"Prática Solo"** — phrases, texts, situations, scripts, visual (5 self-paced modes)
  - **"Ao Vivo"** — simulation, trails (2 real-time/interactive modes)
- **D-08:** Section header style — Claude's discretion, should be consistent with app-wide patterns (current colored-dot + uppercase label is only used in PracticeHubPage; pick a style that works with the new vertical cards)

### Image Treatment & Fallback
- **D-09:** Full-bleed image banner — image fills the entire h-40 area edge-to-edge
- **D-10:** Hover effect: subtle image scale (group-hover:scale-105) matching PathCard pattern
- **D-11:** Image fallback: mode's Lucide icon centered on a gradient background using the mode's color tokens (--mode-*-soft to --mode-* gradient) — distinctive from PathCard's emoji fallback

### Claude's Discretion
- Exact section header styling (as long as it's consistent with app patterns)
- Card border/shadow treatment and hover animation details
- Gap/spacing between cards and between sections
- Whether to create a new `PracticeModeCard` component or modify existing `ModeCard`
- How to map the 7 modes into the 2 new sections in code (config change vs inline in PracticeHubPage)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference Design
- `src/components/ui/custom/PathCard.tsx` — The card design that inspires the new Praticar cards (image banner + text below, hover effects, fallback logic)
- `src/components/paths/PathsPage.tsx` — How PathCard is used in production (layout patterns, spacing)

### Current Implementation
- `src/components/practice/PracticeHubPage.tsx` — The page being redesigned (current section grouping, ModeCard + ModeTooltip usage)
- `src/components/shared/ModeCard.tsx` — Current horizontal card component (keyboard accessibility pattern via `<button>`, color token usage)
- `src/components/shared/ModeTooltip.tsx` — Tooltip being removed (example text to be folded into cards)
- `src/config/modes.ts` — PracticeMode type, exerciseModes/conversationModes/trailsMode arrays, colorVar and image fields

### Design Tokens
- `src/index.css` — Mode color CSS variables (--mode-phrases, --mode-phrases-soft, etc.) and card utility classes (.card-hover, .card-hover-border)

### Requirements
- `.planning/REQUIREMENTS.md` — VIS-01, VIS-02, VIS-03 acceptance criteria
- `.planning/PROJECT.md` — Constraints (no new frameworks, existing design tokens, no breaking changes)

### Prior Phase Context
- `.planning/phases/05-storage-consolidation/05-CONTEXT.md` — Storage patterns (Praticar page reads from storage facade)
- `.planning/phases/03-code-splitting/03-CONTEXT.md` — Lazy loading pattern used by PracticeHubPage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PathCard` component: Image banner pattern, hover scale, imgError state, fallback rendering — provides proven patterns to adapt
- `ModeCard` component: `<button>` element pattern for accessibility, mode color token styling via inline styles, PracticeMode type integration
- `cn()` utility: Available for conditional class composition
- Mode color tokens: 7 complete sets (--mode-{id} + --mode-{id}-soft) in both light and dark themes
- Mode images: 7 PNGs in `public/images/modes/` (phrases, texts, situations, scripts, simulation, visual, trails)

### Established Patterns
- Named exports with `export function ComponentName()` — no default exports
- Inline style for dynamic mode colors: `style={{ borderLeftColor: 'hsl(var(--mode-${mode.colorVar}))' }}`
- `useState` for imgError tracking in card components
- `useNavigate()` for route navigation on card click
- `cn()` for Tailwind class composition

### Integration Points
- `src/config/modes.ts` exports `exerciseModes`, `conversationModes`, `trailsMode`, and `allModes` — the new 2-section grouping may need new exported arrays or inline grouping
- `src/config/navigation.ts` — `/practice` route with `Praticar` label, no changes needed
- `src/App.tsx` — Lazy-loaded route `path="practice"` with `errorElement={<ErrorFallback />}`, no changes needed
- PracticeHubPage is lazy-loaded: `lazy(() => import(...).then(m => ({ default: m.PracticeHubPage })))` — keep named export

</code_context>

<specifics>
## Specific Ideas

- Cards should feel "magazine-like" — image-forward, tall banners, clean typography below
- The 2-section split (Solo vs Live) reflects how users think about practice: self-paced exercises vs real-time interaction
- Image fallback should use mode icon (not emoji) to differentiate from PathCard's emoji fallback

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-praticar-redesign*
*Context gathered: 2026-04-02*
