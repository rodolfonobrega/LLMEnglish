---
phase: 2
slug: error-boundaries
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-02
---

# Phase 2 -- UI Design Contract

> Visual and interaction contract for the Error Boundaries phase. Introduces three error fallback components (ErrorFallback, AppErrorFallback, ChunkErrorFallback) that display friendly error states instead of whitescreens. All components use existing design tokens.

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

Inherited from Phase 1 UI-SPEC (8-point grid):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding |
| sm | 8px | Compact element spacing |
| md | 16px | Default element spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

Exceptions: none

### Error Fallback Spacing Specification

| Element | Value | Token |
|---------|-------|-------|
| Container vertical padding | 64px (`py-16`) | 3xl |
| Container horizontal padding | 16px (`px-4`) | md |
| Element gaps between sections | 16px (`space-y-4`) | md |
| Icon-to-heading gap | 8px (`space-y-2`) | sm |
| Button icon gap | 8px (`gap-2`) | sm |
| Navigation hint top margin | 16px (from space-y-4) | md |

---

## Typography

Inherited from Phase 1 UI-SPEC. Error fallbacks use a subset:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 (normal) | default (~1.5) |
| Heading | 20px (`text-xl`) | 700 (`font-bold`) | default |
| Display (app-level) | 24px (`text-2xl`) | 700 (`font-bold`) | default |
| Caption (navigation hint) | 12px (`text-xs`) | 400 (normal) | default |

### Error Fallback Typography Usage

| Component | Heading | Body | Caption |
|-----------|---------|------|---------|
| ErrorFallback (route-level) | `text-xl font-bold` | `text-sm` via `text-muted-foreground` | `text-xs text-muted-foreground` |
| AppErrorFallback (app-level) | `text-2xl font-bold` | `text-muted-foreground` (default size) | none (no navigation hint) |
| ChunkErrorFallback (chunk-load) | `text-xl font-bold` | `text-sm` via `text-muted-foreground` | `text-xs text-muted-foreground` |

---

## Color

