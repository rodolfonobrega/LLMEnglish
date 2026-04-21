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

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { coerceReflection, summarizeSession, type SessionRecap } from './summarizeSession';
import { createDiagnosticModel } from '../../types/learnerModel';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);
const recordMasterUsageMock = vi.mocked(recordMasterUsage);

function baseRecap(overrides: Partial<SessionRecap> = {}): SessionRecap {
  return {
    surface: 'live',
    themes: ['weekend', 'work'],
    patterns_correct: ['past_continuous_in_interrupted_narrative'],
    patterns_incorrect: [],
    attempts: 6,
    avg_score: 7.5,
    had_live: true,
    longest_live_turn_words: 24,
    ...overrides,
  };
}

function validReflectionJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    strength_text:
      'Suas histórias sobre o fim de semana estão ficando mais naturais e conectadas.',
    opportunity_text:
      'Na próxima vez, tente esticar um pouco mais as cenas de trabalho que você começou a explorar.',
    ...overrides,
  });
}

describe('Master.summarizeSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    masterEnabledMock.mockReturnValue(true);
  });

  it('returns null when Master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const result = await summarizeSession({
      recap: baseRecap(),
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('returns null when the recap has zero attempts', async () => {
    const result = await summarizeSession({
      recap: baseRecap({ attempts: 0 }),
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('produces a reflection from valid LLM output and records telemetry', async () => {
    chatCompletionMock.mockResolvedValueOnce(validReflectionJSON());
    const result = await summarizeSession({
      recap: baseRecap(),
      learnerModel: createDiagnosticModel(),
    });

    expect(result).not.toBeNull();
    expect(result!.strength_text).toMatch(/histórias/);
    expect(result!.opportunity_text).toMatch(/trabalho/);
    expect(result!.salient_patterns).toContain(
      'past_continuous_in_interrupted_narrative',
    );
    expect(result!.themes_observed).toEqual(
      expect.arrayContaining(['weekend', 'work']),
    );
    expect(recordMasterUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'summarize_session' }),
    );
  });

  it('drops reflections that leak pedagogical jargon', async () => {
    chatCompletionMock.mockResolvedValueOnce(
      validReflectionJSON({
        strength_text:
          'Você dominou o past continuous e o uso do present perfect de forma excelente.',
      }),
    );
    const result = await summarizeSession({
      recap: baseRecap(),
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
    expect(recordMasterUsageMock).not.toHaveBeenCalled();
  });

  it('returns null when the LLM returns non-JSON', async () => {
    chatCompletionMock.mockResolvedValueOnce('not json at all');
    const result = await summarizeSession({
      recap: baseRecap(),
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
  });

  it('returns null when the LLM call throws', async () => {
    chatCompletionMock.mockRejectedValueOnce(new Error('network down'));
    const result = await summarizeSession({
      recap: baseRecap(),
      learnerModel: createDiagnosticModel(),
    });
    expect(result).toBeNull();
  });

  it('dedupes salient patterns across correct and incorrect lists', async () => {
    chatCompletionMock.mockResolvedValueOnce(validReflectionJSON());
    const result = await summarizeSession({
      recap: baseRecap({
        patterns_correct: ['past_continuous_in_interrupted_narrative'],
        patterns_incorrect: ['past_continuous_in_interrupted_narrative', 'simple_past_narrative'],
      }),
      learnerModel: createDiagnosticModel(),
    });

    expect(result).not.toBeNull();
    expect(result!.salient_patterns).toEqual([
      'past_continuous_in_interrupted_narrative',
      'simple_past_narrative',
    ]);
  });
});

describe('coerceReflection', () => {
  it('accepts well-formed JSON', () => {
    const input = {
      strength_text: 'Você conseguiu sustentar a conversa sobre viagens por mais tempo.',
      opportunity_text: 'Na próxima sessão, tente trazer esse tema para um cenário diferente.',
    };
    expect(coerceReflection(input)).toEqual(input);
  });

  it('rejects missing fields', () => {
    expect(coerceReflection({ strength_text: 'ok' })).toBeNull();
    expect(coerceReflection({ opportunity_text: 'ok' })).toBeNull();
    expect(coerceReflection(null)).toBeNull();
    expect(coerceReflection('string')).toBeNull();
  });

  it('rejects overly long fields', () => {
    const long = 'a'.repeat(300);
    expect(
      coerceReflection({ strength_text: long, opportunity_text: 'short' }),
    ).toBeNull();
  });

  it('trims whitespace', () => {
    const result = coerceReflection({
      strength_text: '  Sua narrativa ficou mais vívida hoje.  ',
      opportunity_text: '  Tente variar os temas na próxima sessão.  ',
    });
    expect(result?.strength_text).toBe('Sua narrativa ficou mais vívida hoje.');
    expect(result?.opportunity_text).toBe('Tente variar os temas na próxima sessão.');
  });
});
