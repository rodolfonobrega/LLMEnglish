import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSelect = vi.fn(() => Promise.resolve({ data: [], error: null }));
const mockInsert = vi.fn(() => Promise.resolve({ error: null }));
const mockUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}));
const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));

const mockFrom = vi.fn((table: string) => {
  if (table === 'card_reviews') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      insert: mockInsert,
    };
  }
  if (table === 'card_evaluations') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    };
  }
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  };
});

vi.mock('./client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// Mock auth
vi.mock('./auth', () => ({
  getCurrentUser: vi.fn(() => ({ id: 'test-user-id' })),
}));

import { updateCard } from './storage';
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

describe('updateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when card has reviews, inserts new reviews into card_reviews table', async () => {
    const card = makeCard({
      reviews: [
        { date: '2026-04-09T00:00:00Z', score: 5, userTranscription: 'I goed to store' },
        { date: '2026-04-09T01:00:00Z', score: 6, userTranscription: 'I went to the store' },
      ],
    });

    await updateCard(card);

    // card_reviews insert should have been called
    expect(mockFrom).toHaveBeenCalledWith('card_reviews');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('skips reviews already present in card_reviews (dedup by date+score)', async () => {
    // Simulate existing reviews in DB
    const existingReview = { date: '2026-04-09T00:00:00Z', score: 5 };
    const mockCardReviewsSelect = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({
        data: [existingReview],
        error: null,
      })),
    }));

    // Override mockFrom for card_reviews to return existing data
    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_reviews') {
        return {
          select: mockCardReviewsSelect,
          insert: mockInsert,
        };
      }
      if (table === 'card_evaluations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
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
    expect(mockInsert).toHaveBeenCalled();
    const insertCall = mockInsert.mock.calls[0][0];
    // The insert should contain only the new review
    if (Array.isArray(insertCall)) {
      expect(insertCall.length).toBe(1);
      expect(insertCall[0].score).toBe(6);
    }
  });

  it('card_reviews insert failure does not throw (non-blocking, logs error)', async () => {
    // Make card_reviews insert fail
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_reviews') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: { message: 'Insert failed' } })),
        };
      }
      if (table === 'card_evaluations') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
      };
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
