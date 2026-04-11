---
phase: 17-retry-exercise
plan: "02"
subsystem: live-roleplay
tags: [retry, ux, live-roleplay, navigation]
dependency_graph:
  requires: []
  provides: [retry-same-scenario-live-roleplay]
  affects: [LiveRoleplayPage, ConversationAnalysis]
tech_stack:
  added: []
  patterns: [prop-drilling, callback-threading]
key_files:
  created: []
  modified:
    - src/components/live-roleplay/LiveRoleplayPage.tsx
    - src/components/live-roleplay/ConversationAnalysis.tsx
decisions:
  - "Used optional onRetry prop (onRetry?) so ConversationAnalysis remains usable without retry capability"
  - "3-button vertical layout (primary/secondary/ghost) matches ExerciseMode/ImageMode post-analysis UX pattern"
metrics:
  duration: "10m"
  completed: "2026-04-11"
  tasks_completed: 1
  tasks_total: 1
  files_modified: 2
---

# Phase 17 Plan 02: Retry Same Scenario (Live Roleplay) Summary

**One-liner:** Added handleRetryScenario callback to LiveRoleplayPage and onRetry prop + 3-button vertical layout to ConversationAnalysis, enabling retry-same-scenario without re-entering setup.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add retry-same-scenario to LiveRoleplayPage and ConversationAnalysis | 1beae6a | LiveRoleplayPage.tsx, ConversationAnalysis.tsx |

## What Was Built

### LiveRoleplayPage.tsx
- Added `handleRetryScenario` function after `handleExit`
- Function clears turns (`setTurns([])`), sets phase to `'conversation'`, and leaves scenario intact
- Passes `onRetry={handleRetryScenario}` to `ConversationAnalysis`

### ConversationAnalysis.tsx
- Added `onRetry?: () => void` to `ConversationAnalysisProps` interface
- Destructures `onRetry` from props
- Replaced 2-button side-by-side layout (`flex gap-3`) with 3-button vertical stack (`space-y-2`):
  - "Tentar Novamente" (primary, RotateCcw) — calls `onRetry`, retries same scenario
  - "Novo Cenario" (secondary, Sparkles) — calls `onReset`, goes to setup
  - "Ver Historico" (ghost, Clock) — navigates to `/history`
- Removed `className="mr-2"` from icons (Button component already has `gap-2` in base styles)

## Decisions Made

- Used `onRetry?` (optional) so existing callers of `ConversationAnalysis` without retry support don't break
- 3-button vertical layout matches post-exercise UX pattern from ExerciseMode and ImageMode (visual consistency)
- "Nova Conversa" renamed to "Novo Cenario" to better describe the action (new scenario = full setup reset)
- "Historico" renamed to "Ver Historico" for clarity

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `grep -c "handleRetryScenario" LiveRoleplayPage.tsx` → 2 (function definition + prop pass)
- `grep -c "onRetry" ConversationAnalysis.tsx` → 3 (interface, destructure, button usage)
- `grep -c "Tentar Novamente" ConversationAnalysis.tsx` → 2 (button label + error state button)
- `grep -c "Novo Cenario" ConversationAnalysis.tsx` → 1
- `grep -c "Ver Historico" ConversationAnalysis.tsx` → 1
- `grep "Nova Conversa" ConversationAnalysis.tsx` → no output (removed)
- `npx tsc --noEmit` → clean (no errors)
- Pre-existing test failures in audioCache, images, errorAnalysis, aiProxy, storage are unrelated to this plan's changes

## Known Stubs

None.

## Threat Flags

None. Changes are internal component state transitions and prop threading only (no new network endpoints, auth paths, or file access patterns).

## Self-Check: PASSED

- [x] `src/components/live-roleplay/LiveRoleplayPage.tsx` — modified, contains `handleRetryScenario`
- [x] `src/components/live-roleplay/ConversationAnalysis.tsx` — modified, contains `onRetry`, `Tentar Novamente`, `Novo Cenario`, `Ver Historico`
- [x] Commit `1beae6a` exists in git log
