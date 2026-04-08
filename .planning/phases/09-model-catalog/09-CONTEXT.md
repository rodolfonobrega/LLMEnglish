# Phase 9: Model Catalog - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the fragile `detectSource()` prefix-matching heuristic in `openai.ts` with an explicit model catalog built from existing `ModelOption[]` arrays. The catalog resolves model IDs to valid sources, with heuristic fallback for unknown models and a Settings UI warning for unrecognized model+source combos.

**Scope:**
- New `modelCatalog.ts` module in `src/services/`
- Modify `openai.ts` to use catalog lookup instead of `detectSource()`
- Add warning indicator in `SettingsPage.tsx` for unknown model+source combos
- Update existing tests in `openai.test.ts`

**Not in scope:** Adding new models, changing model arrays, modifying Edge Function proxy logic, changing `ModelConfig` shape.
</domain>

<decisions>
## Implementation Decisions

### Catalog Data Structure
- **D-01:** Catalog uses `Map<string, Set<Source>>` — each model ID maps to the set of all valid sources. This handles duplicate model IDs across sources correctly (e.g., `gemini-3.1-pro-preview` maps to `{genai, vertex}`). Lookup checks if the requested source is in the set.

### Settings Warning UX
- **D-02:** Warning = inline yellow triangle icon (`AlertTriangle` from lucide-react) + tooltip next to the model dropdown, shown on page load when saved config has a model+source combo not in the catalog. Non-blocking, purely informational. Tooltip text: "This model may not be recognized by the app."

### Heuristic Fallback
- **D-03:** Keep the existing `detectSource()` prefix-matching logic unchanged as a fallback after catalog miss. The new `resolveSource()` function tries catalog first, then falls back to the heuristic. Zero regression risk for user-saved custom models.

### Catalog Structure
- **D-04:** Single merged catalog built from all 5 `ModelOption[]` arrays (`CHAT_MODELS`, `STT_MODELS`, `TTS_MODELS`, `IMAGE_MODELS`, `LIVE_MODELS`). One import, one `Map`, one API. ~100 entries total.

### Claude's Discretion
- Exact function signature for the public catalog API (e.g., `isKnownModel(modelId, source): boolean` vs `resolveSource(modelId): Source | undefined`)
- Whether to export the `Map` directly or wrap it in accessor functions
- Test organization for the new catalog module

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Model Catalog (MC) — MC-01 through MC-04 requirements

### Source files to modify
- `src/services/openai.ts` — contains `detectSource()` at line 23, called at lines 49 and 80
- `src/components/settings/SettingsPage.tsx` — needs warning badge for unknown model+source combos

### Source files to create
- `src/services/modelCatalog.ts` — new catalog module (MC-01)

### Source files to reference
- `src/types/settings.ts` — defines `Source`, `ModelOption`, and all 5 model arrays (CHAT_MODELS, STT_MODELS, TTS_MODELS, IMAGE_MODELS, LIVE_MODELS)
- `src/services/openai.test.ts` — existing tests for `detectSource()` at lines 158, 172, 186

### Project context
- `.planning/ROADMAP.md` §Phase 9 — success criteria and dependencies
- `.planning/PROJECT.md` — constraints (no breaking changes, client-side only)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ModelOption` interface in `src/types/settings.ts` — already has `{ value, label, source }` shape, perfect for catalog construction
- `sourcesFromModels()` in `src/types/settings.ts` — extracts unique sources, shows existing pattern of iterating ModelOption arrays
- `lucide-react` icons — already used throughout, `AlertTriangle` available for warning badge

### Established Patterns
- `Source` type is a union: `'genai' | 'vertex' | 'openrouter' | 'openai' | 'groq'`
- 5 model arrays with ~100 entries total; same model ID can appear under multiple sources (e.g., `gemini-3.1-pro-preview` under both `genai` and `vertex`)
- `detectSource()` is a private function in `openai.ts` — only 2 call sites (lines 49, 80), both in chat functions with `modelOverride`
- Settings page uses source-grouped dropdowns for model selection

### Integration Points
- `openai.ts:49` — `chatCompletion()` uses `detectSource(modelOverride)` when model override is provided
- `openai.ts:80` — second chat function uses same pattern
- `SettingsPage.tsx` — loads `ModelConfig` from runtime state, needs to validate each model+source against catalog
- `runtimeState.ts` — stores the active `ModelConfig`, not directly modified but the catalog validates what it holds

### Key Data Points
- Duplicate model IDs across sources: gemini models appear under both `genai` and `vertex` in CHAT, STT, TTS, IMAGE arrays
- Groq models use slash-based IDs (e.g., `meta-llama/llama-4-scout-17b-16e-instruct`) which would collide with OpenRouter's `/` heuristic — catalog resolves this correctly
- 3 existing tests for `detectSource()` in `openai.test.ts` need updating to test the new catalog path

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the requirements (MC-01 through MC-04) are detailed enough to guide implementation. Decisions above clarify the design choices.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 09-model-catalog*
*Context gathered: 2026-04-07*
