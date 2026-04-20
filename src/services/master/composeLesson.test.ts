import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../openai', () => ({
  chatCompletion: vi.fn(),
}));

vi.mock('../runtimeConfigSnapshot', () => ({
  masterEnabled: vi.fn(),
}));

vi.mock('../masterTelemetry', () => ({
  recordMasterUsage: vi.fn().mockResolvedValue(undefined),
}));

import { composeLesson, coerceLessonPlan } from './composeLesson';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { LessonCandidate } from './lessonTriggers';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

const CANDIDATE: LessonCandidate = {
  candidate_pattern: 'past_continuous_in_interrupted_narrative',
  trigger_type: 'chronic',
  reason: 'test',
};

function goodPlanJson(target: string, title = 'An interrupted Saturday morning'): string {
  return JSON.stringify({
    title_thematic: title,
    target_canonical_pattern: target,
    engagement_context: { theme: 'weekend', tone_hint: 'casual' },
    expected_difficulty_curve: [0.2, 0.4, 0.6, 0.7, 0.5],
    moments: [
      { index: 1, role: 'hook', duration_minutes: 2, adaptation_rules: 'invite a short story.' },
      { index: 2, role: 'noticing', duration_minutes: 3, adaptation_rules: 'show 3 pairs.' },
      { index: 3, role: 'controlled_practice', duration_minutes: 4, adaptation_rules: 'drill twice.' },
      { index: 4, role: 'free_production', duration_minutes: 4, adaptation_rules: 'open-ended.' },
      { index: 5, role: 'consolidation', duration_minutes: 2, adaptation_rules: 'reveal + recap.' },
    ],
  });
}

describe('Master.compose_lesson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const plan = await composeLesson({
      learnerModel: createDiagnosticModel('2026-04-20T00:00:00Z'),
      candidate: CANDIDATE,
    });
    expect(plan).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('parses a well-formed plan', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(goodPlanJson(CANDIDATE.candidate_pattern));
    const plan = await composeLesson({
      learnerModel: createDiagnosticModel('2026-04-20T00:00:00Z'),
      candidate: CANDIDATE,
    });
    expect(plan).not.toBeNull();
    expect(plan?.title_thematic).toBe('An interrupted Saturday morning');
    expect(plan?.moments).toHaveLength(5);
    expect(plan?.moments.map((m) => m.role)).toEqual([
      'hook',
      'noticing',
      'controlled_practice',
      'free_production',
      'consolidation',
    ]);
  });

  it('rejects a plan whose title leaks grammar labels', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(
      goodPlanJson(CANDIDATE.candidate_pattern, 'Past continuous masterclass'),
    );
    const plan = await composeLesson({
      learnerModel: createDiagnosticModel('2026-04-20T00:00:00Z'),
      candidate: CANDIDATE,
    });
    expect(plan).toBeNull();
  });

  it('rejects a plan whose target_canonical_pattern does not match the candidate', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(goodPlanJson('different_pattern_id'));
    const plan = await composeLesson({
      learnerModel: createDiagnosticModel('2026-04-20T00:00:00Z'),
      candidate: CANDIDATE,
    });
    expect(plan).toBeNull();
  });

  it('rejects malformed JSON', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue('{not json');
    const plan = await composeLesson({
      learnerModel: createDiagnosticModel('2026-04-20T00:00:00Z'),
      candidate: CANDIDATE,
    });
    expect(plan).toBeNull();
  });

  it('coerceLessonPlan rejects wrong moment order', () => {
    const bad = JSON.parse(goodPlanJson('x'));
    // swap moment 2 and 3 roles
    [bad.moments[1].role, bad.moments[2].role] = [bad.moments[2].role, bad.moments[1].role];
    expect(coerceLessonPlan(bad, 'x')).toBeNull();
  });

  it('coerceLessonPlan rejects total-duration outliers', () => {
    const bad = JSON.parse(goodPlanJson('x'));
    bad.moments.forEach((m: { duration_minutes: number }) => {
      m.duration_minutes = 10;
    });
    expect(coerceLessonPlan(bad, 'x')).toBeNull();
  });
});
