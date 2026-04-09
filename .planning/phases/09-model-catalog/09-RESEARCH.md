# Phase 9: Model Catalog - Research

**Researched:** 2026-04-07
**Domain:** Model-to-source resolution via explicit catalog
**Confidence:** HIGH

## Summary

Phase 9 replaces the fragile `detectSource()` prefix-matching heuristic in `openai.ts` with an explicit model catalog built from the existing 97 `ModelOption` entries across 5 arrays in `settings.ts`. The catalog uses a `Map<string, Set<Source>>` data structure (per locked decision D-01) to handle duplicate model IDs across sources correctly.

The existing `detectSource()` function at `openai.ts:23` has only 2 call sites (lines 49, 80) and 3 test cases, making it a well-contained refactor. The heuristic will be preserved as a fallback (D-03) to avoid regressions for user-saved custom models not in the catalog.

The Settings UI warning (MC-04) will use an inline `AlertTriangle` icon from lucide-react with a tooltip using the existing `Tooltip` component in `src/components/ui/Tooltip.tsx`.

**Primary recommendation:** Build the catalog as a module-level `Map` constructed from all 5 `ModelOption[]` arrays at import time, wrap it in accessor functions (`resolveSource`, `isKnownModel`), and modify `detectSource` to try catalog-first then heuristic fallback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Catalog uses `Map<string, Set<Source>>` -- each model ID maps to the set of all valid sources. Lookup checks if the requested source is in the set.
- **D-02:** Warning = inline yellow triangle icon (`AlertTriangle` from lucide-react) + tooltip next to the model dropdown, shown on page load when saved config has a model+source combo not in the catalog. Non-blocking, purely informational. Tooltip text: "This model may not be recognized by the app."
- **D-03:** Keep existing `detectSource()` prefix-matching logic unchanged as fallback after catalog miss. `resolveSource()` tries catalog first, then heuristic.
- **D-04:** Single merged catalog built from all 5 `ModelOption[]` arrays (`CHAT_MODELS`, `STT_MODELS`, `TTS_MODELS`, `IMAGE_MODELS`, `LIVE_MODELS`). One import, one `Map`, one API.

### Claude's Discretion
- Exact function signature for the public catalog API (e.g., `isKnownModel(modelId, source): boolean` vs `resolveSource(modelId): Source | undefined`)
- Whether to export the `Map` directly or wrap it in accessor functions
- Test organization for the new catalog module

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MC-01 | New `modelCatalog.ts` builds a `Map<string, Source>` from existing `ModelOption[]` arrays in `settings.ts` (105 models across 5 arrays) | 97 verified ModelOption entries across CHAT/STT/TTS/IMAGE/LIVE arrays; `Map<string, Set<Source>>` structure per D-01; duplicate model IDs exist (e.g., `gemini-3.1-pro-preview` maps to `{genai, vertex}`) |
| MC-02 | `detectSource()` in `openai.ts` is replaced with catalog lookup function | `detectSource()` is a private function at line 23 with exactly 2 call sites (lines 49, 80); 3 existing tests at lines 158, 172, 186 need updating |
| MC-03 | Heuristic fallback preserved for model IDs not in the catalog | Existing `detectSource()` logic preserved as-is per D-03; new `resolveSource()` tries catalog first, falls back to heuristic |
| MC-04 | Settings UI validates model+source combinations using the catalog, showing a warning for unknown combinations | `SettingsPage.tsx` has 5 `ModelSelect` sections; existing `Tooltip` component at `src/components/ui/Tooltip.tsx` (Radix-based); `AlertTriangle` available from lucide-react but not yet imported |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (no new deps) | -- | -- | Phase uses existing project dependencies only |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | 0.563 | `AlertTriangle` icon for warning badge | MC-04 Settings UI warning |
| `@radix-ui/react-tooltip` | 1.2 | Tooltip for warning text | Already wrapped in `src/components/ui/Tooltip.tsx` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline AlertTriangle | Toast notification | Toast is intrusive; inline icon matches D-02 decision for non-blocking warning |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
src/services/
  modelCatalog.ts    # New: catalog Map + accessor functions
  openai.ts          # Modified: uses catalog lookup with heuristic fallback
src/components/settings/
  SettingsPage.tsx   # Modified: warning badge on model dropdowns
src/types/settings.ts  # Unchanged: source of ModelOption arrays
```

### Pattern 1: Module-level Singleton Map
**What:** Build the catalog `Map<string, Set<Source>>` once at module import time from the 5 `ModelOption[]` arrays.
**When to use:** For any static lookup table derived from config data that doesn't change at runtime.
**Example:**
```typescript
// Source: project pattern (similar to sourcesFromModels in settings.ts)
import type { Source, ModelOption } from '../types/settings';
import { CHAT_MODELS, STT_MODELS, TTS_MODELS, IMAGE_MODELS, LIVE_MODELS } from '../types/settings';

const catalog = new Map<string, Set<Source>>();

function buildCatalog(models: readonly ModelOption[]): void {
  for (const { value, source } of models) {
    const existing = catalog.get(value);
    if (existing) {
      existing.add(source);
    } else {
      catalog.set(value, new Set([source]));
    }
  }
}

