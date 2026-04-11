---
phase: 17-retry-exercise
plan: "02"
subsystem: live-roleplay
tags: [retry, ux, conversation-analysis, live-roleplay]
dependency_graph:
  requires: []
  provides: [retry-same-scenario-live-roleplay]
  affects: [src/components/live-roleplay/LiveRoleplayPage.tsx, src/components/live-roleplay/ConversationAnalysis.tsx]
tech_stack:
  added: []
  patterns: [prop-drilling, callback-pattern, vertical-button-group]
key_files:
  modified:
    - src/components/live-roleplay/LiveRoleplayPage.tsx
    - src/components/live-roleplay/ConversationAnalysis.tsx
decisions:
  - "onRetry passed as optional prop to ConversationAnalysis — preserves backward compatibility for callers that don't need retry"
  - "3-button vertical layout (space-y-2) matches ExerciseMode/ImageMode retry pattern from plan 01"
  - "Pre-existing test failures in audioCache, images, errorAnalysis, aiProxy, supabase/storage are out-of-scope and unrelated to this plan"
metrics:
  duration: "~5min"
  completed: "2026-04-11"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 2
requirements: [RETRY-05, RETRY-06, RETRY-07]
---

# Phase 17 Plan 02: Add Retry-Same-Scenario to Live Roleplay — Summary

**One-liner:** `handleRetryScenario` callback preserves scenario state and re-enters conversation phase; ConversationAnalysis gains `onRetry` prop and a 3-button action bar (Tentar Novamente / Novo Cenario / Ver Historico).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add retry-same-scenario to LiveRoleplayPage and ConversationAnalysis | dd6f63c | LiveRoleplayPage.tsx, ConversationAnalysis.tsx |

## What Was Built

### LiveRoleplayPage.tsx

Added `handleRetryScenario` after `handleExit`:

```typescript
const handleRetryScenario = () => {
  setTurns([]);
  setPhase('conversation');
  // Keep scenario intact — re-enters LiveSession with same scenario
};
```

Passed `onRetry={handleRetryScenario}` to `ConversationAnalysis` in the analysis phase JSX.

### ConversationAnalysis.tsx

- Added `onRetry?: () => void` to `ConversationAnalysisProps` interface
- Destructured `onRetry` in function signature
- Replaced 2-button side-by-side layout with 3-button vertical stack:
  - "Tentar Novamente" (primary, RotateCcw) — calls `onRetry`, retries same scenario
  - "Novo Cenario" (secondary, Sparkles) — calls `onReset`, goes to scenario setup
  - "Ver Historico" (ghost, Clock) — navigates to `/history`

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -c "handleRetryScenario" LiveRoleplayPage.tsx` → 2 (definition + usage)
- `grep -c "onRetry" ConversationAnalysis.tsx` → 3 (interface, destructure, usage)
- `grep -c "Tentar Novamente" ConversationAnalysis.tsx` → 2 (error state + action button)
- `grep -c "Novo Cenario" ConversationAnalysis.tsx` → 1
- `grep -c "Ver Historico" ConversationAnalysis.tsx` → 1
- "Nova Conversa" not found in ConversationAnalysis.tsx
- `tsc --noEmit` → passes with no errors
- `vitest run` → 172 tests pass; 14 pre-existing failures in unrelated files (audioCache, images, errorAnalysis, aiProxy, supabase/storage)

## Known Stubs

None.

## Threat Flags

None — changes are internal prop drilling and local state transitions with no new network endpoints, auth paths, or trust boundary crossings.

## Self-Check: PASSED

- [x] `src/components/live-roleplay/LiveRoleplayPage.tsx` — FOUND, contains `handleRetryScenario` and `onRetry={handleRetryScenario}`
- [x] `src/components/live-roleplay/ConversationAnalysis.tsx` — FOUND, contains `onRetry` prop, "Tentar Novamente", "Novo Cenario", "Ver Historico"
- [x] Commit `dd6f63c` — FOUND
- [x] TypeScript compiles without errors
- [x] Test suite: 172 passing; 14 pre-existing failures unrelated to this plan
