# Phase 20: Review Algorithm Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 20-review-algorithm-fix
**Areas discussed:** Score-to-quality mapping, Orphan backfill strategy, Review dedup key

---

## Score-to-Quality Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Three-tier system | quality < 2 = incorrect (full reset), quality 2-3 = partial (keep repetitions, interval = 1 day), quality >= 4 = correct (normal progression) | ✓ |
| Gentler reset (two-tier) | Move threshold: quality < 2 = incorrect, quality >= 2 = correct. Makes 4+/10 "correct" | |
| Five-tier granular | Each quality level (0-5) gets distinct behavior. Most precise but complex | |

**User's choice:** Three-tier system
**Notes:** Scores 3-4/10 should map to "partial" tier per requirements. Exact mapping formula may need adjustment.

### Partial Tier Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep progress, short interval | Don't reset repetitions, set interval to 1 day | ✓ |
| Keep progress, reduced interval | Keep repetitions AND interval, apply penalty (halve interval or reduce ease) | |

**User's choice:** Keep progress, short interval

---

## Orphan Backfill Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-fix on read | getCardsDueForReview() sets NULL nextReviewAt to now() on the fly | ✓ |
| One-time migration only | Run script to set all NULLs to now() | |
| Both (auto-fix + migration) | Fix on read for immediate relief + migration for bulk cleanup | |

**User's choice:** Auto-fix on read

---

## Review Dedup Key

| Option | Description | Selected |
|--------|-------------|----------|
| No dedup, always insert | Every review gets a unique ID, no dedup logic. Database primary key for uniqueness | ✓ |
| Dedup by card + second | Match on card_id + timestamp to the second. Prevents accidental double-writes | |

**User's choice:** No dedup, always insert

---

## Claude's Discretion

- Exact score-to-quality mapping formula adjustments
- Implementation details of auto-fix on read

## Deferred Ideas

None — discussion stayed within phase scope.
