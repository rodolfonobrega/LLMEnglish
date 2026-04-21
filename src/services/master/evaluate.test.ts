import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../openai', () => ({
  chatCompletion: vi.fn(),
}));

vi.mock('../runtimeConfigSnapshot', async () => {
  const actual =
    await vi.importActual<typeof import('../runtimeConfigSnapshot')>(
      '../runtimeConfigSnapshot',
    );
  return {
    ...actual,
    masterEnabled: vi.fn(),
  };
});

vi.mock('../masterTelemetry', () => ({
  recordMasterUsage: vi.fn().mockResolvedValue(undefined),
}));

import { masterEvaluate } from './evaluate';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { EvaluationResult } from '../../types/card';
import type { Briefing } from '../../types/master';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

const BRIEFING: Briefing = {
  target_skill: 'past_continuous_in_interrupted_narrative',
  modality_choice: 'phrase',
  disguise_theme: 'weekend plans',
  required_elements: ['ongoing action interrupted by another event'],
  forbidden_elements: [],
  success_criteria: 'Uses past continuous + an interruption.',
  expected_difficulty: 'slight_stretch',
};

const EVALUATION: EvaluationResult = {
  score: 7,
  userTranscription: 'I was watching TV when he arrived.',
  correctedVersion: 'I was watching TV when he arrived.',
  betterAlternatives: [],
  scores5d: {
    naturalness: 70,
    accuracy: 80,
    fluency: 72,
    pragmatics: 70,
    completeness: 75,
  },
  primaryDimension: 'accuracy',
  corrections: [{ tip: 'watch out for article', canonical_pattern: 'article_a_vs_the' }],
  overallFeedback: 'Nice job.',
};

describe('Master.evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const result = await masterEvaluate({
      briefing: BRIEFING,
      evaluationResult: EVALUATION,
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('parses a valid MetaAssessment', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        goal_met: true,
        reason: 'Interrupted ongoing action present.',
        unexpected_errors: [],
        engagement_signal: 'high',
        relevant_correction_ids: [],
        recommendation: 'advance',
      }),
    );
    const meta = await masterEvaluate({
      briefing: BRIEFING,
      evaluationResult: EVALUATION,
      learnerModel: createDiagnosticModel(),
    });
    expect(meta).not.toBeNull();
    expect(meta!.goal_met).toBe(true);
    expect(meta!.engagement_signal).toBe('high');
    expect(meta!.recommendation).toBe('advance');
  });

  it('rejects unknown engagement_signal values', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        goal_met: true,
        unexpected_errors: [],
        engagement_signal: 'nervous',
        relevant_correction_ids: [],
        recommendation: 'advance',
      }),
    );
    const meta = await masterEvaluate({
      briefing: BRIEFING,
      evaluationResult: EVALUATION,
      learnerModel: createDiagnosticModel(),
    });
    expect(meta).toBeNull();
  });

  it('rejects unknown recommendation values', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        goal_met: true,
        unexpected_errors: [],
        engagement_signal: 'high',
        relevant_correction_ids: [],
        recommendation: 'explore_widely',
      }),
    );
    const meta = await masterEvaluate({
      briefing: BRIEFING,
      evaluationResult: EVALUATION,
      learnerModel: createDiagnosticModel(),
    });
    expect(meta).toBeNull();
  });

  it('returns null on malformed JSON', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce('not-json');
    const meta = await masterEvaluate({
      briefing: BRIEFING,
      evaluationResult: EVALUATION,
      learnerModel: createDiagnosticModel(),
    });
    expect(meta).toBeNull();
  });
});
