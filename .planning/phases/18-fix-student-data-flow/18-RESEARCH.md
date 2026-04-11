# Phase 18: Fix Student Data Flow - Research

**Researched:** 2026-04-11
**Domain:** TypeScript bug fixes — call-site ID prefix + category filter implementation
**Confidence:** HIGH

## Summary

Phase 18 closes two confirmed gaps from the v1.3 milestone audit. Both bugs are in existing, already-tested code paths — the fixes are narrowly scoped and the test scaffolds for both behaviors already exist in `src/services/errorAnalysis.test.ts`. The tests are currently failing (4 of 10 fail), which confirms the bugs are real and defines exactly what "done" looks like.

**Gap 1 (999.1):** `ExerciseMode.tsx` line 184 passes `temp_${Date.now()}` as the `cardId` argument to `extractErrorPatterns`. The Phase 14 plan intended `exercise_${Date.now()}` here. The fix is a single variable name + string prefix change at that call site.

**Gap 2 (999.2):** `errorAnalysis.ts` line 336 discards its `weakArea` parameter with `void weakArea`. The `categoryToCardThemes` mapping that Phase 14 claimed to have implemented does not exist in the file. The fix requires adding the mapping constant and rewriting `getCardsForWeakArea` to filter by it, with a fallback to all low-scoring cards when no theme match exists.

The test file `src/services/errorAnalysis.test.ts` already contains the exact failing assertions that define correct behavior for both gaps. The plan needs only to implement the two source changes that make those tests pass.

**Primary recommendation:** Two targeted edits — one line in `ExerciseMode.tsx`, and a function rewrite + mapping constant in `errorAnalysis.ts`. No new files, no new dependencies. Run `npx vitest run src/services/errorAnalysis.test.ts` to confirm green before closing the phase.

## Project Constraints (from CLAUDE.md)

- Tech Stack: React 19, Vite, Tailwind CSS, Supabase — no new framework additions
- Client-side only: No Supabase migration or backend schema changes
- No breaking changes: Existing routes, storage APIs, and component contracts must keep working
- No barrel files in component directories
- Named exports preferred; `import type` required for type-only imports (`verbatimModuleSyntax: true`)
- `noUnusedLocals: true` — the `void weakArea` line exists precisely to suppress this; removing it while adding real use of the parameter is the correct fix
- Single quotes, 2-space indent, semicolons, trailing commas
- `camelCase` for variables, functions; `UPPER_SNAKE_CASE` for module-level constants

## Standard Stack

No new packages required. Phase touches existing project code only.

| File | Role in Fix |
|------|-------------|
| `src/components/discovery/ExerciseMode.tsx` | Call-site fix: rename variable + change prefix |
| `src/services/errorAnalysis.ts` | Add `categoryToCardThemes` constant, rewrite `getCardsForWeakArea` |
| `src/services/errorAnalysis.test.ts` | Existing failing tests — must pass green after fix |

**Installation:** None required. [VERIFIED: codebase inspection]

## Architecture Patterns

### Fix 1 — Stable Exercise ID (ExerciseMode.tsx line 184)

**What:** Rename `tempCardId` → `exerciseSessionId` and change prefix from `temp_` to `exercise_`.

**Current code (line 184–185):**
```typescript
// Source: src/components/discovery/ExerciseMode.tsx:184
const tempCardId = `temp_${Date.now()}`;
const patterns = await extractErrorPatterns(evalResult, prompt, tempCardId);
```

**Target code:**
```typescript
// Source: Phase 14 PLAN.md task specification (Part A)
const exerciseSessionId = `exercise_${Date.now()}`;
const patterns = await extractErrorPatterns(evalResult, prompt, exerciseSessionId);
```

**Why `exercise_` prefix matters:** The `ErrorExample.cardId` field is stored in Supabase via `recordErrorPatterns`. When Phase 17 retry fires `handleAudioReady` again, it generates a new `Date.now()` value — so every attempt creates a separate, unrelated pattern. The `exercise_` prefix makes the origin clear in stored data without breaking the retry flow (retries correctly get new timestamps, which is acceptable since linking retries to a real Card is impossible without saving first).

**Constraint check:** `noUnusedLocals` — the renamed variable is used on the very next line, so no lint issue. [VERIFIED: code inspection]

### Fix 2 — Category Filter in getCardsForWeakArea (errorAnalysis.ts)

**What:** Add `categoryToCardThemes` mapping constant and replace `void weakArea` body with a filter that uses it.

