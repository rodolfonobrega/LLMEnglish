import { describe, it, expect } from 'vitest';

import {
  CANONICAL_PATTERNS,
  buildPatternFromCanonicalId,
  getCanonicalPattern,
  listCanonicalPatterns,
  slugifyPatternId,
  softFallbackPattern,
} from './patterns';

describe('canonical patterns catalogue', () => {
  it('has unique ids', () => {
    const ids = CANONICAL_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exposes the catalogue through listCanonicalPatterns', () => {
    expect(listCanonicalPatterns()).toBe(CANONICAL_PATTERNS);
  });

  it('uses snake_case ids without uppercase or spaces', () => {
    for (const pattern of CANONICAL_PATTERNS) {
      expect(pattern.id).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe('getCanonicalPattern', () => {
  it('returns the entry for a known id', () => {
    const pattern = getCanonicalPattern('past_continuous_in_interrupted_narrative');
    expect(pattern?.category).toBe('verb-tense');
    expect(pattern?.cefr).toBe('B1');
  });

  it('returns undefined for unknown ids', () => {
    expect(getCanonicalPattern('definitely_not_a_pattern')).toBeUndefined();
  });
});

describe('buildPatternFromCanonicalId', () => {
  it('resolves a known id to its label and category', () => {
    const result = buildPatternFromCanonicalId('article_a_vs_an');
    expect(result).toMatchObject({
      id: 'article_a_vs_an',
      category: 'article',
    });
    expect(result.label).toMatch(/a vs\. an/i);
  });

  it('preserves an unknown id and humanises the label under the `other` bucket', () => {
    const result = buildPatternFromCanonicalId('subjunctive_in_conditional_clauses');
    expect(result.id).toBe('subjunctive_in_conditional_clauses');
    expect(result.category).toBe('other');
    expect(result.label).toBe('subjunctive in conditional clauses');
  });
});

describe('softFallbackPattern', () => {
  it('builds distinct ids for different tips in the same category', () => {
    const a = softFallbackPattern("Use 'in' instead of 'on'", 'preposition');
    const b = softFallbackPattern("Use 'at' instead of 'on'", 'preposition');
    expect(a.id).not.toBe(b.id);
    expect(a.category).toBe('preposition');
    expect(b.category).toBe('preposition');
  });

  it('truncates very long tips in the visible label', () => {
    const tip = 'Very long tip '.repeat(20);
    const result = softFallbackPattern(tip, 'grammar');
    expect(result.label.length).toBeLessThanOrEqual(80);
  });
});

describe('slugifyPatternId', () => {
  it('collapses whitespace and punctuation', () => {
    expect(slugifyPatternId("I like it, don't you?")).toBe('i_like_it_don_t_you');
  });

  it('falls back to "unclassified" for empty input', () => {
    expect(slugifyPatternId('')).toBe('unclassified');
  });
});
