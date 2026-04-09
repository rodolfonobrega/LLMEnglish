---
phase: 09-model-catalog
plan: 01
subsystem: services
tags: [model-catalog, source-resolution, tdd]
dependency_graph:
  requires: [src/types/settings.ts]
  provides: [src/services/modelCatalog.ts]
  affects: [src/services/openai.ts]
tech_stack:
  added: []
  patterns: [Map<string, Set<Source>> catalog, catalog-first with heuristic fallback]
key_files:
  created:
    - src/services/modelCatalog.ts
    - src/services/modelCatalog.test.ts
  modified:
    - src/services/openai.ts
    - src/services/openai.test.ts
decisions:
  - D-01: Module-level Map catalog populated from all 5 model arrays
  - D-02: resolveSource uses catalog-first, heuristic fallback for unknown models
  - D-03: detectSource heuristic preserved as private tiebreaker for multi-source models
  - D-04: registerModels called for all 5 arrays (CHAT, STT, TTS, IMAGE, LIVE)
metrics:
  duration: 15min
  completed: "2026-04-08"
  tasks: 2
  files: 4
  tests_added: 14
  tests_total: 146
---

# Phase 09 Plan 01: Model Catalog Module Summary

Deterministic model catalog with Map<string, Set<Source>> built from 5 model arrays, replacing fragile prefix-matching with catalog-first resolution and heuristic fallback for unknown models.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create modelCatalog module with tests | 6ab67bd (RED), 1b97d53 (GREEN) | src/services/modelCatalog.ts, src/services/modelCatalog.test.ts |
| 2 | Wire openai.ts to use catalog-first resolveSource | 1a9c2ff | src/services/openai.ts, src/services/openai.test.ts |

## Key Decisions

1. **Catalog as Map<string, Set<Source>>** -- Allows O(1) lookup by model ID with all registered sources. Multi-source models (e.g., gemini-3.1-pro-preview under both genai and vertex) correctly map to a Set of both sources.

2. **resolveSource strategy** -- Catalog-first: single source returns directly; multiple sources use heuristic tiebreaker; unknown models fall back to heuristic entirely. Zero behavioral change for all known models.

3. **detectSource preserved as private** -- The heuristic function was moved byte-for-byte from openai.ts to modelCatalog.ts where it serves as the tiebreaker/fallback. openai.ts no longer contains any source detection logic.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx vitest run src/services/modelCatalog.test.ts` -- 12/12 passed
- `npx vitest run src/services/openai.test.ts` -- 12/12 passed
- `npx vitest run` (full suite) -- 14 files, 146/146 passed, zero regressions

## Commits

- `6ab67bd` test(09-01): add failing tests for modelCatalog module
- `1b97d53` feat(09-01): implement modelCatalog module with catalog-first resolution
- `1a9c2ff` feat(09-01): wire openai.ts to use catalog-first resolveSource

## Self-Check: PASSED

All files and commits verified present.
