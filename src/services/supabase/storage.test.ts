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
 * Track all insert calls per table for assertions.
 */
function setupFromMock(tableConfigs: Record<string, {
  existingReviews?: Array<{ date: string; score: number }>;
  existingEval?: boolean;
  reviewInsertError?: string;
}> = {}) {
  const insertCalls: Record<string, unknown[][]> = {};

  (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
    const config = tableConfigs[table] || {};

    // Create a chainable object: any method call returns another chainable
    // that is also a Promise (resolves to { data, error })
    const chainable = (result: unknown): Record<string, unknown> => {
      const proxy: Record<string, unknown> = {};

      // Make it thenable (acts as a Promise)
      proxy.then = (resolve: (v: unknown) => unknown) => resolve(result);
      proxy.catch = () => undefined;

      // Dynamic method support via explicit chainable methods
      proxy.eq = vi.fn((..._args: unknown[]) => {
        // For card_reviews select().eq('card_id', ...) - return existing reviews
        if (table === 'card_reviews') {
          return chainable({ data: config.existingReviews || [], error: null });
        }
        return chainable(result);
      });

      proxy.maybeSingle = vi.fn(() => {
        if (table === 'card_evaluations') {
          return chainable({
            data: config.existingEval ? { id: 'eval-1' } : null,
            error: null,
          });
        }
        return chainable({ data: null, error: null });
      });

      proxy.select = vi.fn(() => chainable({ data: [], error: null }));

      proxy.update = vi.fn(() => chainable({ error: null }));

      proxy.insert = vi.fn((data: unknown) => {
        // Track insert calls
        if (!insertCalls[table]) insertCalls[table] = [];
        insertCalls[table].push(Array.isArray(data) ? data : [data]);

        if (table === 'card_reviews' && config.reviewInsertError) {
          return chainable({ error: { message: config.reviewInsertError } });
        }
        return chainable({ error: null });
      });

      return proxy;
    };

    // Return a fresh chainable for this table
    return chainable({ error: null });
  });

  return {
    getInsertCalls: (table: string) => insertCalls[table] || [],
  };
}

describe('updateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when card has reviews, inserts new reviews into card_reviews table', async () => {
    const { getInsertCalls } = setupFromMock({
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
    const calls = getInsertCalls('card_reviews');
    expect(calls.length).toBeGreaterThan(0);
  });

  it('skips reviews already present in card_reviews (dedup by date+score)', async () => {
    const { getInsertCalls } = setupFromMock({
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

    // Insert should be called with only the new review (not the duplicate)
    const calls = getInsertCalls('card_reviews');
    expect(calls.length).toBeGreaterThan(0);
    const inserted = calls[0] as Array<Record<string, unknown>>;
    expect(inserted.length).toBe(1);
    expect(inserted[0].score).toBe(6);
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
