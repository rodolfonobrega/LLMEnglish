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

import { clearPrescribeCache, prescribe } from './prescribe';
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
});
