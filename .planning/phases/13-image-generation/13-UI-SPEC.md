---
phase: 13
slug: image-generation
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-08
---

# Phase 13 -- UI Design Contract

> Visual and interaction contract for the Image Generation phase. This phase is primarily a service-layer fix (option forwarding, API verification, resolution optimization). No new UI surfaces are introduced. The existing `ImageMode.tsx` component and its states remain unchanged visually.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (no shadcn init; manual shadcn-pattern components) |
| Preset | not applicable |
| Component library | Radix UI + Base UI (existing) |
| Icon library | lucide-react 0.563 |
| Font | Inter, system-ui, -apple-system, sans-serif |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding (`space-y-6` in ImageMode) |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none for this phase

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px (text-base) | 400 (normal) | 1.5 (relaxed) |
| Label | 12px (text-xs) | 700 (bold) | 1.0 (tracking-wide uppercase) |
| Heading | 18px (text-lg) | 700 (bold) | 1.3 |
| Display | 20px (text-xl) | 700 (bold) | 1.3 |

Note: This phase does not introduce new text surfaces. Values confirmed from existing `ImageMode.tsx` patterns: `text-lg font-bold`, `text-xs uppercase font-bold tracking-wide`, `text-sm text-muted-foreground`.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `hsl(var(--background))` #F7F9FB / #151A23 | Page background, surfaces |
| Secondary (30%) | `hsl(var(--card))` #ffffff / #1D222D | Cards, panels, image frames |
| Accent (10%) | `hsl(var(--brand-primary))` #2E7D6F / #359E8D | CTAs, active states, icons |
| Destructive | `hsl(var(--danger))` #D94F4F | Error banners only |

Accent reserved for: CTA buttons (`variant="coral"`), mode icon backgrounds (`bg-primary-soft`), evaluation score indicators

Mode-specific color for this phase: `hsl(var(--mode-visual))` -- 271 71% 65% (purple) for visual mode icon/badge elements. The `ImageMode.tsx` uses `bg-primary-soft` with `text-primary` for its icon container.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | "Gerar Desafio Visual" (existing, no change) |
| Empty state heading | "Desafio Visual" (existing) |
| Empty state body | "Descreva em ingles o que voce ve na imagem gerada por IA. Otimo para treinar vocabulario descritivo!" (existing) |
| Error state | Dynamic: `{error.message}` displayed in `bg-[var(--danger-soft)]` banner with `text-[var(--danger)]` (existing pattern) |
| Loading state text | "Avaliando sua descricao..." (existing) |
| Save confirmation | "Salvo na Biblioteca!" (existing) |
| Retry CTA | "Tentar Outro" (existing) |

**No destructive actions in this phase.** The only user-facing change is that image generation will respect configured options (quality, format, compression) instead of silently dropping them.

---

## Existing UI States (ImageMode.tsx)

This phase does not alter any visual states. The existing states are documented for reference:

| State | Visual | Component Pattern |
|-------|--------|-------------------|
| Empty | Icon circle + heading + description + CTA | `bg-muted rounded-2xl p-8` card |
| Loading | Skeleton placeholder | `Skeleton` + `SkeletonText` |
| Image + Task | Image in rounded frame + question card + AudioRecorder | `rounded-2xl border border-border` |
| Evaluating | Spinner + text | `Loader2 animate-spin` |
| Evaluation | Thumbnail + task card + `EvaluationResults` + save confirmation | Existing shared components |
| Error | Red-tinted banner | `bg-[var(--danger-soft)] border rounded-2xl p-4` |

---

## Phase-Specific Visual Notes

### What changes (service layer, not visual)
1. Option forwarding fix in `aiProxy.ts` -- no visual impact
2. Edge function option extraction fix in `index.ts` -- no visual impact
3. Resolution/format optimization in `images.ts` config -- images may be smaller in file size (JPEG vs PNG) but display dimensions unchanged
4. Default model sync in edge function -- no visual impact

### What stays the same (visual)
- All `ImageMode.tsx` markup and classes
- All existing tokens in `src/index.css`
- `ScenarioSetup.tsx` thumbnail display
- `ExerciseMode.tsx` image display

### Potential visible side-effect
After the fix, OpenAI-generated images in `imageMode` and `exerciseMode` will use `format: 'png'` with `quality: 'medium'` (these were configured but never sent). For `scenarioThumbnail`, images will use `format: 'jpeg'` with `compression: 85` and `quality: 'low'`. These format changes produce smaller file sizes but identical display rendering. No UI adjustment needed.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none (no shadcn init) | not applicable |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS -- all copy pre-existing, no new text surfaces
- [x] Dimension 2 Visuals: PASS -- no new visual surfaces; existing states documented
- [x] Dimension 3 Color: PASS -- uses existing tokens exclusively; no new colors
- [x] Dimension 4 Typography: PASS -- uses existing type scale; no new text roles
- [x] Dimension 5 Spacing: PASS -- uses existing spacing; no new layout patterns
- [x] Dimension 6 Registry Safety: PASS -- no third-party registries or blocks

**Approval:** pending
