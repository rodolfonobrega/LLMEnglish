---
status: partial
phase: 17-retry-exercise
source: [17-VERIFICATION.md]
started: 2026-04-10T19:57:00Z
updated: 2026-04-10T19:57:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ExerciseMode 3-button layout
expected: After completing an exercise, user sees 3 buttons: Tentar Novamente (retries same exercise), Novo Exercicio (new exercise), Voltar ao Hub (navigates to /practice)
result: [pending]

### 2. ImageMode 3-button layout
expected: After completing an image exercise, user sees same 3-button pattern. Retry preserves imageUrl and question.
result: [pending]

### 3. LiveRoleplay 3-button layout
expected: After live roleplay analysis, user sees: Tentar Novamente (retries same scenario), Novo Cenario (goes to setup), Ver Historico (navigates to /history)
result: [pending]

### 4. State preservation across retry
expected: Clicking "Tentar Novamente" in all modes preserves exercise content (prompt, image, scenario) while clearing evaluation/audio state
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
