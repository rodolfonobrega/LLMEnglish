# Phase 3: Code Splitting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 03-code-splitting
**Areas discussed:** Loading indicator style, Splitting scope & granularity, Loading boundary placement

---

## Loading Indicator Style

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton screen | Gray placeholder shapes matching target page layout — feels fast and native | ✓ |
| Centered spinner | Simple spinner centered in content area — minimal effort | |
| Branded loading animation | Custom animation with app branding — polished but more work | |
| You decide | Let Claude pick based on design system | |

**User's choice:** Skeleton screen
**Follow-up:** Generic skeleton for all routes vs per-page custom skeletons?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic skeleton | One skeleton component used for all routes — faster to build, consistent | ✓ |
| Per-page skeletons | Each route gets a skeleton matching its layout — more polished | |
| Hybrid | Generic for most, custom for heavy pages | |

**User's choice:** Generic skeleton

---

## Splitting Scope & Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Routes only | React.lazy() on all 10 page routes. Vite auto-splits. Simplest, biggest impact. | ✓ |
| Routes + heavy vendor chunks | Routes + manualChunks for jspdf and @google/genai | |
| Maximum splitting | Routes + vendors + lazy sub-components within pages | |

**User's choice:** Routes only
**Notes:** motion library confirmed NOT imported anywhere (tree-shaken already). jspdf naturally isolates into PracticePage chunk with route-level splitting. No manualChunks config needed.

---

## Loading Boundary Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Single layout-level boundary | One Suspense around <Outlet/> in Layout. All routes share skeleton. Simplest. | ✓ |
| Per-route Suspense wrappers | Each route gets own Suspense in App.tsx. More boilerplate, minimal gain with generic skeleton. | |

**User's choice:** Single layout-level boundary
**Notes:** ChunkErrorFallback from Phase 2 already handles chunk load failures. Suspense only needs to handle loading state.

---

## Claude's Discretion

- Exact skeleton component design (shape, pulse animation, spacing)
- How to structure lazy imports in App.tsx
- Whether to add a minimum delay before showing skeleton

## Deferred Ideas

None — discussion stayed within phase scope.
