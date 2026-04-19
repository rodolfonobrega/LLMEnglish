# Phase 20: Review Algorithm Fix - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix four specific bugs in the spaced repetition review algorithm so that:
1. New cards appear in the review queue immediately after saving
2. Existing orphaned cards (nextReviewAt=NULL) become available for review
3. Scores 3-4/10 are treated as "partial" knowledge, not "incorrect"
4. Same-day same-score reviews are preserved in history

This is a bug-fix phase — no new features, no UI changes, no database schema changes. Only fixes to `spacedRepetition.ts` and `supabase/storage.ts`.

</domain>

<decisions>
## Implementation Decisions

### Score-to-Quality Mapping (Three-Tier System)
- **D-01:** Replace the current two-tier (quality >= 3 = correct, else incorrect) with a three-tier system:
  - **Incorrect** (quality < 2, scores 0-3/10): Full reset — repetitions = 0, interval = 1 day
  - **Partial** (quality 2-3, scores 4-5/10... wait, let me recalculate)

  Score-to-quality mapping: `Math.round((score / 10) * 5)`
  - Score 0-3/10 → quality 0-1 → **Incorrect** tier (full reset)
  - Score 4-5/10 → quality 2 → **Partial** tier (keep progress, interval = 1 day)
  - Score 6/10 → quality 3 → **Partial** tier (keep progress, interval = 1 day)
  - Score 7-10/10 → quality 4-5 → **Correct** tier (normal SM-2 progression)

  Wait — the requirement says scores 3-4/10 should be "partial". Let me re-examine. With `Math.round`:
  - Score 3/10 → Math.round(1.5) = 2
  - Score 4/10 → Math.round(2.0) = 2

  So quality 2 = scores 3-4/10. The three-tier thresholds should be:
  - quality < 2 (scores 0-2/10) → Incorrect
  - quality 2 (scores 3-4/10) → Partial
  - quality >= 3 (scores 5-10/10) → Correct

  Actually the user said "3-4 out of 10" is partial. But with the current Math.round mapping:
  - Score 5/10 → Math.round(2.5) = 3 → would be "correct"

  The user chose the three-tier system where quality 2-3 = partial. This maps to scores ~3-6/10 being partial. But the requirement specifically says 3-4/10. This needs to be reconciled in planning.

  **Locked decision:** Three quality tiers. Quality < 2 = incorrect (full reset), quality 2-3 = partial (keep repetitions, interval = 1 day), quality >= 4 = correct (normal progression). The exact score-to-quality mapping may need adjustment to match the requirement that 3-4/10 = partial.

- **D-02:** Partial tier behavior: preserve repetitions (don't reset to 0), set interval to 1 day (review again tomorrow).

### Orphan Card Backfill
- **D-03:** Auto-fix on read — when `getCardsDueForReview()` runs, any card with NULL `nextReviewAt` gets its `nextReviewAt` set to `now()` on the fly. No separate migration needed. After the `createDefaultCard` fix (D-04), no new orphans will be created.

### New Card Availability
- **D-04:** `createDefaultCard()` must set `nextReviewAt` to the current timestamp so new cards are immediately reviewable. The query `getCardsDueForReview()` already filters `.lte('next_review_at', now)` — once `nextReviewAt` is set, new cards appear automatically.

### Review Dedup
- **D-05:** Remove the dedup filter logic entirely. Always insert new review records. Rely on the database primary key (serial `id`) for uniqueness. This ensures same-day same-score reviews are always preserved.

### Claude's Discretion
- Exact score-to-quality mapping formula adjustments to ensure 3-4/10 maps to partial tier
- Whether to adjust the `Math.round` or change the mapping formula entirely
- Implementation details of the auto-fix on read (inline fix vs separate function)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Algorithm
- `src/services/spacedRepetition.ts` — SM-2 algorithm with `updateCardSchedule()` and `createDefaultCard()`
- `src/types/card.ts` — Card interface with `nextReviewAt`, SM-2 fields, and `ReviewEntry` type

### Storage Layer
- `src/services/supabase/storage.ts` — `getCardsDueForReview()` query (line ~248), dedup logic (line ~194), `supabaseCardToLocal()` converter
- `src/types/supabase.ts` — `CardReview` interface, `Card` Supabase type with `next_review_at` field

### Review UI
- `src/components/review/ReviewPage.tsx` — Consumes `getCardsDueForReview()` and calls `updateCardSchedule()`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spacedRepetition.ts`: Contains both `updateCardSchedule()` and `createDefaultCard()` — both need modification
- `supabase/storage.ts`: `getCardsDueForReview()` query at line ~248 — needs OR condition for NULL `next_review_at`
- `supabase/storage.ts`: Dedup filter at line ~207 — needs removal

### Established Patterns
- SM-2 algorithm uses quality 0-5 internally, mapped from user score 0-10
- Cards stored in Supabase `cards` table, reviews in `card_reviews` table
- Local `Card` type (camelCase) converted to/from Supabase (snake_case) via `supabaseCardToLocal()`
- `ReviewEntry` in local type has `{ date, score, userTranscription }` — dedup is in the storage layer

### Integration Points
- `ReviewPage.tsx` calls `getCardsDueForReview()` on load and after each review
- `ExerciseMode.tsx` and `ImageMode.tsx` call `createDefaultCard()` when saving new cards
- `CardDetail.tsx` and `LibraryPage.tsx` display review history

</code_context>

<specifics>
## Specific Ideas

No specific visual or UX requirements — this is purely backend logic fixes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 20-review-algorithm-fix*
*Context gathered: 2026-04-19*
