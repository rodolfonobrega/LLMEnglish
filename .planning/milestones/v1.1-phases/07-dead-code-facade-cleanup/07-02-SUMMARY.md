---
phase: 07
plan: 02
subsystem: storage-facade
tags: [facade, dead-code, settings, async]
dependency_graph:
  requires: ["07-01-PLAN"]
  provides: ["facade-async-fetch"]
  affects: ["src/services/storage.ts", "src/components/settings/SettingsPage.tsx"]
tech_stack:
  added: ["async fetch passthrough pattern"]
  patterns: ["fetch* prefix for async server reads vs sync cache reads"]
key_files:
  created: []
  modified:
    - src/services/storage.ts
    - src/components/settings/SettingsPage.tsx
decisions:
  - "fetch* prefix distinguishes async server reads from sync cache reads"
  - "Dev-mode guard returns cached runtimeState values (same as getApiKey pattern)"
metrics:
  duration: 3min
  completed: "2026-04-07"
---

# Phase 07 Plan 02: Settings Facade Cleanup Summary

SettingsPage routed exclusively through storage facade via async fetchModelConfig/fetchConversationTone passthrough functions, eliminating stale cache reads on mount.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add async passthrough functions to storage facade | d0ba4d5 | src/services/storage.ts |
| 2 | Replace SettingsPage sync calls with async fetch | 713c1f7 | src/components/settings/SettingsPage.tsx |

## Changes Made

### Task 1: Async passthrough functions in facade
- Added `fetchModelConfig()` and `fetchConversationTone()` async functions to `src/services/storage.ts`
- Both use dev-mode guard returning cached runtimeState values
- Imported `getModelConfig` and `getConversationTone` from `./supabase/storage` with aliased names
- Follows existing pattern established by `getApiKey()` (lines 275-278)

### Task 2: SettingsPage migrated to facade-only imports
- Replaced sync `getModelConfig`/`getConversationTone` imports with async `fetchModelConfig`/`fetchConversationTone`
- Settings page now fetches fresh config from Supabase server on mount (not stale cache)
- Single import source: `../../services/storage` only
- Zero direct `supabase/storage` references in SettingsPage

## Deviations from Plan

### Adjusted Implementation

**1. [Deviation] Task 2 implementation differed from plan description**
- **Found during:** Task 2 analysis
- **Issue:** Plan described removing a dual-import pattern (facade + direct supabase/storage import) from SettingsPage, but the file only had facade imports. The sync cache reads were the actual issue, not dual imports.
- **Fix:** Changed approach from "remove dual import" to "upgrade sync calls to async fetch calls". Same end goal achieved -- SettingsPage uses facade exclusively and fetches fresh data from server.
- **Files modified:** src/components/settings/SettingsPage.tsx
- **Commit:** 713c1f7

## Verification

1. `fetchModelConfig` and `fetchConversationTone` exist in facade with dev-mode guards
2. SettingsPage imports from `../../services/storage` only
3. Zero references to `supabase/storage` in SettingsPage
4. Zero references to old `supabaseGetModelConfig`/`supabaseGetConversationTone` aliases
5. Existing sync `getModelConfig()` and `getConversationTone()` unchanged in facade

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/services/storage.ts
- FOUND: src/components/settings/SettingsPage.tsx
- FOUND: 07-02-SUMMARY.md
- FOUND: d0ba4d5 (feat(07-02): add async fetch passthrough functions to storage facade)
- FOUND: 713c1f7 (feat(07-02): migrate SettingsPage to async fetch via storage facade)
