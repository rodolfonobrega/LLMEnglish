/**
 * Master.patternReview — Phase 9 (F-P9-05).
 *
 * Sometimes the right review isn't "variant-of-one-card"; it's
 * **coverage-of-one-pattern**. When the SRS queue has ≥ 3 cards
 * tagged with the same `canonical_pattern`, we can collapse them
 * into a single "pattern review" session: the student practices
 * that pattern 3 times, each in a different theme. All three
 * cards count as reviewed.
 *
 * This module is a pure helper. It does NOT decide whether pattern
 * review is offered (that's a Phase 3 opt-in flag in Settings). It
 * only groups the queue and exposes a session-builder that plays
 * well with `varyCard`.
 */

import type { Card } from '../../types/card';

export interface PatternReviewGroup {
  canonical_pattern: string;
  /** Cards sharing this pattern, ordered by the original queue. */
  cards: Card[];
  /**
   * Distinct themes already covered by these cards' current state
   * (card.theme). Used downstream to bias `varyCard` away from them.
   */
  existing_themes: string[];
}

/**
 * Minimum number of cards tagged with the same canonical pattern
 * required to collapse them into a pattern review session. Chosen to
 * match the ≥3 themes requirement in Phase 7's mastery gate.
 */
export const MIN_CARDS_FOR_PATTERN_REVIEW = 3;

/**
 * Group the due queue by `canonical_pattern`. Cards without a pattern
 * are skipped (they can't participate in pattern review — they'll be
 * handled by the standard per-card flow).
 *
 * The returned groups are sorted by group size descending, then by
 * earliest `nextReviewAt` so the most "urgent" group goes first.
 */
export function groupCardsByPattern(cards: Card[]): PatternReviewGroup[] {
  const byPattern = new Map<string, Card[]>();
  for (const card of cards) {
    const key = card.canonical_pattern;
    if (!key) continue;
    const bucket = byPattern.get(key);
    if (bucket) bucket.push(card);
    else byPattern.set(key, [card]);
  }

  const groups: PatternReviewGroup[] = [];
  for (const [canonical, bucket] of byPattern.entries()) {
    if (bucket.length < MIN_CARDS_FOR_PATTERN_REVIEW) continue;
    const existingThemes = Array.from(
      new Set(
        bucket
          .map((c) => c.theme?.trim().toLowerCase())
          .filter((t): t is string => !!t && t.length > 0),
      ),
    );
    groups.push({
      canonical_pattern: canonical,
      cards: bucket,
      existing_themes: existingThemes,
    });
  }

  groups.sort((a, b) => {
    if (b.cards.length !== a.cards.length) return b.cards.length - a.cards.length;
    const aEarliest = earliestReview(a.cards);
    const bEarliest = earliestReview(b.cards);
    return aEarliest.localeCompare(bEarliest);
  });

  return groups;
}

/**
 * Build an ordered list of cards for a pattern-review session, picking
 * up to `count` cards from the group. Prefers cards whose current
 * `theme` has NOT been covered yet in this session, so each slot
 * genuinely varies the surface.
 *
 * Pure, deterministic — no LLM call. Actual prompt variation is done
 * downstream by `varyCard` once the session runs.
 */
export function buildPatternReviewSession(
  group: PatternReviewGroup,
  count: number,
): Card[] {
  if (group.cards.length === 0) return [];
  const out: Card[] = [];
  const usedThemes = new Set<string>();

  // First pass: take one card per distinct theme until the quota is met.
  for (const card of group.cards) {
    if (out.length >= count) break;
    const theme = card.theme?.trim().toLowerCase() ?? '';
    if (theme && usedThemes.has(theme)) continue;
    out.push(card);
    if (theme) usedThemes.add(theme);
  }

  // Second pass: if we still need more cards, accept duplicates of a
  // theme rather than leaving the session short.
  if (out.length < count) {
    for (const card of group.cards) {
      if (out.length >= count) break;
      if (out.includes(card)) continue;
      out.push(card);
    }
  }

  return out;
}

function earliestReview(cards: Card[]): string {
  let earliest = '';
  for (const c of cards) {
    const t = c.nextReviewAt ?? c.createdAt ?? '';
    if (!earliest || (t && t < earliest)) earliest = t;
  }
  return earliest ?? '';
}
