import { beforeEach, describe, expect, it } from 'vitest';

import {
  detectFrustrationPatches,
  pushFrustrationSample,
  resetFrustrationState,
} from './updateModel';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { EvaluationResult } from '../../types/card';
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
