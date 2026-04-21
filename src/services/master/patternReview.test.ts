import { describe, expect, it } from 'vitest';

import {
  buildPatternReviewSession,
  groupCardsByPattern,
  MIN_CARDS_FOR_PATTERN_REVIEW,
} from './patternReview';
import type { Card } from '../../types/card';

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id ?? `c-${Math.random().toString(36).slice(2, 8)}`,
    type: 'phrase',
    prompt: 'prompt',
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    reviews: [],
    ...overrides,
  };
}

describe('Master.patternReview', () => {
  it('skips cards without canonical_pattern', () => {
    const cards = [card({ id: 'a' }), card({ id: 'b' })];
    expect(groupCardsByPattern(cards)).toEqual([]);
  });

  it(`requires at least ${MIN_CARDS_FOR_PATTERN_REVIEW} cards per pattern`, () => {
    const cards = [
      card({ id: 'a', canonical_pattern: 'past_continuous_in_interrupted_narrative' }),
      card({ id: 'b', canonical_pattern: 'past_continuous_in_interrupted_narrative' }),
    ];
    expect(groupCardsByPattern(cards)).toEqual([]);
  });

  it('groups cards sharing a pattern when the threshold is met', () => {
    const cards = [
      card({ id: 'a', canonical_pattern: 'p1', theme: 'work' }),
      card({ id: 'b', canonical_pattern: 'p1', theme: 'travel' }),
      card({ id: 'c', canonical_pattern: 'p1', theme: 'food' }),
      card({ id: 'd', canonical_pattern: 'p2' }),
    ];
    const groups = groupCardsByPattern(cards);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.canonical_pattern).toBe('p1');
    expect(groups[0]?.cards).toHaveLength(3);
    expect(groups[0]?.existing_themes.sort()).toEqual(['food', 'travel', 'work']);
  });

  it('orders groups by size desc then by earliest nextReviewAt', () => {
    const cards = [
      card({ id: 'a1', canonical_pattern: 'small', nextReviewAt: '2026-01-01' }),
      card({ id: 'a2', canonical_pattern: 'small', nextReviewAt: '2026-01-02' }),
      card({ id: 'a3', canonical_pattern: 'small', nextReviewAt: '2026-01-03' }),
      card({ id: 'b1', canonical_pattern: 'big', nextReviewAt: '2026-03-01' }),
      card({ id: 'b2', canonical_pattern: 'big', nextReviewAt: '2026-03-02' }),
      card({ id: 'b3', canonical_pattern: 'big', nextReviewAt: '2026-03-03' }),
      card({ id: 'b4', canonical_pattern: 'big', nextReviewAt: '2026-03-04' }),
    ];
    const groups = groupCardsByPattern(cards);
    expect(groups.map((g) => g.canonical_pattern)).toEqual(['big', 'small']);
  });

  it('buildPatternReviewSession prefers distinct themes, then pads from the rest', () => {
    const cards = [
      card({ id: 'a', canonical_pattern: 'p', theme: 'work' }),
      card({ id: 'b', canonical_pattern: 'p', theme: 'travel' }),
      card({ id: 'c', canonical_pattern: 'p', theme: 'travel' }),
      card({ id: 'd', canonical_pattern: 'p', theme: 'food' }),
    ];
    const [group] = groupCardsByPattern(cards);
    expect(group).toBeDefined();
    const session = buildPatternReviewSession(group!, 3);
    expect(session.map((c) => c.id)).toEqual(['a', 'b', 'd']);
  });

  it('buildPatternReviewSession accepts duplicates when distinct themes are insufficient', () => {
    const cards = [
      card({ id: 'a', canonical_pattern: 'p', theme: 'work' }),
      card({ id: 'b', canonical_pattern: 'p', theme: 'work' }),
      card({ id: 'c', canonical_pattern: 'p', theme: 'work' }),
    ];
    const [group] = groupCardsByPattern(cards);
    const session = buildPatternReviewSession(group!, 3);
    expect(session.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});
