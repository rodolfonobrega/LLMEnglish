import type { Card } from '../types/card';

/**
 * SM-2 Spaced Repetition Algorithm
 * Updates card scheduling based on user performance (score 0-10 mapped to quality 0-5).
 */
export function updateCardSchedule(card: Card, score: number): Card {
  // Map score (0-10) to quality (0-5)
  const quality = Math.round((score / 10) * 5);

  let { easeFactor, interval, repetitions } = card;

  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    // Incorrect response — reset
    repetitions = 0;
    interval = 1;
  }

  // Update ease factor
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

/**
 * Create a new card with default SM-2 values.
 */
export function createDefaultCard(partial: Omit<Card, 'id' | 'easeFactor' | 'interval' | 'repetitions' | 'reviews' | 'createdAt'>): Card {
  return {
    ...partial,
    id: crypto.randomUUID(),
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    reviews: [],
    createdAt: new Date().toISOString(),
  };
}
