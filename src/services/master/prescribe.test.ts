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

import {
  buildReExposureEntry,
  clearPrescribeCache,
  pickDueReExposure,
  prescribe,
} from './prescribe';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { createDiagnosticModel } from '../../types/learnerModel';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

function validBriefingJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    target_skill: 'past_continuous_in_interrupted_narrative',
    modality_choice: 'phrase',
    disguise_theme: 'weekend plans',
    required_elements: ['describe an ongoing action that gets interrupted'],
    forbidden_elements: ['mention grammar labels'],
    success_criteria: 'Student uses an interrupted ongoing action.',
    expected_difficulty: 'slight_stretch',
    rationale: 'Targeting a known acquiring pattern.',
    ...overrides,
  });
}

describe('Master.prescribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPrescribeCache();
  });

  it('returns null and skips the LLM call when master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const briefing = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(briefing).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('parses a well-formed briefing and returns it', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(validBriefingJSON());
    const briefing = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(briefing).not.toBeNull();
    expect(briefing!.target_skill).toBe('past_continuous_in_interrupted_narrative');
    expect(briefing!.modality_choice).toBe('phrase');
    expect(briefing!.required_elements.length).toBeGreaterThan(0);
  });

  it('caches within the TTL window and skips the second LLM call', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(validBriefingJSON());
    const first = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    const second = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(first).toEqual(second);
    expect(chatCompletionMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates the cache across different requested exercise types', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock
      .mockResolvedValueOnce(validBriefingJSON({ modality_choice: 'phrase' }))
      .mockResolvedValueOnce(validBriefingJSON({ modality_choice: 'text' }));
    const a = await prescribe('u1', {
      learnerModel: createDiagnosticModel(),
      requestedExerciseType: 'phrase',
    });
    const b = await prescribe('u1', {
      learnerModel: createDiagnosticModel(),
      requestedExerciseType: 'text',
    });
    expect(a?.modality_choice).toBe('phrase');
    expect(b?.modality_choice).toBe('text');
    expect(chatCompletionMock).toHaveBeenCalledTimes(2);
  });

  it('returns null on malformed JSON', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce('not json');
    const b = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(b).toBeNull();
  });

  it('returns null when modality_choice is out of enum', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(validBriefingJSON({ modality_choice: 'not_a_modality' }));
    const b = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(b).toBeNull();
  });

  it('forces modality_choice to match requestedExerciseType when caller constrains', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(validBriefingJSON({ modality_choice: 'text' }));
    const b = await prescribe('u1', {
      learnerModel: createDiagnosticModel(),
      requestedExerciseType: 'phrase',
    });
    expect(b?.modality_choice).toBe('phrase');
  });

  it('swallows LLM errors and returns null', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockRejectedValueOnce(new Error('boom'));
    const b = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(b).toBeNull();
  });

  it('pins target_skill to primary_goal while consolidation window is active', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'some_other_pattern' }),
    );
    const model = createDiagnosticModel();
    model.next_step_plan = {
      ...model.next_step_plan,
      primary_goal: 'consolidated_pattern',
      consolidation_until: new Date(Date.now() + 60_000).toISOString(),
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('consolidated_pattern');
    expect(b?.rationale).toMatch(/consolidation_until/);
  });

  it('ignores expired consolidation windows', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'llm_chosen_pattern' }),
    );
    const model = createDiagnosticModel();
    model.next_step_plan = {
      ...model.next_step_plan,
      primary_goal: 'consolidated_pattern',
      consolidation_until: new Date(Date.now() - 60_000).toISOString(),
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('llm_chosen_pattern');
  });

  it('reroutes away from hard_for_user blacklisted patterns', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'hated_pattern' }),
    );
    const model = createDiagnosticModel();
    model.next_step_plan = { ...model.next_step_plan, primary_goal: 'safe_fallback' };
    model.hard_for_user = [
      {
        id: 'hated_pattern',
        next_retry_at: new Date(Date.now() + 3_600_000).toISOString(),
        reason: 'user_frustration',
      },
    ];
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('safe_fallback');
    expect(b?.rationale).toMatch(/hard_for_user/);
  });

  // --- Phase 2 (F-P2-05) -----------------------------------------------------

  it('defaults Live briefings to session_size "mini"', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ modality_choice: 'live' }),
    );
    const b = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(b?.modality_choice).toBe('live');
    expect(b?.session_size).toBe('mini');
  });

  it('respects an explicit session_size "standard" from the LLM', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ modality_choice: 'live', session_size: 'standard' }),
    );
    const b = await prescribe('u1', { learnerModel: createDiagnosticModel() });
    expect(b?.session_size).toBe('standard');
  });

  // --- Phase 2 (F-P2-06) — theme diversity bias ------------------------------

  it('rewrites disguise_theme when it dominates the Live window (>= 40%)', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ modality_choice: 'live', disguise_theme: 'coffee shop' }),
    );
    const model = createDiagnosticModel();
    model.engagement_profile = {
      ...model.engagement_profile,
      themes_that_land: ['coffee shop', 'weekend plans', 'pets'],
    };
    model.live_fluency_profile = {
      sessions_considered: ['s1', 's2', 's3', 's4'],
      distinct_themes_in_window: 2,
      themes_in_window: ['coffee shop', 'coffee shop', 'coffee shop', 'music'],
      avg_turn_length_words: 6,
      median_turn_length_words: 6,
      longest_turn_words: 10,
      avg_response_latency_ms: 900,
      abandoned_turn_rate: 0,
      lexical_diversity_estimate: 0.5,
      session_points: [],
      trajectory: 'stable',
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.disguise_theme).not.toBe('coffee shop');
    expect(b?.rationale).toMatch(/theme_diversity/);
  });

  it('does not rewrite disguise_theme when the window is balanced', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ modality_choice: 'live', disguise_theme: 'cooking' }),
    );
    const model = createDiagnosticModel();
    model.live_fluency_profile = {
      sessions_considered: ['s1', 's2', 's3', 's4'],
      distinct_themes_in_window: 4,
      themes_in_window: ['cooking', 'music', 'pets', 'travel'],
      avg_turn_length_words: 6,
      median_turn_length_words: 6,
      longest_turn_words: 10,
      avg_response_latency_ms: 900,
      abandoned_turn_rate: 0,
      lexical_diversity_estimate: 0.5,
      session_points: [],
      trajectory: 'stable',
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.disguise_theme).toBe('cooking');
    expect(b?.rationale ?? '').not.toMatch(/theme_diversity/);
  });

  // --- Phase 7 (F-P7-03) — scheduled re-exposure ----------------------------

  it('honours a due re-exposure probe over the LLM briefing', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'llm_picked', modality_choice: 'phrase' }),
    );
    const model = createDiagnosticModel();
    model.next_step_plan = {
      ...model.next_step_plan,
      primary_goal: 'current_goal',
      re_exposure_queue: [
        {
          pattern_id: 'probe_target',
          scheduled_for: new Date(Date.now() - 60_000).toISOString(),
          preferred_modality: 'live',
          reason: 'post-mastery probe',
        },
      ],
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('probe_target');
    expect(b?.modality_choice).toBe('live');
    expect(b?.session_size).toBe('mini');
    expect(b?.rationale).toMatch(/re_exposure/);
  });

  it('ignores a re-exposure probe that is not yet due', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'llm_picked' }),
    );
    const model = createDiagnosticModel();
    model.next_step_plan = {
      ...model.next_step_plan,
      re_exposure_queue: [
        {
          pattern_id: 'future_probe',
          scheduled_for: new Date(Date.now() + 3_600_000).toISOString(),
          preferred_modality: 'live',
        },
      ],
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('llm_picked');
  });

  it('does not pick a due probe whose pattern is hard_for_user blacklisted', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ target_skill: 'llm_picked' }),
    );
    const model = createDiagnosticModel();
    model.hard_for_user = [
      {
        id: 'blacklisted_probe',
        next_retry_at: new Date(Date.now() + 3_600_000).toISOString(),
        reason: 'weak_delta',
      },
    ];
    model.next_step_plan = {
      ...model.next_step_plan,
      re_exposure_queue: [
        {
          pattern_id: 'blacklisted_probe',
          scheduled_for: new Date(Date.now() - 60_000).toISOString(),
          preferred_modality: 'live',
        },
      ],
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.target_skill).toBe('llm_picked');
  });

  it('pickDueReExposure returns the earliest due entry', () => {
    const model = createDiagnosticModel();
    model.next_step_plan = {
      ...model.next_step_plan,
      re_exposure_queue: [
        {
          pattern_id: 'late',
          scheduled_for: new Date(Date.now() - 10_000).toISOString(),
        },
        {
          pattern_id: 'earliest',
          scheduled_for: new Date(Date.now() - 60_000).toISOString(),
        },
      ],
    };
    expect(pickDueReExposure(model)?.pattern_id).toBe('earliest');
  });

  it('buildReExposureEntry schedules 24h out by default and doubles per prior probe', () => {
    const now = new Date('2030-01-01T00:00:00Z');
    const first = buildReExposureEntry({
      patternId: 'p1',
      themesToExclude: ['cooking'],
      now,
    });
    expect(first.pattern_id).toBe('p1');
    expect(first.preferred_modality).toBe('live');
    expect(first.preferred_theme_exclude).toEqual(['cooking']);
    expect(Date.parse(first.scheduled_for) - now.getTime()).toBe(24 * 3600 * 1000);

    const second = buildReExposureEntry({ patternId: 'p1', priorProbes: 1, now });
    expect(Date.parse(second.scheduled_for) - now.getTime()).toBe(48 * 3600 * 1000);

    const fourth = buildReExposureEntry({ patternId: 'p1', priorProbes: 10, now });
    expect(Date.parse(fourth.scheduled_for) - now.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it('does not rewrite disguise_theme for non-Live modalities', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValueOnce(
      validBriefingJSON({ modality_choice: 'phrase', disguise_theme: 'coffee shop' }),
    );
    const model = createDiagnosticModel();
    model.live_fluency_profile = {
      sessions_considered: ['s1', 's2', 's3'],
      distinct_themes_in_window: 1,
      themes_in_window: ['coffee shop', 'coffee shop', 'coffee shop'],
      avg_turn_length_words: 6,
      median_turn_length_words: 6,
      longest_turn_words: 10,
      avg_response_latency_ms: 900,
      abandoned_turn_rate: 0,
      lexical_diversity_estimate: 0.5,
      session_points: [],
      trajectory: 'stable',
    };
    const b = await prescribe('u1', { learnerModel: model });
    expect(b?.disguise_theme).toBe('coffee shop');
  });
});
