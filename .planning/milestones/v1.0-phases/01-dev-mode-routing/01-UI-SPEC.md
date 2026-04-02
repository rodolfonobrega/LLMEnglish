---
phase: 1
slug: dev-mode-routing
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-02
---

# Phase 1 -- UI Design Contract

> Visual and interaction contract for the Dev Mode Routing phase. This phase introduces one new visual element (DevBanner) and wires existing Layout/Routing for dev mode. All other visual infrastructure already exists.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (shadcn not initialized; project has mature custom system) |
| Preset | not applicable |
| Component library | Radix UI + Base UI |
| Icon library | lucide-react 0.563 |
| Font | Inter, system-ui, -apple-system, sans-serif |

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing, nav padding |
| lg | 24px | Section padding, sidebar header padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

### Existing Spacing Evidence (from Layout/Sidebar/Header)

- Sidebar width: `w-64` (256px)
- Sidebar header padding: `p-6` (24px)
- Sidebar nav padding: `px-4` (16px)
- Nav item padding: `px-4 py-3` (16px horizontal, 12px vertical)
- Header padding: `px-6 py-3` (24px horizontal, 12px vertical)
- Main content: `px-4 py-6 pb-24` (16px horizontal, 24px vertical, 96px bottom)
- Gap sizes: `gap-3` (12px), `gap-2` (8px)

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 (normal) | default (~1.5) |
| Label | 10px (`text-[10px]`) | 600 (`font-semibold`) | tight |
| Heading | 18px (`text-lg`) | 700 (`font-bold`) | default |
| Display | 16px (`text-base`) | 700 (`font-bold`) | tight (`leading-tight`) |

### Existing Typography Evidence

- App title (Sidebar): `text-lg font-bold` (18px, bold)
- App title (Header mobile): `text-base font-bold` (16px, bold)
- Nav labels (Sidebar): `text-sm font-medium` (14px, medium)
- Nav labels (Mobile): `text-[10px] font-semibold` (10px, semibold)
- Level text: `text-xs font-semibold` (12px, semibold)
- Streak text: `text-xs font-semibold` (12px, semibold)

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background: 210 33% 97%` (ice white) | Page background, main surfaces |
| Secondary (30%) | `--card: 0 0% 100%` / `--secondary: 150 18% 93%` | Cards, sidebar, nav backgrounds |
| Accent (10%) | `--brand-primary: 168 46% 33%` (teal) | Active nav items, CTAs, brand elements |
| Destructive | `--danger: 0 60% 58%` (muted red) | Error states only |
| Warning (DevBanner) | `--amber: 38 72% 50%` / `--amber-soft` | Dev mode indicator banner only |

Accent reserved for: active navigation items, primary buttons, progress indicators, XP/level badges, brand logo background

### DevBanner Color Specification

The DevBanner uses the existing amber semantic token (not a new color):

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Banner background | `bg-amber-soft` with `border border-amber/20` | Same token (auto-adjusts to 0.15 opacity) |
| Banner text | `text-amber` (HSL 38 72% 50%) | `text-amber` (HSL 38 72% 60%, auto-adjusts) |

This follows the exact same pattern as the existing Streak card in Sidebar (lines 70-77 of Sidebar.tsx).

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | N/A -- no CTAs in this phase |
| Empty state heading | N/A -- no new empty states |
| Empty state body | N/A |
| Error state | "Algo deu errado. Tente recarregar a pagina." -- shown when Supabase calls fail in dev mode (graceful degradation per D-02) |
| DevBanner text | "Dev mode -- some features unavailable (no Supabase connection)" -- per D-03 |
| Destructive confirmation | N/A -- no destructive actions |

### DevBanner Details

- **Text:** "Dev mode -- some features unavailable (no Supabase connection)"
- **Visibility logic:** Show only when `import.meta.env.DEV && (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY)`
- **Placement:** Inside Layout.tsx, rendered above the Header component
- **Behavior:** Static banner, no dismiss action, always visible when condition is true

---

## Component Inventory

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| DevBanner | `src/components/layout/DevBanner.tsx` | Dev mode indicator banner |

### Modified Components

| Component | Location | Change |
|-----------|----------|--------|
| Layout | `src/components/layout/Layout.tsx` | Add `<DevBanner />` above Header |
| ProtectedApp | `src/App.tsx` | Remove dev-mode early return, let it fall through to normal Layout path |
| AuthContext | `src/contexts/AuthContext.tsx` | Inject mock user/profile/gamification in dev mode |

### Existing Components (Unchanged)

| Component | Location | Notes |
|-----------|----------|-------|
| Sidebar | `src/components/layout/Sidebar.tsx` | Renders with mock gamification data from runtime state |
| Header | `src/components/layout/Header.tsx` | Renders with mock gamification data from runtime state |
| Navigation | `src/components/layout/Navigation.tsx` | Mobile bottom nav, unchanged |

---

## DevBanner Visual Specification

```
+------------------------------------------------------------------+
| Dev mode -- some features unavailable (no Supabase connection)    |
+------------------------------------------------------------------+
|  [Header]                                                         |
|  ...                                                              |
```

- **Height:** Auto (text + padding: `py-1.5 px-4`)
- **Font:** `text-xs font-medium` (12px, weight 500)
- **Alignment:** `text-center`
- **Background:** `bg-amber-soft` with border (matches Streak card pattern)
- **Text color:** `text-amber`
- **Border radius:** none (full-width banner, flush with edges)
- **z-index:** None needed (sits above content but below Header's z-50)

### DevBanner Component Structure

```tsx
<div className="bg-amber-soft text-amber text-center text-xs py-1.5 px-4 font-medium">
  Dev mode -- some features unavailable (no Supabase connection)
</div>
```

No border-bottom needed -- Header already has `border-b border-secondary`.

---

## Interaction States

### DevBanner
- **Default:** Visible, static, no interaction
- **Light mode:** Light amber background, dark amber text
- **Dark mode:** Dark amber background (via --amber-soft dark token), light amber text

### Mock User in Sidebar/Header
- **Gamification display:** Shows mock XP (e.g., 1250), Level 5, Streak 7 days
- **Level indicator:** "NIVEL 5" in sidebar, "LEVEL 5" in mobile header
- **Streak card:** Shows "7 dias seguidos!" with flame icon (existing pattern)

### Error Handling in Dev Mode Pages
- Pages that call Supabase APIs will fail gracefully
- Each page should show a friendly error message (not crash/whitescreen)
- User can navigate away using sidebar/mobile nav
- Error message: Portuguese, informal tone matching app's language

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not applicable -- no new packages in this phase |

No third-party registries. No new npm packages. Phase is purely code/config changes to existing React components.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
