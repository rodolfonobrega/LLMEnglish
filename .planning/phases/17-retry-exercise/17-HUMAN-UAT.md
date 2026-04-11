---
status: partial
phase: 17-retry-exercise
source: [17-VERIFICATION.md]
started: 2026-04-11T14:55:00.000Z
updated: 2026-04-11T14:55:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ExerciseMode retry flow
expected: After completing an exercise and clicking "Tentar Novamente", AudioRecorder remounts cleanly with no stale state. Exercise prompt text remains unchanged.
result: [pending]

### 2. ImageMode retry flow
expected: After completing an image exercise and clicking "Tentar Novamente", the same image and question are still visible. AudioRecorder resets. Evaluation panel disappears.
result: [pending]

### 3. LiveRoleplay retry flow
expected: After analysis is shown, clicking "Tentar Novamente" re-enters the live conversation with the same scenario (no ScenarioSetup shown). Conversation turns are cleared.
result: [pending]

### 4. Button visual hierarchy
expected: Primary (teal) / secondary (outlined) / ghost (text-only) renders correctly in light and dark mode. All buttons full-width and vertically stacked.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
