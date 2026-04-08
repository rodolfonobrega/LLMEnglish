---
status: awaiting_human_verify
trigger: "Settings page has 2 bugs: 1) API key mask (****) shows inconsistent number of characters compared to actual key length. 2) Saved model configs revert to defaults when returning to settings page."
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:05:00Z
---

## Current Focus

hypothesis: Two root causes confirmed and fixed. Awaiting human verification.
test: TypeScript compiles clean, 11 tests pass (7 existing + 4 new regression tests)
expecting: User confirms fixes work in real app
next_action: Archive session after human confirmation

## Symptoms

expected: 1) API key mask should show same number of masked characters as the real key length. 2) When user saves model configurations and returns to Settings page, the previously saved values should be displayed.
actual: 1) The **** mask is inconsistent — sometimes shows more characters, sometimes fewer than the actual API key. 2) After saving model configs and navigating away then back to Settings, the page shows default values instead of saved values. User doesn't know if the app actually uses the saved configs or ignores them.
errors: No visible error messages reported.
reproduction: 1) Enter an API key in Settings, note the mask length vs actual key length. 2) Change model selection in Settings, save, navigate away, come back — defaults shown instead of saved values.
started: Unknown — possibly always existed.

## Eliminated

## Evidence

- timestamp: 2026-04-07T00:00:30Z
  checked: SettingsPage.tsx useEffect on mount (line 91-105)
  found: useEffect only fetches modelConfig and conversationTone. API key states (openaiKey, geminiKey, groqKey, openrouterKey) are initialized as empty strings ('') and never populated from storage on mount.
  implication: Bug 1 root cause — existing API keys are never displayed when returning to Settings page. User sees empty inputs instead of masked keys.

- timestamp: 2026-04-07T00:00:45Z
  checked: migrateModelConfig in settings.ts (line 370-416)
  found: Function starts with `const migrated = { ...DEFAULT_MODEL_CONFIG }` and only populates fields when old-style `*Provider` fields exist (e.g., `config.chatProvider && !config.chatSource`). When config already uses new-style `*Source` fields (which is what saveModelConfig writes), NONE of the conditions match, so the function always returns DEFAULT_MODEL_CONFIG.
  implication: Bug 2 root cause — saved configs are read from DB correctly but then discarded by migrateModelConfig which returns defaults for any config using new-style source fields.

- timestamp: 2026-04-07T00:04:00Z
  checked: TypeScript compilation and test suite
  found: `npx tsc --noEmit` passes clean. `npx vitest run src/types/settings.test.ts` — 11/11 tests pass (7 existing + 4 new migrateModelConfig tests).
  implication: Fixes are type-safe and don't break existing functionality.

## Resolution

root_cause: |
  Bug 1: SettingsPage never loads existing API keys from storage on mount. The useEffect only fetches modelConfig and conversationTone, leaving API key states as empty strings.
  Bug 2: migrateModelConfig() only handles migration from old *Provider fields to new *Source fields. When a config already uses *Source fields (the normal case after saving), the function returns DEFAULT_MODEL_CONFIG, discarding the actual saved values.

fix: |
  Bug 1: Added API key fetching to SettingsPage mount useEffect. Keys are displayed as masked strings ('*'.repeat(key.length)) matching the actual key length. Added editedKeys ref tracking to ensure only user-modified keys are sent to saveApiKeys (preventing masked display values from overwriting real keys).
  Bug 2: Fixed migrateModelConfig to check for *Source fields FIRST (before *Provider migration path), so configs saved with new-style fields are preserved instead of being replaced with defaults.

verification: TypeScript compiles clean. 11 tests pass (7 existing + 4 new regression tests for migrateModelConfig). Manual verification needed in running app.

files_changed:
  - src/types/settings.ts
  - src/components/settings/SettingsPage.tsx
  - src/types/settings.test.ts
