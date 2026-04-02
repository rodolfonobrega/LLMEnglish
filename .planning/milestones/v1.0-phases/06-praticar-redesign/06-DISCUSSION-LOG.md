# Phase 6: Praticar Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 06-praticar-redesign
**Areas discussed:** Card layout & proportions, Content density & info, Section layout & grouping, Image treatment & fallback

---

## Card Layout & Proportions

| Option | Description | Selected |
|--------|-------------|----------|
| Single-column vertical | One card per row, full-width, taller image banner than PathCard | ✓ |
| 2-column grid on desktop | Side-by-side on lg screens, single column on mobile | |
| Hero + smaller cards | First/highlighted mode gets large hero card, others compact | |

**User's choice:** Single-column vertical
**Notes:** Recommended option — simple, distinct from Trilhas, works great on mobile

### Banner Height

| Option | Description | Selected |
|--------|-------------|----------|
| h-40 (160px) — Taller | 25% taller than PathCard, more room for images | ✓ |
| h-48 (192px) — Much taller | 50% taller, magazine-like, more scroll | |
| h-36 (144px) — Slightly taller | Subtle difference, might not feel distinct | |

**User's choice:** h-40 (160px) — 25% taller than PathCard

---

## Content Density & Info

### Card Content

| Option | Description | Selected |
|--------|-------------|----------|
| Label + description + example | All info visible at a glance, fold tooltip text into card | ✓ |
| Label + description only | Minimal cards, example stays in tooltip | |
| Label + description + icon badge | Mode icon as overlay on image, example in tooltip | |

**User's choice:** Label + description + example text on card

### Tooltip Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Remove tooltips | All info on card, simpler code | ✓ |
| Keep tooltips | Redundant but keeps interactive feel | |
| You decide | Claude's discretion | |

**User's choice:** Remove ModeTooltip from PracticeHubPage

---

## Section Layout & Grouping

### Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 sections (Exercícios, Conversação, Trilhas) | Proven structure, matches current mental model | |
| Single flat list | Simpler but loses categorization | |
| 2 sections: Solo + Live | Solo has 5 self-paced modes, Live has 2 interactive modes | ✓ |

**User's choice:** 2 sections — "Prática Solo" (phrases, texts, situations, scripts, visual) and "Ao Vivo" (simulation, trails)

### Section Header Style

| Option | Description | Selected |
|--------|-------------|----------|
| Colored dot + label (current) | Existing pattern, minimal change | |
| Simple text headers only | Cleaner, less visual noise | |
| You decide | Claude's discretion for app consistency | ✓ |

**User's choice:** "Try to be consistent with other screens" — Claude to pick header style consistent with broader app patterns
**Notes:** Colored dot + uppercase label is currently only used in PracticeHubPage; other pages don't have section headers. Claude should pick a clean approach that works with the new vertical card layout.

---

## Image Treatment & Fallback

### Image Style

| Option | Description | Selected |
|--------|-------------|----------|
| Full-bleed banner | Image fills h-40 edge-to-edge, like PathCard | ✓ |
| Contained image with padding | Image inside rounded container, more structured | |
| Image with gradient overlay | Full-bleed with bottom gradient for text readability | |

**User's choice:** Full-bleed banner

### Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Mode icon + gradient background | Lucide icon on gradient using mode color tokens | ✓ |
| Emoji fallback (like PathCard) | Default emoji, consistent with PathCard | |
| Solid color background | Simplest, least engaging | |

**User's choice:** Mode icon + gradient background using mode color tokens — distinctive from PathCard's emoji fallback

---

## Claude's Discretion

- Section header styling (consistent with app patterns)
- Card border/shadow treatment and hover animation details
- Gap/spacing between cards and sections
- Whether to create new PracticeModeCard or modify ModeCard
- How to map modes into 2 sections in code

## Deferred Ideas

None — discussion stayed within phase scope.