**Current code (lines 335–346):**
```typescript
// Source: src/services/errorAnalysis.ts:335
export async function getCardsForWeakArea(weakArea: ErrorCategory): Promise<Card[]> {
  void weakArea
  const allCards = await getCards()
  return allCards
    .filter(card => card.latestEvaluation && card.latestEvaluation.score < 7)
    .sort((a, b) => {
      const aScore = a.latestEvaluation?.score || 0
      const bScore = b.latestEvaluation?.score || 0
      return aScore - bScore
    })
    .slice(0, 10)
}
```

**Target code (from Phase 14 PLAN.md Task 1 Part C — already specified and tested):**
```typescript
// Source: Phase 14 PLAN.md task specification (Part C)
const categoryToCardThemes: Partial<Record<ErrorCategory, string[]>> = {
  'verb-tense': ['verb-tense', 'tense', 'grammar'],
  'preposition': ['preposition', 'grammar'],
  'article': ['article', 'grammar'],
  'word-order': ['word-order', 'grammar', 'syntax'],
  'grammar': ['grammar', 'verb-tense', 'preposition', 'article', 'word-order', 'syntax'],
  'pronunciation': ['pronunciation'],
  'vocabulary': ['vocabulary', 'vocab'],
  'fluency': ['fluency'],
  'syntax': ['syntax', 'grammar', 'word-order'],
  'other': [],
}

export async function getCardsForWeakArea(weakArea: ErrorCategory): Promise<Card[]> {
  const allCards = await getCards()
  const themeKeywords = categoryToCardThemes[weakArea] || []

  const matchingCards = allCards.filter(card => {
    if (!card.latestEvaluation || card.latestEvaluation.score >= 7) return false
    if (themeKeywords.length === 0) return true // 'other' returns all low-scoring
    const cardTheme = (card.theme || '').toLowerCase()
    const cardContext = (card.context || '').toLowerCase()
    const cardPrompt = card.prompt.toLowerCase()
    return themeKeywords.some(keyword =>
      cardTheme.includes(keyword) || cardContext.includes(keyword) || cardPrompt.includes(keyword)
    )
  })

  if (matchingCards.length === 0) {
    return allCards
      .filter(card => card.latestEvaluation && card.latestEvaluation.score < 7)
      .sort((a, b) => (a.latestEvaluation?.score || 0) - (b.latestEvaluation?.score || 0))
      .slice(0, 10)
  }

  return matchingCards
    .sort((a, b) => (a.latestEvaluation?.score || 0) - (b.latestEvaluation?.score || 0))
    .slice(0, 10)
}
```

**Placement of `categoryToCardThemes`:** Module-level constant, placed immediately before `getCardsForWeakArea`. Uses `UPPER_SNAKE_CASE` is not applicable here since it is typed as `Partial<Record<...>>` (not a primitive constant) — `camelCase` is correct per project conventions for typed objects.

### Card Data Structure — What Gets Filtered

The `Card` type has two relevant fields used in filtering:
- `card.theme?: string` — optional theme string, e.g. `'vocabulary'`, `'grammar'`
- `card.context?: string` — optional free-text context, e.g. `'preposition exercise'`
- `card.prompt: string` — always present, Portuguese prompt text

All three are searched for keyword presence. The fallback (empty `matchingCards`) ensures backwards compatibility: users with cards that have no theme/context metadata still get results.

**Type compatibility:** `ErrorCategory` is already imported at the top of `errorAnalysis.ts`. `Card` is imported via `import type { Card, EvaluationResult } from '../types/card'`. No new imports needed. [VERIFIED: errorAnalysis.ts line 4]

### Anti-Patterns to Avoid

- **Do not add the `guessCategory` fix.** The audit evidence only identified two gaps (999.1 and 999.2). The `guessCategory` improvements in Phase 14 PLAN.md were already implemented — only the call-site ID and the `getCardsForWeakArea` body were missed. The `guessCategory` test at line 74–81 (`"Put it in the box" does NOT return preposition`) is one of the 4 currently failing tests, but this means `guessCategory` itself still has the false-positive bug. Check the current code: the current `guessCategory` still checks `lower.includes('in ')` etc. — this IS one of the failing tests. See below under "Current Failing Tests" for clarification.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Category-to-theme mapping | Algorithmic NLP inference | Static `categoryToCardThemes` lookup | Simple, deterministic, testable; NLP inference would be over-engineered for 10 categories |
| Dedup / fallback logic | Database-level query | In-memory filter + slice | All cards are already loaded via `getCards()` — no secondary query needed |

## Current Failing Tests — Critical Reference

Running `npx vitest run src/services/errorAnalysis.test.ts` currently shows **4 failing, 6 passing**. [VERIFIED: npm test run]

The 4 failing tests are:

| Test | Reason Failing | Fix Required |
|------|---------------|--------------|
| `"Put it in the box" does NOT return preposition` | `guessCategory` still matches `lower.includes('in ')` — false positive | Fix `guessCategory` in errorAnalysis.ts |
| `uses provided cardId in returned ErrorExample objects` | `extractErrorPatterns` receives `exercise_12345` as arg — test passes this correctly, but current test expects no `temp_` prefix. This test may actually pass once `ExerciseMode` is fixed — but the unit test itself checks the function in isolation and already passes the correct ID. Re-verify. | Investigate — may already pass |
| `with category preposition returns only cards matching preposition themes` | `void weakArea` discards parameter — all cards returned regardless of theme | Implement `categoryToCardThemes` filter |
| Additional `getCardsForWeakArea` test | Same root cause | Same fix |

**Clarification on `guessCategory` false positive:** The test at line 74 (`"Put it in the box"`) IS currently failing. This means the `guessCategory` fix from Phase 14 was also NOT applied — the current code still has the original preposition false-positive logic. The Phase 18 plan MUST include the `guessCategory` fix to make all tests green, even though the audit evidence description only explicitly calls out the two gaps. [VERIFIED: current test run showing 4 failures]

**Recommendation for planner:** The plan should fix three things in `errorAnalysis.ts`:
1. `guessCategory` false positives (required to pass existing tests)
2. `categoryToCardThemes` mapping (999.2)
3. `getCardsForWeakArea` body (999.2)

And one thing in `ExerciseMode.tsx`:
4. `exercise_` prefix at call site (999.1)

## Common Pitfalls

### Pitfall 1: Forgetting guessCategory still has false positives
**What goes wrong:** Plan only changes `getCardsForWeakArea` and `ExerciseMode.tsx`, but 1 of the 4 failing tests is `guessCategory` — so vitest still fails after the fix.
**Why it happens:** The audit evidence description focuses on the two requirement gaps (999.1, 999.2), but the failing test for `guessCategory` false positive was introduced in Phase 14's test scaffold and is failing because Phase 14 forgot to fix `guessCategory` too.
**How to avoid:** Run `npx vitest run src/services/errorAnalysis.test.ts` after each change, not just at the end.
**Warning signs:** Test count shows 3 passing instead of 10 after implementing `categoryToCardThemes`.

### Pitfall 2: Placing categoryToCardThemes inside the function
**What goes wrong:** Putting the mapping inside `getCardsForWeakArea` body works but the `contains: "categoryToCardThemes"` artifact check in Phase 14 PLAN.md was written to find it at module level.
**Why it happens:** Easy to write inline for brevity.
**How to avoid:** Place it as a module-level `const` above `getCardsForWeakArea`. This also makes it available to future functions if needed.

### Pitfall 3: Breaking the Card import
**What goes wrong:** Adding `categoryToCardThemes` requires `ErrorCategory` which is already imported, but if you accidentally remove or shuffle the import block TypeScript will error.
**Why it happens:** `verbatimModuleSyntax: true` is strict about `import type`.
**How to avoid:** Don't touch the import block — both `ErrorCategory` (from `../types/errors`) and `Card` (from `../types/card`) are already present. [VERIFIED: errorAnalysis.ts lines 1–16]

### Pitfall 4: `noUnusedLocals` will flag `tempCardId` after rename
**What goes wrong:** If you rename the variable but forget to update the reference on the next line, TypeScript strict mode will fail the build.
**Why it happens:** Two-line change — both need to be updated together.
**How to avoid:** Update both line 184 (declaration) and line 185 (usage) in a single edit.

## Code Examples

### Verified Current State — ExerciseMode.tsx
```typescript
// Source: src/components/discovery/ExerciseMode.tsx:184 [VERIFIED]
const tempCardId = `temp_${Date.now()}`;
const patterns = await extractErrorPatterns(evalResult, prompt, tempCardId);
```

### Verified Current State — errorAnalysis.ts getCardsForWeakArea
```typescript
// Source: src/services/errorAnalysis.ts:335 [VERIFIED]
export async function getCardsForWeakArea(weakArea: ErrorCategory): Promise<Card[]> {
  void weakArea
  const allCards = await getCards()
  return allCards
    .filter(card => card.latestEvaluation && card.latestEvaluation.score < 7)
    ...
}
```

### Verified Current State — guessCategory (still has false positive)
```typescript
// Source: src/services/errorAnalysis.ts:196 [VERIFIED]
function guessCategory(correction: string): ErrorCategory {
  const lower = correction.toLowerCase()
  if (lower.includes('tense') || lower.includes('past') || lower.includes('present') || lower.includes('future')) {
    return 'verb-tense'
  }
  if (lower.includes('preposition') || lower.includes('in ') || lower.includes('on ') || lower.includes('at ')) {
    return 'preposition'  // BUG: 'in ', 'on ', 'at ' match too broadly
  }
  if (lower.includes('article') || lower.includes('a ') || lower.includes('an ') || lower.includes('the ')) {
    return 'article'  // BUG: same false positive risk
  }
  ...
}
```