Inherited from Phase 1 UI-SPEC. Error fallbacks use the danger semantic tokens:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background: 210 33% 97%` | Page background (app-level fallback fills screen) |
| Secondary (30%) | `--card: 0 0% 100%` | Not used in error fallbacks (inline display inside Layout) |
| Accent (10%) | `--accent: 168 34% 45%` | Retry button background |
| Destructive | `--danger: 0 60% 58%` | Error icon color only |
| Destructive soft | `--danger-soft: 0 60% 58% / 0.1` | Icon background circle |

Accent reserved for: retry button (primary CTA in error state)

### Error Fallback Color Specification

| Element | Light Mode | Dark Mode | Token |
|---------|-----------|-----------|-------|
| Icon circle background | `--danger-soft` (10% opacity red) | `--danger-soft` (20% opacity red) | `bg-[var(--danger-soft)]` |
| Icon (AlertTriangle) | `--danger` (muted red) | `--danger` (lighter muted red) | `text-danger` |
| Heading text | `--foreground` (dark navy) | `--foreground` (light slate) | `text-foreground` |
| Body/error message text | `--muted-foreground` (slate) | `--muted-foreground` (lighter slate) | `text-muted-foreground` |
| Retry button background | `--accent` (teal) | `--accent` (muted teal) | Button default variant |
| Retry button text | `--accent-foreground` (white) | `--accent-foreground` | Button default variant |
| Caption text | `--muted-foreground` | `--muted-foreground` | `text-muted-foreground` |
| App-level full background | `--background` (ice white) | `--background` (dark) | `bg-background` |

---

## Copywriting Contract

All copy in Portuguese (matching existing app language per RESEARCH.md open question 3).

| Element | Copy |
|---------|------|
| Route-level heading | "Algo deu errado" |
| Route-level CTA | "Tentar novamente" (verb + noun -- retry action) |
| Route-level caption | "Use a barra lateral para navegar para outra pagina" |
| App-level heading | "Erro inesperado" |
| App-level CTA | "Recarregar pagina" (verb + noun -- reload action) |
| Chunk-level heading | "Falha ao carregar" |
| Chunk-level body | "Nao foi possivel carregar esta pagina. Verifique sua conexao." |
| Chunk-level CTA | "Tentar novamente" |
| Chunk-level caption | "Use a barra lateral para navegar para outra pagina" |

### Copywriting Rules

1. Headings are short (2-3 words), describe the situation
2. CTAs start with an imperative verb ("Tentar", "Recarregar")
3. Error message body shows `error.message` if available, otherwise "Algo deu errado"
4. Technical error details go in `console.error` only (not visible to user)
5. Navigation hint shown only in route-level and chunk-level fallbacks (sidebar is available)
6. App-level fallback has NO navigation hint (entire app is down, only reload works)

---

## Component Inventory

### New Components

| Component | Location | Purpose | Boundary Layer |
|-----------|----------|---------|----------------|
| ErrorFallback | `src/components/errors/ErrorFallback.tsx` | Route-level error display inside Layout | Layer 2 (route-level) |
| AppErrorFallback | `src/components/errors/AppErrorFallback.tsx` | Full-page error when entire app crashes | Layer 1 (app-level) |
| ChunkErrorFallback | `src/components/errors/ChunkErrorFallback.tsx` | Chunk-load failure with retry | Layer 3 (Phase 3 prep) |

### Modified Components

| Component | Location | Change |
|-----------|----------|--------|
| App | `src/App.tsx` | Wrap BrowserRouter with ErrorBoundary + AppErrorFallback; add errorElement to all Route definitions |

### Existing Components (Unchanged)

| Component | Location | Notes |
|-----------|----------|--------|
| ErrorDashboard | `src/components/errors/ErrorDashboard.tsx` | Learning analytics page -- not an error boundary fallback |
| Layout | `src/components/layout/Layout.tsx` | Unchanged -- route-level errorElement preserves Layout automatically |
| Sidebar | `src/components/layout/Sidebar.tsx` | Remains interactive when route-level error displays |
| Button | `src/components/ui/Button.tsx` | Used for retry CTA in ErrorFallback |

---

## Visual Specifications

### ErrorFallback (Route-Level)

Renders inside `<Outlet />` within Layout. Sidebar and header remain visible and interactive.

```
+----------------------------------------------------------+
|  [Sidebar]  |  [Header]                                   |
|             |                                             |
|             |        (64px top padding)                    |
|             |        [! AlertTriangle in red circle]       |
|             |             64x64px                          |
|             |                                             |
|             |        "Algo deu errado"                     |
|             |         text-xl font-bold                    |
|             |                                             |
|             |   "error.message or default text"            |
|             |      text-muted-foreground max-w-sm          |
|             |                                             |
|             |     [RefreshCw] Tentar novamente             |
|             |       Button default variant                 |
|             |                                             |
|             |  "Use a barra lateral para navegar           |
|             |   para outra pagina"                         |
|             |      text-xs text-muted-foreground           |
|             |                                             |
+----------------------------------------------------------+
```

- **Layout:** `flex flex-col items-center justify-center py-16 px-4 text-center space-y-4`
- **Icon container:** `size-16 bg-[var(--danger-soft)] rounded-full flex items-center justify-center`
- **Icon:** `AlertTriangle` from lucide-react, `size={32}`, `text-danger`
- **Heading:** `text-xl font-bold text-foreground`
- **Body:** `text-muted-foreground max-w-sm`
- **Button:** Uses existing `Button` component, default variant, `gap-2 cursor-pointer`, icon `RefreshCw size={16}`
- **Caption:** `text-xs text-muted-foreground`

### AppErrorFallback (App-Level)

Full-page display. No sidebar, no Layout. Fills entire viewport.

```
+----------------------------------------------------------+
|                                                          |
|                                                          |
|              [! AlertTriangle in red circle]              |
|                   64x64px                                 |
|                                                          |
|              "Erro inesperado"                            |
|              text-2xl font-bold                           |
|                                                          |
|           "error.message or default text"                 |
|           text-muted-foreground max-w-sm                  |
|                                                          |
|          [RefreshCw] Recarregar pagina                   |
|           inline-flex button, accent color               |
|                                                          |
|                                                          |
+----------------------------------------------------------+
```

- **Layout:** `min-h-screen bg-background flex items-center justify-center p-4`
- **Inner container:** `text-center space-y-4 max-w-sm`
- **Icon container:** Same as route-level but with `mx-auto`
- **Icon:** `AlertTriangle`, `size={32}`, `text-danger`
- **Heading:** `text-2xl font-bold text-foreground`
- **Body:** `text-muted-foreground`
- **Button:** Raw `<button>` (NOT Button component -- must be zero-dependency in case UI lib itself caused the crash), `inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/80 cursor-pointer`
- **No navigation hint** -- entire app is down, only reload works

### ChunkErrorFallback (Phase 3 Preparation)

Same visual structure as ErrorFallback but with chunk-specific copy and retry logic.

```
(Same layout as ErrorFallback but different copy)

