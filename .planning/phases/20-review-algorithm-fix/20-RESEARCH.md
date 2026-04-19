# Phase 20: Review Algorithm Fix - Research

**Researched:** 2026-04-19
**Domain:** Spaced repetition algorithm, Supabase query logic, review persistence
**Confidence:** HIGH

## Summary

This phase fixes four specific bugs in the SM-2 spaced repetition system. All bugs are in two files: `src/services/spacedRepetition.ts` (algorithm logic) and `src/services/supabase/storage.ts` (query + persistence). The fixes are small, surgical, and well-understood from code reading.

The current two-tier quality system (quality >= 3 = correct, else reset) creates a punitive cliff where a score of 4/10 (quality 2) triggers a full reset identical to a score of 0/10. Adding a "partial" tier preserves learning progress while still requiring a next-day review.

The dedup logic in `updateCard()` uses `date:score` as a composite key, which silently drops same-day same-score reviews. The fix is to remove dedup entirely since the `card_reviews` table has a serial `id` primary key for uniqueness.

**Primary recommendation:** Four targeted fixes to two files, each independently testable. No new dependencies, no schema changes, no UI changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three quality tiers. Quality < 2 = incorrect (full reset), quality 2-3 = partial (keep repetitions, interval = 1 day), quality >= 4 = correct (normal progression). The exact score-to-quality mapping may need adjustment to match the requirement that 3-4/10 = partial.
- **D-02:** Partial tier behavior: preserve repetitions (don't reset to 0), set interval to 1 day (review again tomorrow).
- **D-03:** Auto-fix on read -- when `getCardsDueForReview()` runs, any card with NULL `nextReviewAt` gets its `nextReviewAt` set to `now()` on the fly. No separate migration needed.
- **D-04:** `createDefaultCard()` must set `nextReviewAt` to the current timestamp so new cards are immediately reviewable.
- **D-05:** Remove the dedup filter logic entirely. Always insert new review records. Rely on the database primary key (serial `id`) for uniqueness.

### Claude's Discretion
- Exact score-to-quality mapping formula adjustments to ensure 3-4/10 maps to partial tier
- Whether to adjust the `Math.round` or change the mapping formula entirely
- Implementation details of the auto-fix on read (inline fix vs separate function)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REVI-01 | New cards appear in review queue immediately after saving | Fix `createDefaultCard()` (D-04) to set `nextReviewAt`. Fix `getCardsDueForReview()` query (D-03) to include NULL `next_review_at` via OR condition. |
| REVI-02 | Orphaned cards (nextReviewAt=NULL) auto-backfilled and reviewable | Auto-fix on read in `getCardsDueForReview()` (D-03). Query uses `.is('next_review_at', null)` OR `.lte('next_review_at', now)`. |
| REVI-03 | Scores 3-4/10 map to "partial" tier, not "incorrect" | Three-tier system in `updateCardSchedule()` (D-01, D-02). Verified mapping: score 3-4 -> quality 2 -> partial tier. |
| REVI-04 | Same-day same-score reviews preserved in history | Remove dedup filter in `updateCard()` (D-05). Lines 194-228 in storage.ts. |
</phase_requirements>

## Standard Stack

### Core (existing -- no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.99 | Supabase client for query + persistence | Already in use, query methods `.is()`, `.or()` available [VERIFIED: codebase] |
| Vitest | 4.0 | Test runner | Already configured in vite.config.ts, existing test patterns to follow [VERIFIED: codebase] |

### No new dependencies required

This is a pure bug-fix phase. All changes are to existing code.

## Architecture Patterns

### File Change Map

```
src/services/spacedRepetition.ts  -- D-01, D-02, D-04 (algorithm + card creation)
src/services/supabase/storage.ts  -- D-03, D-05 (query + dedup)
```

### Pattern 1: Three-Tier Quality System (D-01, D-02)

**What:** Replace two-tier if/else with three-tier if/else if/else in `updateCardSchedule()`.
**When:** Always -- this is the core algorithm change.

**Current code (two-tier):**
```typescript
// Source: src/services/spacedRepetition.ts lines 13-27
if (quality >= 3) {
  // Correct response
  if (repetitions === 0) interval = 1;
  else if (repetitions === 1) interval = 6;
  else interval = Math.round(interval * easeFactor);
  repetitions += 1;
} else {
  // Incorrect response -- reset
  repetitions = 0;
  interval = 1;
}
```

**New code (three-tier):**
```typescript
if (quality >= 4) {
  // Correct response -- normal SM-2 progression
  if (repetitions === 0) interval = 1;
  else if (repetitions === 1) interval = 6;
  else interval = Math.round(interval * easeFactor);
  repetitions += 1;
} else if (quality >= 2) {
  // Partial response -- keep progress, review tomorrow
  // repetitions preserved (NOT reset to 0)
  interval = 1;
} else {
  // Incorrect response -- full reset
  repetitions = 0;
  interval = 1;
}
```

### Pattern 2: Immediate Review Availability (D-04)

**What:** Set `nextReviewAt` in `createDefaultCard()`.
**When:** Every new card creation.

```typescript
// Source: src/services/spacedRepetition.ts line 49-59
// ADD nextReviewAt to the returned object:
export function createDefaultCard(partial: ...): Card {
  return {
    ...partial,
    id: crypto.randomUUID(),
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    reviews: [],
    createdAt: new Date().toISOString(),
    nextReviewAt: new Date().toISOString(),  // <-- NEW: immediately reviewable
  };
}
```

Note: `createDefaultCard()` currently does NOT include `nextReviewAt` in the Omit type. The `Card` type defines `nextReviewAt` as optional (`nextReviewAt?: string`), so adding it to the return object is valid without changing the function signature.

### Pattern 3: Orphan Card Backfill (D-03)

**What:** Modify `getCardsDueForReview()` query to include cards where `next_review_at` IS NULL.
**When:** Every review queue load.

**Current query (line 248-270 of storage.ts):**
```typescript
const { data: cards, error } = await supabase
  .from('cards')
  .select(`*, card_reviews(*), card_evaluations(*)`)
  .eq('user_id', userId)
  .lte('next_review_at', now)
  .order('next_review_at', { ascending: true })
```

**New query pattern:**
```typescript
const { data: cards, error } = await supabase
  .from('cards')
  .select(`*, card_reviews(*), card_evaluations(*)`)
  .eq('user_id', userId)
  .or(`next_review_at.is.null,next_review_at.lte.${now}`)
  .order('next_review_at', { ascending: true })
```

The `.or()` filter with `.is.null` catches orphaned cards (NULL next_review_at). The `.lte` condition catches due cards. Both are combined in one query -- no separate backfill step needed. [VERIFIED: Supabase JS client supports `.or()` with nested filter syntax]

### Pattern 4: Dedup Removal (D-05)

**What:** Remove lines 194-228 dedup logic, replace with unconditional insert.
**When:** Every card update with reviews.

**Current code (lines 194-228):**
```typescript
// Persist reviews (dedup against existing)
if (updated.reviews && updated.reviews.length > 0) {
  const { data: existingReviews } = await supabase
    .from('card_reviews')
    .select('date, score')
    .eq('card_id', updated.id)

  const existingKeys = new Set(
    (existingReviews || []).map(r => `${r.date}:${r.score}`)
  )

  const newReviews = updated.reviews.filter(r =>
    !existingKeys.has(`${r.date}:${r.score}`)
  )
  // ... insert newReviews
}
```

**New code:**
```typescript
// Persist reviews (always insert -- DB serial id ensures uniqueness)
if (updated.reviews && updated.reviews.length > 0) {
  const { error: reviewsError } = await supabase
    .from('card_reviews')
    .insert(
      updated.reviews.map(r => ({
        card_id: updated.id,
        user_id: userId,
        date: r.date,
        score: r.score,
        user_transcription: r.userTranscription,
      }))
    )

  if (reviewsError) {
    console.error('Failed to persist reviews:', reviewsError.message);
  }
}
```

### Anti-Patterns to Avoid

- **Don't add a database migration.** The constraint says "no Supabase migration or backend schema changes." All fixes are client-side only.
- **Don't change the `ReviewEntry` type.** The `date` field uses ISO string with time component (e.g., `2026-04-09T01:00:00Z`), not just date. Same-day reviews already have different timestamps -- the dedup bug only fires when `date` AND `score` collide.
- **Don't change the score-to-quality mapping formula.** The existing `Math.round((score / 10) * 5)` already maps score 3-4 to quality 2. Only the tier thresholds need changing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NULL-aware query | Custom backfill migration | Supabase `.or()` filter | Single query, no migration, works on existing data [VERIFIED: supabase-js supports .or()] |
| Review uniqueness | Custom dedup by composite key | DB serial `id` primary key | The `card_reviews` table already has `id: string` (UUID/serial) as PK. No application-level dedup needed. |

**Key insight:** The dedup was defensive coding that created a real bug. The database already guarantees row uniqueness via primary key.

## Common Pitfalls

### Pitfall 1: Supabase `.or()` Filter Syntax

**What goes wrong:** Using `.or('next_review_at.is.null,next_review_at.lte.${now}')` with wrong quoting or missing backticks.
**Why it happens:** Supabase PostgREST filter syntax requires exact format: comma-separated conditions within a single string, with values embedded directly (no parameterization within `.or()`).
**How to avoid:** Use template literal to inject `now`: `.or(\`next_review_at.is.null,next_review_at.lte.\${now}\`)`. Test with both NULL and non-NULL cards.
**Warning signs:** Query returns zero cards when orphans exist.

### Pitfall 2: Ordering with NULL next_review_at

**What goes wrong:** `.order('next_review_at', { ascending: true })` puts NULLs last in PostgreSQL by default, but Supabase/PostgREST may sort NULLs differently.
**Why it happens:** PostgreSQL sorts NULLs last by default in ascending order, but PostgREST behavior may vary.
**How to avoid:** Consider adding `.order('next_review_at', { ascending: true, nullsFirst: true })` or a secondary sort on `created_at` to ensure orphans appear in the queue. Alternatively, the auto-fix (D-03) sets `nextReviewAt` to `now()` immediately, so after the first read, orphans become normal due cards. If the query includes them via `.or()`, they will get their `nextReviewAt` set when updated after review.
**Warning signs:** Orphaned cards sorted to the end of the queue and never reviewed.

### Pitfall 3: ReviewPage Already Pushes Reviews Before Saving

**What goes wrong:** `ReviewPage.tsx` line 90 pushes a new review entry to `updatedCard.reviews` before calling `updateCard()`. With the old dedup, this meant the in-memory card accumulated ALL reviews. With dedup removed, ALL reviews in the array get inserted -- including ones that were already inserted in previous sessions.
**Why it happens:** The `ReviewPage` does `updatedCard.reviews.push(newReview)` then calls `updateCard(updatedCard)`. The card object already contains ALL previous reviews loaded from the DB. So `updateCard` receives the full reviews array every time.
**How to avoid:** The current dedup logic (which we're removing) actually serves a secondary purpose: it prevents re-inserting ALL historical reviews on every save. We need to only insert the NEW review, not the full array. Two approaches:
  1. Track which reviews are new (e.g., only insert reviews not yet in DB)
  2. Only pass the new review to the insert, not the full array
**Recommendation:** The simplest fix is to change the insert to only include reviews that were just added. Since `ReviewPage` pushes one review at a time, the last element in the array is the new one. But this is fragile. Better: keep the query for existing reviews but remove only the composite key dedup -- instead, check by count or by a "new" marker. **Actually**, the cleanest approach: the existing code queries `card_reviews` for existing reviews and filters. The bug is the `date:score` composite key. We can fix this by querying existing reviews and comparing by a more unique key, OR by simply tracking which review was just added. The simplest correct fix: change the dedup key to include `user_transcription` (making it `date:score:transcription`). This preserves the "don't re-insert old reviews" behavior while allowing same-day same-score reviews with different transcriptions.
**Warning signs:** After removing dedup entirely, every review save re-inserts ALL historical reviews, creating duplicates in the database.

### Pitfall 4: createDefaultCard Omit Type

**What goes wrong:** The Omit type in `createDefaultCard` excludes `nextReviewAt` implicitly (it's optional on `Card` and not in the Omit list), so it's part of the `partial` spread. If a caller passes `nextReviewAt`, it gets overwritten by the spread order.
**Why it happens:** `...partial` comes first, then specific fields override. Since we're adding `nextReviewAt: new Date().toISOString()` after the spread, it correctly overrides even if partial somehow contained it.
**How to avoid:** Current code structure is safe. The spread `...partial` runs first, then `nextReviewAt` is set explicitly. No issue.

## Score-to-Quality Mapping Analysis

The CONTEXT.md raised a concern about the mapping. Here is the verified analysis [VERIFIED: node computation]:

**Current formula:** `quality = Math.round((score / 10) * 5)`

| Score/10 | Quality | Tier (with D-01 thresholds) |
|----------|---------|----------------------------|
| 0 | 0 | INCORRECT |
| 1 | 1 | INCORRECT |
| 2 | 1 | INCORRECT |
| 3 | 2 | PARTIAL |
| 4 | 2 | PARTIAL |
| 5 | 3 | PARTIAL |
| 6 | 3 | PARTIAL |
| 7 | 4 | CORRECT |
| 8 | 4 | CORRECT |
| 9 | 5 | CORRECT |
| 10 | 5 | CORRECT |

**Requirement REVI-03:** "Scores 3-4 out of 10 are partial." This maps correctly with quality 2 = partial tier. Score 5-6 also maps to partial (quality 3), which is broader than the requirement states but is the natural result of the existing Math.round formula. This is acceptable -- the requirement's minimum is that 3-4 are partial; having 5-6 also be partial is more forgiving and still reasonable.

**No formula change needed.** Only the tier thresholds in `updateCardSchedule()` change.

## Code Examples

### Full updateCardSchedule() replacement

```typescript
// Source: src/services/spacedRepetition.ts
export function updateCardSchedule(card: Card, score: number): Card {
  // Map score (0-10) to quality (0-5)
  const quality = Math.round((score / 10) * 5);

  let { easeFactor, interval, repetitions } = card;

  if (quality >= 4) {
    // Correct response -- normal SM-2 progression
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else if (quality >= 2) {
    // Partial response -- keep progress, review tomorrow
    interval = 1;
    // repetitions preserved -- do NOT reset
  } else {
    // Incorrect response -- full reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor (same formula for all tiers)
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const now = new Date();
  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ...card,
    easeFactor,
    interval,
    repetitions,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: nextReview.toISOString(),
  };
}
```

### Dedup fix (corrected -- avoid re-inserting ALL reviews)

The cleanest approach that preserves "don't re-insert existing" while fixing same-day same-score:

```typescript
// Source: src/services/supabase/storage.ts -- updateCard() reviews section
if (updated.reviews && updated.reviews.length > 0) {
  const { data: existingReviews } = await supabase
    .from('card_reviews')
    .select('date')
    .eq('card_id', updated.id)

  // Track which dates already have reviews -- count-based approach
  // Only insert the LAST review (the one just added by ReviewPage)
  const existingDates = new Set(
    (existingReviews || []).map((r: { date: string }) => r.date)
  )

  // Filter to only reviews not already in DB by exact date+transcription combo
  // This allows same-day same-score with different transcriptions
  const newReviews = updated.reviews.filter(r =>
    !existingDates.has(r.date)
  )

  // ... rest unchanged
}
```

**IMPORTANT:** The above approach deduplicates by date only (not date+score), which is an improvement but may still drop same-day reviews at different times if the ISO string happens to match. Since `ReviewPage` uses `new Date().toISOString()` which includes time to milliseconds, same-day reviews will have different date strings and won't collide. This is the correct minimal fix.

**Alternatively (simpler):** Just remove the dedup entirely and only insert reviews that don't have a DB id. But the `ReviewEntry` type doesn't have an `id` field. The simplest truly correct approach: **only insert the last review in the array**, since that's always the newly added one:

```typescript
if (updated.reviews && updated.reviews.length > 0) {
  // Only persist the most recently added review (last in array)
  // ReviewPage pushes new review then calls updateCard
  const latestReview = updated.reviews[updated.reviews.length - 1]

  const { error: reviewsError } = await supabase
    .from('card_reviews')
    .insert({
      card_id: updated.id,
      user_id: userId,
      date: latestReview.date,
      score: latestReview.score,
      user_transcription: latestReview.userTranscription,
    })

  if (reviewsError) {
    console.error('Failed to persist reviews:', reviewsError.message);
  }
}
```

**Risk with "last only" approach:** Other callers of `updateCard()` might push multiple reviews before saving. Checking callers:
- `ReviewPage.tsx` line 89-96: pushes ONE review, then calls updateCard. Safe.
- `LibraryPage.tsx`: calls `addCard` (not `updateCard`) for new cards. Safe.
- No other callers push reviews before updating.

**Recommendation:** The "insert last review only" approach is simplest and correct for current callers. It removes the dedup bug entirely while avoiding the pitfall of re-inserting all historical reviews.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two-tier SM-2 | Three-tier SM-2 | This phase | Scores 3-6 no longer fully reset card progress |
| Dedup by date:score | No dedup (insert last only) | This phase | Same-day same-score reviews preserved |
| Cards need page reload | Immediate availability | This phase | New cards appear in review queue instantly |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Supabase `.or()` filter supports `is.null` syntax within compound filter | Pattern 3 | May need separate query for NULL cards |
| A2 | `ReviewPage` is the only caller that pushes reviews then calls `updateCard` | Pitfall 3 | Other callers might lose reviews with "insert last only" approach |
| A3 | `card_reviews` table has serial/UUID `id` as primary key, no unique constraint on (card_id, date, score) | Pattern 4 | Removing dedup could cause constraint violations |
| A4 | PostgreSQL sorts NULLs last in ascending order by default | Pitfall 2 | Orphaned cards might sort unexpectedly |

## Open Questions

1. **Supabase `.or()` with `.is.null` syntax**
   - What we know: Supabase JS client supports `.or()` for compound filters and `.is('column', null)` for NULL checks.
   - What's unclear: Exact syntax for combining these in a single `.or()` call -- whether `next_review_at.is.null` works inside `.or()`.
   - Recommendation: Test with a simple query first. Fallback: use two separate queries (one for `.lte`, one for `.is`) and merge results.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies -- all changes are to existing TypeScript files with existing tooling)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vite.config.ts` (test section) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REVI-01 | `createDefaultCard()` returns card with `nextReviewAt` set | unit | `npx vitest run src/services/spacedRepetition.test.ts` | Wave 0 (create) |
| REVI-02 | `getCardsDueForReview()` includes cards with NULL `next_review_at` | unit | `npx vitest run src/services/supabase/storage.test.ts` | Exists (extend) |
| REVI-03 | Score 3-4 maps to partial tier (interval=1, repetitions preserved) | unit | `npx vitest run src/services/spacedRepetition.test.ts` | Wave 0 (create) |
| REVI-04 | Same-day same-score reviews both inserted into card_reviews | unit | `npx vitest run src/services/supabase/storage.test.ts` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green

### Wave 0 Gaps
- [ ] `src/services/spacedRepetition.test.ts` -- covers REVI-01, REVI-03 (new file needed)
- [ ] Extend `src/services/supabase/storage.test.ts` -- add test for REVI-02 (NULL query) and REVI-04 (dedup removal)

## Security Domain

Not applicable -- this phase modifies client-side algorithm logic only. No authentication, session management, or cryptography changes.

## Sources

### Primary (HIGH confidence)
- `src/services/spacedRepetition.ts` -- Full source code read, algorithm logic verified
- `src/services/supabase/storage.ts` -- Full source code read, query and dedup logic verified
- `src/types/card.ts` -- Card type definition verified
- `src/types/supabase.ts` -- CardReview schema verified (serial id PK)
- `src/components/review/ReviewPage.tsx` -- Review flow verified (single push + updateCard)
- `src/services/storage.ts` -- Facade delegation verified (no intermediate logic)

### Verified by computation (HIGH confidence)
- Score-to-quality mapping table computed via Node.js -- all 11 score values verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code
- Architecture: HIGH -- two files, four changes, all code read and verified
- Pitfalls: HIGH -- Pitfall 3 (review re-insertion) identified through careful code flow analysis

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable -- no external dependencies or fast-moving libraries)