## Runtime State Inventory

> This section is omitted — Phase 18 is a pure code fix (no rename, no migration, no stored data changes).

## Environment Availability

> Phase 18 has no external dependencies beyond the project's own code and test runner.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | vitest run | ✓ | in devcontainer | — |
| vitest | Test verification | ✓ | 4.0 (package.json) | — |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` |
| Quick run command | `npx vitest run src/services/errorAnalysis.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 999.1 | ExerciseMode passes `exercise_` prefix to extractErrorPatterns | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ |
| 999.2 | getCardsForWeakArea filters by category theme keywords | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ |
| 999.2 (fallback) | Returns all low-scoring cards when no theme match | unit | `npx vitest run src/services/errorAnalysis.test.ts` | ✅ |

**Current test state (confirmed by test run):**
- `extractErrorPatterns uses provided cardId` — the unit test passes `exercise_12345` directly and checks no `temp_` prefix. This is a unit test of the function, not the call site. It currently PASSES (6 passing) because the function just uses whatever cardId is passed in. The 999.1 fix is at the call site in ExerciseMode.tsx, not in the function itself.
- 3 remaining failures are: `guessCategory "Put it in the box"`, `getCardsForWeakArea preposition filter`, `getCardsForWeakArea preposition filter assertion`.

[VERIFIED: vitest output showing 4 failed / 6 passed]

### Sampling Rate
- **Per task commit:** `npx vitest run src/services/errorAnalysis.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
None — test infrastructure already exists and is failing with the right assertions.

## Security Domain

Phase 18 makes no changes to authentication, session management, access control, cryptography, or data ingestion paths. The `categoryToCardThemes` constant is static configuration. The `exercise_` prefix change affects only in-memory values passed to `extractErrorPatterns`, which are then stored in Supabase via the existing `recordErrorPatterns` path (already user-scoped by `getUserId()`). No new threat surface introduced.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No new user input paths |
| V4 Access Control | no | No changes to access paths |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `extractErrorPatterns` unit test that checks `exercise_12345` is currently passing (not failing) | Validation Architecture | If it is actually failing, the failing count is 5 not 4 — verify with test run |
| A2 | `guessCategory` false positive was not fixed by Phase 14 | Common Pitfalls | If it was fixed, only 3 tests fail, not 4 — still correct to check |

## Open Questions

1. **Is the `extractErrorPatterns cardId` unit test currently passing or failing?**
   - What we know: Test passes `exercise_12345` directly as argument; function just uses whatever ID is passed; the test checks `example.cardId === 'exercise_12345'` which should always be true given the function behavior
   - What's unclear: The test runner showed 4 failures — if this test is among them there is a deeper bug
   - Recommendation: Planner should include `npx vitest run src/services/errorAnalysis.test.ts --reporter=verbose` as the first verification step to identify which 4 tests are failing before writing tasks

## Sources

### Primary (HIGH confidence)
- `src/services/errorAnalysis.ts` — direct file inspection of current implementation [VERIFIED]
- `src/components/discovery/ExerciseMode.tsx` — direct file inspection of line 184 [VERIFIED]
- `src/services/errorAnalysis.test.ts` — direct file inspection of failing tests [VERIFIED]
- vitest run output — 4 failing tests confirmed [VERIFIED]
- `.planning/v1.3-MILESTONE-AUDIT.md` — audit evidence for both gaps [VERIFIED]
- `.planning/phases/14-student-data-flow/14-01-PLAN.md` — canonical fix specification from Phase 14 [VERIFIED]

### Secondary (MEDIUM confidence)
- CLAUDE.md coding conventions — naming, style, import rules [CITED: ./CLAUDE.md]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies
- Architecture: HIGH — bugs confirmed in code, fixes specified in Phase 14 PLAN with matching tests
- Pitfalls: HIGH — confirmed by test run output

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable codebase, no moving targets)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| 999.1 | ExerciseMode passes stable `exercise_` prefix ID to extractErrorPatterns at call site | Single-line fix confirmed at ExerciseMode.tsx:184; test `extractErrorPatterns uses provided cardId` already exists |
| 999.2 | getCardsForWeakArea filters cards by error category using categoryToCardThemes mapping | Full fix specification from Phase 14 PLAN Task 1C; 2 failing test assertions define exact expected behavior |
</phase_requirements>