- Heading: "Falha ao carregar"
- Body: "Nao foi possivel carregar esta pagina. Verifique sua conexao."
- CTA: "Tentar novamente"
- Caption: Same navigation hint
```

- **Layout:** Same as ErrorFallback
- **Icon:** Same AlertTriangle pattern
- **Retry action:** Calls `resetErrorBoundary()` from react-error-boundary props (not `window.location.reload()`)
- **Created in Phase 2, integrated with lazy routes in Phase 3**

---

## Interaction States

### ErrorFallback (Route-Level)

| State | Behavior |
|-------|----------|
| Initial display | Component renders with error message from `useRouteError()` |
| Click "Tentar novamente" | `window.location.reload()` -- full page reload |
| Click sidebar nav item | Normal navigation -- error state disappears, new page loads |
| Light/Dark mode | All colors auto-adjust via CSS custom properties |

### AppErrorFallback (App-Level)

| State | Behavior |
|-------|----------|
| Initial display | Full-page error with error message |
| Click "Recarregar pagina" | `window.location.reload()` -- full page reload |
| No other navigation possible | Entire React tree is down |

### ChunkErrorFallback (Chunk-Load)

| State | Behavior |
|-------|----------|
| Initial display | Chunk-specific error message |
| Click "Tentar novamente" | `resetErrorBoundary()` -- re-attempts chunk load without full reload |
| Click sidebar nav item | Normal navigation away -- `resetKeys=[location.pathname]` triggers reset |
| Network offline | Same error state -- retry attempts chunk load again |

---

## Error Message Fallback Logic

```
if (error instanceof Error)
  display error.message
else
  display "Algo deu errado"
```

For chunk errors (Phase 3), error detection:
```
if error.message includes "Loading chunk" or "Loading CSS chunk"
   or "dynamically imported module"
   or error.name === "ChunkLoadError"
  use ChunkErrorFallback
else
  use ErrorFallback
```

---

## Constraints

1. **Fallback components must be minimal** -- no data fetching, no hooks with side effects, no complex logic. They must not crash themselves.
2. **AppErrorFallback must NOT import Button component** -- uses raw `<button>` because the UI library itself may have caused the crash.
3. **ErrorFallback CAN import Button** -- it renders inside Layout which is intact, so Button is safe.
4. **All errors logged to console.error** with prefix `[RouteErrorBoundary]` or `[AppErrorBoundary]` for debugging.
5. **No hardcoded colors** -- all colors via CSS custom properties (`--danger`, `--danger-soft`, `--foreground`, etc.).
6. **Portuguese UI text** -- matches app language. Technical error details stay in developer console only.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| npm (react-error-boundary) | 6.1.1 | npm package -- not a shadcn registry; standard dependency |

No third-party shadcn registries. One new npm dependency: `react-error-boundary` (2KB, zero config, no network access, no env variable access).

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