buildCatalog(CHAT_MODELS);
buildCatalog(STT_MODELS);
buildCatalog(TTS_MODELS);
buildCatalog(IMAGE_MODELS);
buildCatalog(LIVE_MODELS);
```

### Pattern 2: Catalog-first with Heuristic Fallback
**What:** `resolveSource(modelId)` checks catalog first, falls back to `detectSource()` heuristic.
**When to use:** When replacing a heuristic without breaking existing custom model support.
**Example:**
```typescript
// resolveSource tries catalog, then heuristic
export function resolveSource(modelId: string): Source {
  const sources = catalog.get(modelId);
  if (sources && sources.size === 1) {
    return [...sources][0];
  }
  if (sources && sources.size > 1) {
    // Ambiguous -- multiple sources. Return heuristic as tiebreaker.
    return detectSource(modelId);
  }
  // Not in catalog -- use heuristic for custom models
  return detectSource(modelId);
}

export function isKnownModel(modelId: string, source: Source): boolean {
  return catalog.get(modelId)?.has(source) ?? false;
}
```

### Anti-Patterns to Avoid
- **Exporting the raw Map:** Encourages direct mutation and couples consumers to internal structure. Use accessor functions instead.
- **Removing the heuristic:** Would break custom models saved by users that aren't in the catalog. D-03 explicitly preserves it.
- **Treating multi-source models as errors:** Many gemini models legitimately appear under both `genai` and `vertex`. The `Set<Source>` handles this correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model source resolution | New heuristic rules | Catalog Map from existing data | Data already exists in ModelOption arrays; no need for new pattern matching |
| Multi-value mapping | Object with arrays | `Map<string, Set<Source>>` | Map has O(1) lookup; Set handles dedup naturally |

## Common Pitfalls

### Pitfall 1: Groq models with slashes misidentified as OpenRouter
**What goes wrong:** Groq uses slash-based IDs like `meta-llama/llama-4-scout-17b-16e-instruct` which the heuristic treats as OpenRouter via `modelId.includes('/')`.
**Why it happens:** The heuristic checks Groq prefixes first then falls through to the `/` check, but this ordering is fragile.
**How to avoid:** Catalog lookup resolves this definitively -- each model ID maps to its exact source(s). The catalog entry for `meta-llama/llama-4-scout-17b-16e-instruct` will map to `{groq}`, not `{openrouter}`.
**Warning signs:** A Groq model being routed to OpenRouter proxy, causing auth errors.

### Pitfall 2: Duplicate model IDs with single source assumption
**What goes wrong:** Assuming each model ID has exactly one source, when in reality gemini models appear under both `genai` and `vertex`.
**Why it happens:** 11+ gemini model IDs are duplicated across genai/vertex (e.g., `gemini-3.1-pro-preview`, `gemini-2.5-flash`).
**How to avoid:** Use `Set<Source>` as the map value, not a single `Source`. D-01 already locks this decision.
**Warning signs:** `resolveSource` returning only one source for a model that should map to two.

### Pitfall 3: Warning badge flickering on state updates
**What goes wrong:** Warning badge appears/disappears on each render because the check is computed inline without memoization.
**Why it happens:** `isKnownModel()` called directly in JSX on every render without `useMemo`.
**How to avoid:** Compute unknown-model warnings once when `config` changes using `useMemo` or compute it in the `useEffect` that loads config.
**Warning signs:** Performance warning in React DevTools or visual flicker.

### Pitfall 4: Forgetting to cover all model config slots
**What goes wrong:** Warning badge only checks chat model but not STT/TTS/Image/Live/fallback slots.
**Why it happens:** `ModelConfig` has 10+ model+source slots (5 primary + 3 fallback + sub-variants).
**How to avoid:** Create a helper that checks all slots: chat, stt, tts, image, live, and their fallbacks.
**Warning signs:** User has an unknown TTS model but no warning shows.

## Code Examples

### ModelCatalog module skeleton
```typescript
// src/services/modelCatalog.ts
// Source: project patterns
import type { Source, ModelOption } from '../types/settings';
import { CHAT_MODELS, STT_MODELS, TTS_MODELS, IMAGE_MODELS, LIVE_MODELS } from '../types/settings';

const catalog = new Map<string, Set<Source>>();

function registerModels(models: readonly ModelOption[]): void {
  for (const { value, source } of models) {
    const existing = catalog.get(value);
    if (existing) {
      existing.add(source);
    } else {
      catalog.set(value, new Set([source]));
    }
  }
}

registerModels(CHAT_MODELS);
registerModels(STT_MODELS);
registerModels(TTS_MODELS);
registerModels(IMAGE_MODELS);
registerModels(LIVE_MODELS);

/** Check if a model+source combination is in the catalog. */
export function isKnownModel(modelId: string, source: Source): boolean {
  return catalog.get(modelId)?.has(source) ?? false;
}

/** Get all valid sources for a model ID, or undefined if unknown. */
export function getSourcesForModel(modelId: string): Set<Source> | undefined {
  return catalog.get(modelId);
}
```

### SettingsPage warning badge pattern
```typescript
// Inside ModelSelect component or next to it
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../ui/Tooltip';
import { isKnownModel } from '../../services/modelCatalog';

