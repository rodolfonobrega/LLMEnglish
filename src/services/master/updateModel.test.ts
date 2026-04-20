import { beforeEach, describe, expect, it } from 'vitest';

import {
  detectFrustrationPatches,
  pushFrustrationSample,
  resetFrustrationState,
  buildLessonBoostPatches,
  computeLessonDeltaScore,
} from './updateModel';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { EvaluationResult } from '../../types/card';
import type { LearnerModel, MomentSignal } from '../../types/learnerModel';
import type { MetaAssessment } from './evaluate';

function makeMeta(
  goalMet: boolean,
  engagement: MetaAssessment['engagement_signal'],
): MetaAssessment {
  return {
    goal_met: goalMet,
    unexpected_errors: [],
    engagement_signal: engagement,
    relevant_correction_ids: [],
    recommendation: goalMet ? 'advance' : 'step_back',
  };
}

function makeEval(primaryScore: number): EvaluationResult {
  return {
    score: Math.round(primaryScore / 10),
    userTranscription: '',
    correctedVersion: '',
    betterAlternatives: [],
    scores5d: {
      naturalness: primaryScore,
      accuracy: primaryScore,
      fluency: primaryScore,
      pragmatics: primaryScore,
      completeness: primaryScore,
    },
    primaryDimension: 'accuracy',
    corrections: [],
    overallFeedback: '',
  };
}

function seedSessions(
  userId: string,
  sessions: Array<{
    goalMet: boolean;
    primaryScore: number;
    engagement: MetaAssessment['engagement_signal'];
  }>,
): void {
  for (const s of sessions) {
    pushFrustrationSample(userId, makeMeta(s.goalMet, s.engagement), makeEval(s.primaryScore));
  }
}

