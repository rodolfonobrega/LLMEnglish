import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockResult<T> = { data: T | null; error: null | { message: string } };

function makeQueryChain(finalResult: MockResult<unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    then: (resolve: (v: MockResult<unknown>) => void) => {
      resolve(finalResult);
      return { catch: () => undefined };
    },
  };
  return chain;
}

const fromMock = vi.fn();

vi.mock('../supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import {
  fetchLiveOffers,
  setOfferStatus,
  createLesson,
  getLesson,
  completeLesson,
  abandonLesson,
} from './lessonService';
import type { LessonPlan } from '../../types/learnerModel';

const PLAN: LessonPlan = {
  title_thematic: 'A saturday morning',
  target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
  engagement_context: { theme: 'weekend', tone_hint: 'casual' },
  expected_difficulty_curve: [0.2, 0.4, 0.6, 0.7, 0.5],
  moments: [
    { index: 1, role: 'hook', duration_minutes: 2, adaptation_rules: 'x' },
    { index: 2, role: 'noticing', duration_minutes: 3, adaptation_rules: 'x' },
    { index: 3, role: 'controlled_practice', duration_minutes: 4, adaptation_rules: 'x' },
    { index: 4, role: 'free_production', duration_minutes: 4, adaptation_rules: 'x' },
    { index: 5, role: 'consolidation', duration_minutes: 2, adaptation_rules: 'x' },
  ],
};

describe('lessonService', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('fetchLiveOffers returns the supabase data as-is', async () => {
    const chain = makeQueryChain({
      data: [{ id: 'o1', status: 'would_offer' }],
      error: null,
    });
    fromMock.mockReturnValue(chain);
    const offers = await fetchLiveOffers('user-1');
    expect(offers).toEqual([{ id: 'o1', status: 'would_offer' }]);
    expect(fromMock).toHaveBeenCalledWith('lesson_offers');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.eq).toHaveBeenCalledWith('dry_run', false);
    expect(chain.eq).toHaveBeenCalledWith('status', 'would_offer');
  });

  it('setOfferStatus sends an update with the new status', async () => {
    const chain = makeQueryChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);
    await setOfferStatus('offer-1', 'accepted');
    expect(chain.update).toHaveBeenCalledWith({ status: 'accepted' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'offer-1');
  });

  it('createLesson inserts an active row and returns it', async () => {
    const chain = makeQueryChain({
      data: { id: 'lesson-1', user_id: 'u', lesson_plan: PLAN, status: 'active' },
      error: null,
    });
    fromMock.mockReturnValue(chain);
    const row = await createLesson('u', PLAN);
    expect(row?.id).toBe('lesson-1');
    expect(chain.insert).toHaveBeenCalledTimes(1);
  });

  it('getLesson returns null on error', async () => {
    const chain = makeQueryChain({ data: null, error: { message: 'not found' } });
    fromMock.mockReturnValue(chain);
    const row = await getLesson('missing');
    expect(row).toBeNull();
  });

  it('completeLesson updates status and delta_score', async () => {
    const chain = makeQueryChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);
    await completeLesson('lesson-1', {
      baseline_utterance: null,
      final_utterance: null,
      delta_score: 0.23,
    });
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('completed');
    expect(updateArg.delta_score).toBeCloseTo(0.23);
  });

  it('abandonLesson sets status to abandoned', async () => {
    const chain = makeQueryChain({ data: null, error: null });
    fromMock.mockReturnValue(chain);
    await abandonLesson('lesson-1');
    expect(chain.update).toHaveBeenCalledWith({ status: 'abandoned' });
  });
});
