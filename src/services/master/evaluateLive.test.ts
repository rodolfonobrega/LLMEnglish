import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    masterEnabled: vi.fn(() => true),
  };
});

vi.mock('../masterTelemetry', () => ({
  recordMasterUsage: vi.fn(async () => undefined),
}));

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { masterEvaluateLive } from './evaluateLive';
import type { LearnerModel } from '../../types/learnerModel';
import type { ConversationTurn, LiveScenario } from '../../types/scenario';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

function baseModel(): LearnerModel {
  return {
    cefr_estimate: { level: 'B1', confidence: 0.5 },
    mastered_patterns: [],
    acquiring_patterns: [{ id: 'past_continuous', success_rate: 0.6, attempts: 4, last_seen: '' }],
    chronic_errors: [],
    strengths: [],
    engagement_profile: {
      themes_that_land: [],
      themes_that_flop: [],
      last_session_engagement: 'medium',
    },
    next_step_plan: {
      primary_goal: 'past_continuous',
      expected_difficulty: 'slight_stretch',
      rationale: '',
    },
    diagnostic_mode: false,
    confidence: 0.5,
    meta: {
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
      schema_version: 1,
    },
  };
}

function baseScenario(mode: 'standard' | 'mini' = 'standard'): LiveScenario {
  return {
    id: 'sc-1',
    theme: 'Workplace',
    intensity: 'normal',
    descriptionPt: '',
    systemPrompt: '',
    userRole: 'employee',
    aiRole: 'manager',
    mode,
  };
}

function baseTurns(): ConversationTurn[] {
  return [
    { role: 'ai', text: 'Good morning, how did the project go?', timestamp: 1000 },
    { role: 'user', text: 'I was working on the report yesterday.', timestamp: 3000 },
    { role: 'ai', text: 'Nice. What happened?', timestamp: 5000 },
    { role: 'user', text: 'Then suddenly my computer crashed.', timestamp: 7000 },
  ];
}

beforeEach(() => {
  chatCompletionMock.mockReset();
  masterEnabledMock.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('masterEvaluateLive', () => {
  it('returns null when master flag is off', async () => {
    masterEnabledMock.mockReturnValue(false);
    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });
    expect(result).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('returns null when the conversation has no user turns', async () => {
    const result = await masterEvaluateLive({
      turns: [{ role: 'ai', text: 'Hello.', timestamp: 0 }],
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });
    expect(result).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('parses a well-formed LLM response', async () => {
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        salient_patterns_observed: [
          {
            canonical_pattern: 'past_continuous',
            turns_correct: [2],
            turns_incorrect: [],
            evidence: "Used 'was working' correctly in turn 2.",
          },
        ],
        automaticity_estimate: 'moderate',
        confidence_estimate: 'recovering',
        suggested_next_step: 'Consolidate past continuous across a new theme.',
        respects_stealth: true,
        session_size: 'standard',
        theme: 'workplace',
      }),
    );

    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });

    expect(result).not.toBeNull();
    expect(result?.salient_patterns_observed).toHaveLength(1);
    expect(result?.salient_patterns_observed[0]?.canonical_pattern).toBe('past_continuous');
    expect(result?.salient_patterns_observed[0]?.turns_correct).toEqual([2]);
    expect(result?.automaticity_estimate).toBe('moderate');
    expect(result?.confidence_estimate).toBe('recovering');
    expect(result?.session_size).toBe('standard');
    expect(result?.theme).toBe('workplace');
  });

  it('drops turn indices that fall outside the dialogue range', async () => {
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        salient_patterns_observed: [
          {
            canonical_pattern: 'past_continuous',
            turns_correct: [2, 99, -1, 4, '2'],
            turns_incorrect: [0, 'abc'],
            evidence: '',
          },
        ],
        automaticity_estimate: 'high',
        confidence_estimate: 'warm',
        suggested_next_step: '',
        respects_stealth: true,
        session_size: 'mini',
        theme: 'workplace',
      }),
    );

    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario('mini'),
      learnerModel: baseModel(),
    });

    expect(result?.salient_patterns_observed[0]?.turns_correct).toEqual([2, 4]);
    expect(result?.salient_patterns_observed[0]?.turns_incorrect).toEqual([]);
  });

  it('coerces case-insensitive enums and normalises theme', async () => {
    chatCompletionMock.mockResolvedValueOnce(
      JSON.stringify({
        salient_patterns_observed: [
          {
            canonical_pattern: 'articles',
            turns_correct: [],
            turns_incorrect: [2],
            evidence: '',
          },
        ],
        automaticity_estimate: 'LOW',
        confidence_estimate: 'Cold',
        suggested_next_step: '',
        respects_stealth: false,
        session_size: 'STANDARD',
        theme: '  WORKPLACE  ',
      }),
    );

    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });

    expect(result?.automaticity_estimate).toBe('low');
    expect(result?.confidence_estimate).toBe('cold');
    expect(result?.session_size).toBe('standard');
    expect(result?.theme).toBe('workplace');
    expect(result?.respects_stealth).toBe(false);
  });

  it('returns null on malformed JSON', async () => {
    chatCompletionMock.mockResolvedValueOnce('not json');
    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });
    expect(result).toBeNull();
  });

  it('returns null when the LLM throws', async () => {
    chatCompletionMock.mockRejectedValueOnce(new Error('network down'));
    const result = await masterEvaluateLive({
      turns: baseTurns(),
      scenario: baseScenario(),
      learnerModel: baseModel(),
    });
    expect(result).toBeNull();
  });
});