// In render, after the ModelSelect dropdowns:
{!isKnownModel(currentModel, currentSource) && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle size={14} className="text-amber-500 inline-block ml-1" />
      </TooltipTrigger>
      <TooltipContent>This model may not be recognized by the app.</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Heuristic prefix matching | Explicit catalog from data | Phase 9 | Deterministic resolution, no ambiguity for edge cases |

**Deprecated/outdated:**
- `detectSource()` as the sole resolution method: Retained as fallback only, not the primary mechanism.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AlertTriangle` is available from the installed `lucide-react` 0.563 | Standard Stack | Low -- it's a standard lucide icon; verified that lucide-react is at 0.563 in CLAUDE.md |
| A2 | `TooltipProvider` is needed as a wrapper for the tooltip to work | Code Examples | Low -- Radix tooltip requires a Provider; verified from Tooltip.tsx which re-exports Radix primitives |
| A3 | The existing `detectSource()` heuristic handles all current use cases correctly | Pitfalls | Low -- it's in production and working; the catalog just improves correctness for edge cases |

**If this table is empty:** All claims in this research were verified or cited -- no user confirmation needed.

## Open Questions

1. **Should the warning check all 5 model slots or only the primary ones?**
   - What we know: ModelConfig has chat, stt, tts, image, live slots plus 3 fallback slots.
   - What's unclear: Whether to warn on unknown fallback models too.
   - Recommendation: Check all slots (5 primary + 3 fallback) for completeness, but only show warning next to the relevant section's dropdown.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified -- all changes are code/config only within the existing project).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run src/services/openai.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MC-01 | Catalog Map built from 97 ModelOption entries | unit | `npx vitest run src/services/modelCatalog.test.ts` | Wave 0 (new) |
| MC-01 | Duplicate model IDs map to multiple sources | unit | `npx vitest run src/services/modelCatalog.test.ts` | Wave 0 (new) |
| MC-02 | `resolveSource` uses catalog lookup | unit | `npx vitest run src/services/openai.test.ts` | Existing (modify) |
| MC-03 | Unknown model IDs fall back to heuristic | unit | `npx vitest run src/services/openai.test.ts` | Existing (modify) |
| MC-04 | Settings page shows warning for unknown combos | unit | `npx vitest run src/components/settings/SettingsPage.test.tsx` | Wave 0 (new, optional) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/openai.test.ts src/services/modelCatalog.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/services/modelCatalog.test.ts` -- covers MC-01 catalog construction, MC-02 catalog lookup, MC-03 heuristic fallback
- [ ] Update `src/services/openai.test.ts` -- modify 3 existing `detectSource` tests to test `resolveSource` path instead
- [ ] MC-04 (Settings UI warning) can be manually verified if component test setup is too heavy; unit testing the `isKnownModel` function is sufficient for logic coverage

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | yes | Model IDs validated against catalog before routing to proxy |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for React SPA + AI Proxy

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Invalid model ID routing | Tampering | Catalog validates model+source before proxy call |
| Unexpected source resolution | Information Disclosure | Catalog prevents routing to wrong provider |

## Key Data Points

### Verified Model Counts [VERIFIED: codebase grep]
- CHAT_MODELS: 48 entries
- STT_MODELS: 21 entries
- TTS_MODELS: 8 entries
- IMAGE_MODELS: 14 entries
- LIVE_MODELS: 6 entries
- **Total: 97 ModelOption entries** (CONTEXT.md estimated ~105; actual is 97)

### Unique model IDs
- Some model IDs appear under multiple sources (e.g., `gemini-3.1-pro-preview` under genai + vertex)
- The `Map<string, Set<Source>>` structure deduplicates correctly

### detectSource() call graph [VERIFIED: codebase grep]
- Defined: `src/services/openai.ts:23`
- Called at line 49: `chatCompletion()` with `modelOverride`
- Called at line 80: `chatCompletionWithImage()` with `modelOverride`
- No other consumers

### Existing test coverage [VERIFIED: test run]
- 10 tests in `src/services/openai.test.ts`, all passing
- 3 tests specifically for `detectSource` (lines 158, 172, 186)
- Tests cover: gemini prefix, slash-based OpenRouter IDs, slash-based Groq IDs

## Sources

### Primary (HIGH confidence)
- `src/types/settings.ts` -- ModelOption arrays, Source type, 97 entries verified
- `src/services/openai.ts` -- detectSource() implementation, 2 call sites verified
- `src/services/openai.test.ts` -- 3 existing detectSource tests, all 10 tests passing
- `src/components/settings/SettingsPage.tsx` -- 5 ModelSelect sections, no warning UI yet
- `src/components/ui/Tooltip.tsx` -- Radix tooltip wrapper, ready for reuse

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions D-01 through D-04 -- locked by user

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all code already in project
- Architecture: HIGH -- well-contained refactor with 2 call sites, clear catalog pattern
- Pitfalls: HIGH -- edge cases (Groq slashes, multi-source models) verified in codebase

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable -- data-driven catalog, no external API changes expected)
