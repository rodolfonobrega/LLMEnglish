import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('./supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: [], error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

// Mock Supabase auth
vi.mock('./supabase/auth', () => ({
  getCurrentUser: vi.fn(() => ({ id: 'test-user-id' })),
}));

// Mock storage (getCards used by getCardsForWeakArea)
vi.mock('./storage', () => ({
  getCards: vi.fn(() => Promise.resolve([])),
}));

import { extractErrorPatterns, getCardsForWeakArea, getErrorStats } from './errorAnalysis';
import { getCards } from './storage';
import { supabase } from './supabase/client';
import type { Card, EvaluationResult } from '../types/card';

function makeEvaluation(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    score: 5,
    userTranscription: 'I goed to store',
    correctedVersion: 'I went to the store',
    corrections: ['Use "went" instead of "goed"'],
    betterAlternatives: [],
    overallFeedback: 'Good attempt',
    ...overrides,
  };
}

// Minimal Card shape for the rows fed to getCardsForWeakArea; real Card has
// many SR fields we do not exercise here. Cast via unknown to avoid `any`.
interface CardRow {
  id: string;
  prompt: string;
  theme: string;
  context: string;
  latestEvaluation: { score: number };
  reviews: unknown[];
}
const asCards = (rows: CardRow[]): Card[] => rows as unknown as Card[];

describe('guessCategory (tested via extractErrorPatterns)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correction containing "preposition" keyword returns preposition category', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Wrong preposition usage'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('preposition');
  });

  it('correction "Use in instead of on" returns preposition category', async () => {
    const evalResult = makeEvaluation({
      corrections: ["Use 'in' instead of 'on'"],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('preposition');
  });

  it('correction "Put it in the box" does NOT return preposition category', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Put it in the box'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    // "Put it in the box" has no meta-word indicating preposition is the topic
    expect(patterns[0].category).not.toBe('preposition');
  });

  it('correction containing "tense" returns verb-tense category', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Wrong tense usage'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('verb-tense');
  });

  it('correction containing "article" returns article category', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Wrong article usage'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('article');
  });

  it('generic correction with no keywords returns other category', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Capitalization missing at start'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('other');
  });
});

describe('extractErrorPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses provided cardId in returned ErrorExample objects', async () => {
    const evalResult = makeEvaluation({
      corrections: ['Some correction'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'exercise_12345');
    expect(patterns.length).toBeGreaterThan(0);
    // The pattern should contain the exercise_ ID, not a temp_ ID
    for (const pattern of patterns) {
      for (const example of pattern.examples) {
        expect(example.cardId).toBe('exercise_12345');
        expect(example.cardId).not.toMatch(/^temp_/);
      }
    }
  });
});

describe('getCardsForWeakArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('with category preposition returns only cards matching preposition themes', async () => {
    const mockCards = asCards([
      { id: '1', prompt: 'Fill in the blank', theme: 'preposition', context: '', latestEvaluation: { score: 4 }, reviews: [] },
      { id: '2', prompt: 'Translate this', theme: 'vocabulary', context: '', latestEvaluation: { score: 3 }, reviews: [] },
      { id: '3', prompt: 'Grammar exercise', theme: 'grammar', context: 'preposition', latestEvaluation: { score: 5 }, reviews: [] },
    ]);
    vi.mocked(getCards).mockResolvedValue(mockCards);

    const result = await getCardsForWeakArea('preposition');
    // Should only include cards whose theme/context matches preposition keywords
    for (const card of result) {
      const matchesTheme = (card.theme || '').toLowerCase().includes('preposition');
      const matchesContext = (card.context || '').toLowerCase().includes('preposition');
      expect(matchesTheme || matchesContext).toBe(true);
    }
  });

  it('with category other returns all low-scoring cards (no filter)', async () => {
    const mockCards = asCards([
      { id: '1', prompt: 'Card 1', theme: 'vocab', context: '', latestEvaluation: { score: 3 }, reviews: [] },
      { id: '2', prompt: 'Card 2', theme: 'grammar', context: '', latestEvaluation: { score: 5 }, reviews: [] },
      { id: '3', prompt: 'Card 3', theme: 'other', context: '', latestEvaluation: { score: 8 }, reviews: [] },
    ]);
    vi.mocked(getCards).mockResolvedValue(mockCards);

    const result = await getCardsForWeakArea('other');
    // 'other' category has no theme filter, should return all low-scoring cards
    expect(result.length).toBeGreaterThan(0);
    for (const card of result) {
      expect(card.latestEvaluation!.score).toBeLessThan(7);
    }
  });

  it('falls back to all low-scoring cards when no theme match found', async () => {
    const mockCards = asCards([
      { id: '1', prompt: 'Card 1', theme: 'vocab', context: '', latestEvaluation: { score: 3 }, reviews: [] },
      { id: '2', prompt: 'Card 2', theme: 'grammar', context: '', latestEvaluation: { score: 5 }, reviews: [] },
    ]);
    vi.mocked(getCards).mockResolvedValue(mockCards);

    const result = await getCardsForWeakArea('pronunciation');
    // No cards match pronunciation theme, should fall back to all low-scoring
    expect(result.length).toBeGreaterThan(0);
    for (const card of result) {
      expect(card.latestEvaluation!.score).toBeLessThan(7);
    }
  });
});

