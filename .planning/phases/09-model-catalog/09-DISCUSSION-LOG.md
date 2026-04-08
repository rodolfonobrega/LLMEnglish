# Phase 9: Model Catalog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 09-model-catalog
**Areas discussed:** Duplicate model ID handling, Settings warning UX, Heuristic fallback behavior, Catalog structure

---

## Duplicate Model ID Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Set of valid sources | `Map<string, Set<Source>>` — returns all valid sources per model ID. Most precise. | ✓ |
| Compound key lookup | `Map<'modelId\|source', true>` — exact pair check. Simple but caller must always provide both. | |
| First-wins (simplest) | `Map<string, Source>` — first entry wins. Loses information, matches MC-01 literally. | |

**User's choice:** Set of valid sources
**Notes:** Handles the reality that same model ID exists under multiple sources (e.g., genai + vertex). Catalog lookup checks if requested source is in the set.

---

## Settings Warning UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline icon + tooltip | Yellow triangle icon next to dropdown with tooltip. Subtle, non-blocking. | ✓ |
| Banner below dropdown | Yellow banner with explanatory text. More visible, takes space. | |
| Muted helper text | Small text below dropdown. Minimal but easy to miss. | |

**User's choice:** Inline icon + tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| On page load for saved configs | Warning appears when loaded config has unknown model+source. Non-blocking. | ✓ |
| Only on new selection | Warning only on active selection. Misses saved unknown models. | |
| Both load and selection | Most comprehensive but potentially noisy. | |

**User's choice:** On page load for saved configs
**Notes:** Non-blocking, purely informational. Tooltip text: "This model may not be recognized by the app."

---

## Heuristic Fallback Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep detectSource as-is | Preserve current prefix-matching logic unchanged. Zero regression risk. | ✓ |
| Keep + log warning | Same logic with console.warn on catalog miss. Visible in dev tools. | |
| Simplified heuristic | Remove Groq-specific prefixes since all Groq models are in catalog. | |

**User's choice:** Keep detectSource as-is
**Notes:** New `resolveSource()` tries catalog first, falls back to existing heuristic. Zero regression risk for custom models.

---

## Catalog Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single merged catalog | One `Map<string, Set<Source>>` from all 5 arrays. Simpler API. | ✓ |
| Per-type catalogs | Separate maps per model type. More precise but complex API. | |

**User's choice:** Single merged catalog
**Notes:** ~100 entries total across 5 arrays. One import, one Map, one API.

---

## Claude's Discretion

- Exact catalog API function signatures
- Whether to export Map directly or wrap in accessors
- Test organization for the new catalog module

## Deferred Ideas

None — discussion stayed within phase scope.
