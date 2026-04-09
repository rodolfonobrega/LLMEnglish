import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
vi.mock('./client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auth
vi.mock('./auth', () => ({
  getCurrentUser: vi.fn(() => ({ id: 'test-user-id' })),
}));

import { updateCard } from './storage';
import { supabase } from './client';
import type { Card } from '../../types/card';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    type: 'phrase',
    prompt: 'Translate this',
    theme: 'grammar',
    context: 'verb tenses',
    createdAt: new Date().toISOString(),
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    reviews: [],
    latestEvaluation: {
      score: 6,
      userTranscription: 'I goed to store',
      correctedVersion: 'I went to the store',
      corrections: ['Use "went"'],
      betterAlternatives: [],
      overallFeedback: 'Good attempt',
    },
    ...overrides,
  };
}

/**
 * Build a mock Supabase query chain that supports arbitrary nesting.
 * Usage: setupFromMock({ 'card_reviews': { existingReviews: [...] } })
 */
function setupFromMock(tableConfigs: Record<string, {
  existingReviews?: Array<{ date: string; score: number }>;
  existingEval?: boolean;
  reviewInsertError?: string;
}>) {
  const insertSpies: Record<string, ReturnType<typeof vi.fn>> = {};

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    const config = tableConfigs[table] || {};

    // Create a recursive chain builder that supports .eq().eq()... chaining
    const promiseResult = (value: unknown) => Promise.resolve(value);

    const buildChain = (): Record<string, unknown> => {
      const chain: Record<string, unknown> = {};

      chain.eq = vi.fn(() => {
        // After eq, return another chainable that also has eq/select/etc
        const next = buildChain();
        // eq on update/select also eventually resolves
        return Object.assign(promiseResult({ error: null, data: null }), next);
      });

      chain.maybeSingle = vi.fn(() => {
        if (table === 'card_evaluations') {
          return promiseResult({
            data: config.existingEval ? { id: 'eval-1' } : null,
            error: null,
          });
        }
        return promiseResult({ data: null, error: null });
      });

      chain.select = vi.fn(() => {
        const selectChain: Record<string, unknown> = {};

        selectChain.eq = vi.fn(() => {
          // For card_reviews select, return existing reviews
          if (table === 'card_reviews') {
            return promiseResult({
              data: config.existingReviews || [],
              error: null,
            });
          }
          // For card_evaluations select, chain to maybeSingle
          if (table === 'card_evaluations') {
            const evalChain: Record<string, unknown> = {};
            evalChain.eq = vi.fn(() => {
              const innerChain: Record<string, unknown> = {};
              innerChain.maybeSingle = chain.maybeSingle;
              return Object.assign(promiseResult({ data: null, error: null }), innerChain);
            });
            return Object.assign(promiseResult({ data: null, error: null }), evalChain);
          }
          return promiseResult({ data: [], error: null });
        });

        return Object.assign(promiseResult({ data: [], error: null }), selectChain);
      });

      chain.update = vi.fn(() => {
        const updateChain: Record<string, unknown> = {};
        updateChain.eq = vi.fn(() => {
          // Support double .eq() chaining for cards update
          const nextEq: Record<string, unknown> = {};
          nextEq.eq = vi.fn(() => promiseResult({ error: null }));
          return Object.assign(promiseResult({ error: null }), nextEq);
        });
        return Object.assign(promiseResult({ error: null }), updateChain);
      });

      chain.insert = vi.fn(() => {
        if (table === 'card_reviews' && config.reviewInsertError) {
          return promiseResult({ error: { message: config.reviewInsertError } });
        }
        return promiseResult({ error: null });
      });

      return chain;
    });

    const chain = buildChain();
    // Track insert spy for assertions
    insertSpies[table] = chain.insert as ReturnType<typeof vi.fn>;
    return chain;
  });

  return insertSpies;
}

describe('updateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when card has reviews, inserts new reviews into card_reviews table', async () => {
    const spies = setupFromMock({
      cards: {},
      card_evaluations: {},
      card_reviews: {},
    });

    const card = makeCard({
      reviews: [
        { date: '2026-04-09T00:00:00Z', score: 5, userTranscription: 'I goed to store' },
        { date: '2026-04-09T01:00:00Z', score: 6, userTranscription: 'I went to the store' },
      ],
    });

    await updateCard(card);

    // card_reviews insert should have been called
    expect(spies['card_reviews']).toHaveBeenCalled();
  });

  it('skips reviews already present in card_reviews (dedup by date+score)', async () => {
    const spies = setupFromMock({
      cards: {},
      card_evaluations: {},
      card_reviews: {
        existingReviews: [{ date: '2026-04-09T00:00:00Z', score: 5 }],
      },
    });

    const card = makeCard({
      reviews: [
        // This one is already in DB (same date+score)
        { date: '2026-04-09T00:00:00Z', score: 5, userTranscription: 'I goed to store' },
        // This one is new
        { date: '2026-04-09T01:00:00Z', score: 6, userTranscription: 'I went to the store' },
      ],
    });

    await updateCard(card);

    // Insert should be called, but only with the new review (not the duplicate)
    expect(spies['card_reviews']).toHaveBeenCalled();
    const insertCall = spies['card_reviews'].mock.calls[0][0];
    // The insert should contain only the new review
    if (Array.isArray(insertCall)) {
      expect(insertCall.length).toBe(1);
      expect(insertCall[0].score).toBe(6);
    }
  });

  it('card_reviews insert failure does not throw (non-blocking, logs error)', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    setupFromMock({
      cards: {},
      card_evaluations: {},
      card_reviews: {
        reviewInsertError: 'Insert failed',
      },
    });

    const card = makeCard({
      reviews: [
        { date: '2026-04-09T00:00:00Z', score: 5, userTranscription: 'test' },
      ],
    });

    // Should NOT throw even though card_reviews insert fails
    await expect(updateCard(card)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to persist reviews:',
      'Insert failed',
    );

    consoleErrorSpy.mockRestore();
  });
});