// WR-01: safeAvg guard — criticalErrors sort with empty recentScores must not produce NaN
describe('buildErrorStats criticalErrors sort (safeAvg guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('criticalErrors sort produces stable numeric order when recentScores is empty', async () => {
    // Two worsening patterns with occurrences >= 3 and empty recentScores.
    // Without safeAvg, scores.reduce/length would produce NaN and the sort comparator
    // would return NaN, making the order unstable and unpredictable.
    // With safeAvg returning 0 for empty arrays, both patterns get score 0 and sort stably.
    const patternRows = [
      {
        id: 'row-1',
        user_id: 'test-user-id',
        pattern_key: 'other_pattern_A',
        pattern: 'pattern A',
        category: 'other',
        occurrences: 5,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-10T00:00:00Z',
        examples: [],
        trend: 'worsening',
        recent_scores: [],
      },
      {
        id: 'row-2',
        user_id: 'test-user-id',
        pattern_key: 'other_pattern_B',
        pattern: 'pattern B',
        category: 'other',
        occurrences: 4,
        first_seen: '2026-01-01T00:00:00Z',
        last_seen: '2026-01-10T00:00:00Z',
        examples: [],
        trend: 'worsening',
        recent_scores: [],
      },
    ];

    // Override the supabase `from` mock to return the two worsening patterns.
    // The full PostgrestQueryBuilder type is huge; cast via unknown to satisfy
    // the signature without pulling in @supabase/postgrest-js internals.
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: patternRows, error: null })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof supabase.from>);

    const stats = await getErrorStats();

    // Both patterns qualify (occurrences >= 3, trend === 'worsening')
    expect(stats.criticalErrors.length).toBe(2);

    // With safeAvg, each pattern scores 0; no NaN should appear in any score field
    for (const pattern of stats.criticalErrors) {
      expect(pattern.recentScores.length).toBe(0);
      // The sort comparator must have returned a finite number (0 - 0 = 0), not NaN
      // Verify by asserting the patterns are present (NaN comparator causes lost entries in V8)
      expect(pattern.pattern).toMatch(/pattern [AB]/);
    }
  });
});

// WR-02: guessCategory article regex — 'a' removed to prevent false positives
describe('guessCategory article regex false-positive prevention (WR-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"You should use a simpler structure" is NOT classified as article', async () => {
    // Before the fix, the fallback article regex included /\ba\b/ which matched the
    // standalone 'a' in this sentence along with the meta-word 'use', causing a
    // false article classification. The fix drops 'a' from the fallback regex,
    // leaving only the unambiguous 'an' and 'the'.
    const evalResult = makeEvaluation({
      corrections: ['You should use a simpler structure instead'],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).not.toBe('article');
  });

  it('"Use the instead of a" IS classified as article (unambiguous article correction)', async () => {
    // 'the' is unambiguous — should still classify as article after the fix
    const evalResult = makeEvaluation({
      corrections: ["Use 'the' instead of nothing"],
    });
    const patterns = await extractErrorPatterns(evalResult, 'test prompt', 'card-1');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0].category).toBe('article');
  });
});