describe('frustration detection', () => {
  beforeEach(() => {
    resetFrustrationState();
  });

  it('returns no patches when the rolling window is empty', () => {
    expect(detectFrustrationPatches('u1', createDiagnosticModel())).toEqual([]);
  });

  it('detects three consecutive misses and emits engagement + plan patches', () => {
    seedSessions('u1', [
      { goalMet: false, primaryScore: 55, engagement: 'medium' },
      { goalMet: false, primaryScore: 50, engagement: 'medium' },
      { goalMet: false, primaryScore: 45, engagement: 'medium' },
    ]);
    const patches = detectFrustrationPatches('u1', createDiagnosticModel());
    expect(patches.some((p) => p.op === 'engagement.update')).toBe(true);
    const planPatch = patches.find((p) => p.op === 'plan.set');
    expect(planPatch).toBeTruthy();
    if (planPatch && planPatch.op === 'plan.set') {
      expect(planPatch.plan.expected_difficulty).toBe('easy');
    }
  });

  it('detects a low rolling primary score', () => {
    seedSessions('u1', [
      { goalMet: true, primaryScore: 30, engagement: 'medium' },
      { goalMet: true, primaryScore: 35, engagement: 'medium' },
      { goalMet: true, primaryScore: 30, engagement: 'medium' },
    ]);
    expect(detectFrustrationPatches('u1', createDiagnosticModel()).length).toBeGreaterThan(0);
  });

  it('detects a downward engagement trend (high → frustrated)', () => {
    seedSessions('u1', [
      { goalMet: true, primaryScore: 60, engagement: 'high' },
      { goalMet: true, primaryScore: 58, engagement: 'low' },
      { goalMet: true, primaryScore: 55, engagement: 'frustrated' },
    ]);
    expect(detectFrustrationPatches('u1', createDiagnosticModel()).length).toBeGreaterThan(0);
  });

  it('stays healthy and emits nothing when sessions are clean', () => {
    seedSessions('u1', [
      { goalMet: true, primaryScore: 80, engagement: 'high' },
      { goalMet: true, primaryScore: 75, engagement: 'high' },
      { goalMet: true, primaryScore: 82, engagement: 'medium' },
    ]);
    expect(detectFrustrationPatches('u1', createDiagnosticModel())).toEqual([]);
  });

  it('keeps per-user windows independent', () => {
    seedSessions('u1', [
      { goalMet: false, primaryScore: 40, engagement: 'frustrated' },
      { goalMet: false, primaryScore: 30, engagement: 'frustrated' },
      { goalMet: false, primaryScore: 35, engagement: 'frustrated' },
    ]);
    seedSessions('u2', [
      { goalMet: true, primaryScore: 85, engagement: 'high' },
      { goalMet: true, primaryScore: 90, engagement: 'high' },
    ]);
    expect(detectFrustrationPatches('u1', createDiagnosticModel()).length).toBeGreaterThan(0);
    expect(detectFrustrationPatches('u2', createDiagnosticModel())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Wave 6 Stage B — lesson boost patches
// ---------------------------------------------------------------------------

function signal(
  goalMet: boolean,
  difficulty: MomentSignal['difficulty_actual'],
  engagement: MomentSignal['engagement_observed'],
): MomentSignal {
  return {
    goal_met: goalMet,
    difficulty_actual: difficulty,
    observed_issues: [],
    notable_successes: [],
    engagement_observed: engagement,
  };
}

describe('lesson-boost patch builder', () => {
  const baseModel: LearnerModel = {
    ...createDiagnosticModel(),
    acquiring_patterns: [
      {
        id: 'past_continuous_in_interrupted_narrative',
        success_rate: 0.7,
        attempts: 4,
        last_seen: '2026-04-18T00:00:00Z',
      },
    ],
  };

  it('emits evidence, plan and consolidation_until patches on a healthy boost', () => {
    const patches = buildLessonBoostPatches(baseModel, {
      target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
      rounds: 3,
      baseline_signal: signal(false, 'hard', 'medium'),
      final_signal: signal(true, 'ok', 'high'),
      delta_score: 0.3,
    });

    const acquiring = patches.find(
      (p) => p.op === 'acquiring.upsert' && p.id === 'past_continuous_in_interrupted_narrative',
    );
    expect(acquiring).toBeTruthy();
    // attempts should go up by rounds*2 = 6
    if (acquiring && acquiring.op === 'acquiring.upsert') {
      expect(acquiring.attempts).toBe(4 + 6);
    }
    const plan = patches.find((p) => p.op === 'plan.set');
    expect(plan).toBeTruthy();
    if (plan && plan.op === 'plan.set') {
      expect(plan.plan.primary_goal).toBe('past_continuous_in_interrupted_narrative');
      expect(plan.plan.consolidation_until).toBeTruthy();
    }
    // No hard_for_user with a positive delta and healthy engagement.
    expect(patches.some((p) => p.op === 'hard_for_user.upsert')).toBe(false);
  });

  it('promotes to mastered when the boost crosses the mastery bar', () => {
    const warmModel: LearnerModel = {
      ...baseModel,
      acquiring_patterns: [
        {
          id: 'past_continuous_in_interrupted_narrative',
          success_rate: 0.72,
          attempts: 4,
          last_seen: '2026-04-18T00:00:00Z',
        },
      ],
    };
    const patches = buildLessonBoostPatches(warmModel, {
      target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
      rounds: 3,
      baseline_signal: signal(false, 'hard', 'medium'),
      final_signal: signal(true, 'ok', 'high'),
      delta_score: 0.15,
    });
    expect(patches.some((p) => p.op === 'mastered.add')).toBe(true);
    expect(patches.some((p) => p.op === 'acquiring.remove')).toBe(true);
  });

  it('flags hard_for_user when delta is weak', () => {
    const patches = buildLessonBoostPatches(baseModel, {
      target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
      rounds: 3,
      baseline_signal: signal(false, 'hard', 'medium'),
      final_signal: signal(false, 'hard', 'medium'),
      delta_score: 0.01,
    });
    const hard = patches.find((p) => p.op === 'hard_for_user.upsert');
    expect(hard).toBeTruthy();
  });

  it('flags hard_for_user when engagement observed is frustrated, even with good delta', () => {
    const patches = buildLessonBoostPatches(baseModel, {
      target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
      rounds: 3,
      baseline_signal: signal(false, 'hard', 'medium'),
      final_signal: signal(true, 'ok', 'frustrated'),
      delta_score: 0.2,
    });
    expect(patches.some((p) => p.op === 'hard_for_user.upsert')).toBe(true);
  });
});

describe('computeLessonDeltaScore', () => {
  it('is positive when final signal is stronger than baseline', () => {
    const baseline = signal(false, 'hard', 'low');
    const final = signal(true, 'ok', 'high');
    expect(computeLessonDeltaScore(baseline, final)).toBeGreaterThan(0);
  });
  it('is near zero when signals match', () => {
    const same = signal(true, 'ok', 'medium');
    expect(computeLessonDeltaScore(same, same)).toBe(0);
  });
  it('is negative when final is weaker', () => {
    const baseline = signal(true, 'easy', 'high');
    const final = signal(false, 'hard', 'low');
    expect(computeLessonDeltaScore(baseline, final)).toBeLessThan(0);
  });
});
