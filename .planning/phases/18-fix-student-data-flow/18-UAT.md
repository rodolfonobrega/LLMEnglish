---
status: complete
phase: 18-fix-student-data-flow
source: [18-01-SUMMARY.md, 18-REVIEW-FIX.md]
started: 2026-04-11T20:10:00Z
updated: 2026-04-11T20:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Exercise evaluation shown in dev mode (no auth)
expected: Open the app in dev mode (no Supabase credentials / not logged in). Navigate to an exercise in Discovery/ExerciseMode. Record or submit an answer. The evaluation result (score + feedback) should always appear on screen. You may see a console warning like "Background persistence failed" but NO error message should replace or block the evaluation UI.
result: pass

### 2. Category-aware card recommendations
expected: When the system identifies a student weakness (e.g. articles), the "Study Weak Areas" feature surfaces flashcards related to that category (articles → cards about a/an/the usage). Cards should NOT be random low-scoring cards from unrelated topics.
result: pass

### 3. guessCategory — no false positives on common words
expected: Correction messages that happen to contain the word "a" or "in" are NOT automatically categorised as article/preposition errors. E.g. a correction like "You should use a simpler structure" is classified as vocabulary or grammar — not 'article'.
result: pass

### 4. XP persists after exercise (sync fixed)
expected: Complete an exercise while logged in. Note the XP total shown. Reload the page. XP total shown after reload should equal XP after exercise (previously XP was only flushed to Supabase when saving a card, so reloads could lose XP).
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
