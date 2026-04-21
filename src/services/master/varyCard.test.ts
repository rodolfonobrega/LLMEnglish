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
  appendLineage,
  computeThemesToAvoid,
  computeVerbsUsedRecently,
  varyCard,
} from './varyCard';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { Card } from '../../types/card';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

function baseCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    type: 'phrase',
    prompt: 'Descreva o que você fez no fim de semana.',
    context: 'Conversa casual com um amigo.',
    theme: 'weekend',
    canonical_pattern: 'past_continuous_in_interrupted_narrative',
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    createdAt: new Date().toISOString(),
    reviews: [],
    ...overrides,
  };
}

function validVariantJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    prompt: 'Descreva o que você estava fazendo quando o telefone tocou no trabalho.',
    context: 'Conversa com um colega.',
    theme: 'work',
    verbs: ['write', 'talk', 'answer'],
    ...overrides,
  });
}

describe('Master.varyCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    masterEnabledMock.mockReturnValue(true);
  });

  it('returns the original prompt when Master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(result.prompt).toBe(card.prompt);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('returns the original prompt when the card has no canonical_pattern', async () => {
    const card = baseCard({ canonical_pattern: undefined });
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('honors the pin_to_original escape valve', async () => {
    const card = baseCard({ pin_to_original: true });
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('produces a variant from the LLM output when inputs are valid', async () => {
    chatCompletionMock.mockResolvedValueOnce(validVariantJSON());
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('llm');
    expect(result.theme).toBe('work');
    expect(result.prompt).toContain('telefone');
    expect(result.verbs).toEqual(['write', 'talk', 'answer']);
    expect(result.lineageEntry.theme).toBe('work');
  });

  it('falls back to original when the variant picks a banned theme', async () => {
    // Card's current theme is "weekend" → it is automatically banned.
    chatCompletionMock.mockResolvedValueOnce(validVariantJSON({ theme: 'weekend' }));
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(result.prompt).toBe(card.prompt);
    expect(result.reason).toMatch(/themesToAvoid/);
  });

  it('falls back to original when the variant leaks pedagogical vocabulary', async () => {
    chatCompletionMock.mockResolvedValueOnce(
      validVariantJSON({ prompt: 'Pratique o past continuous descrevendo...' }),
    );
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(result.reason).toMatch(/stealth|leaked/i);
  });

  it('falls back to original when the LLM throws', async () => {
    chatCompletionMock.mockRejectedValueOnce(new Error('boom'));
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
    expect(result.prompt).toBe(card.prompt);
  });

  it('falls back to original when the LLM response is malformed JSON', async () => {
    chatCompletionMock.mockResolvedValueOnce('not json at all');
    const card = baseCard();
    const result = await varyCard({ card, learnerModel: createDiagnosticModel() });

    expect(result.source).toBe('original');
  });

  it('computeThemesToAvoid merges card theme, lineage themes, and live window', () => {
    const card = baseCard({
      variation_lineage: [
        {
          prompt: 'a',
          theme: 'TRAVEL',
          shown_at: new Date().toISOString(),
        },
        {
          prompt: 'b',
          theme: 'food',
          shown_at: new Date().toISOString(),
        },
      ],
    });
    const model = createDiagnosticModel();
    model.live_fluency_profile = {
      sessions_considered: [],
      avg_turn_length_words: null,
      median_turn_length_words: null,
      longest_turn_words: null,
      avg_response_latency_ms: null,
      abandoned_turn_rate: null,
      lexical_diversity_estimate: null,
      distinct_themes_in_window: 1,
      themes_in_window: ['Work'],
      trajectory: 'stable',
      session_points: [],
    };

    const themes = computeThemesToAvoid(card, model);
    expect(themes).toContain('weekend');
    expect(themes).toContain('travel');
    expect(themes).toContain('food');
    expect(themes).toContain('work');
  });

  it('computeVerbsUsedRecently returns the verbs from the latest lineage entry', () => {
    const card = baseCard({
      variation_lineage: [
        { prompt: 'a', theme: 'travel', shown_at: new Date().toISOString(), verbs: ['go', 'eat'] },
        { prompt: 'b', theme: 'food', shown_at: new Date().toISOString(), verbs: ['Write', 'TALK'] },
      ],
    });
    expect(computeVerbsUsedRecently(card)).toEqual(['write', 'talk']);
  });

  it('appendLineage backfills original_prompt and caps lineage at 10 entries', () => {
    const initial = baseCard({ original_prompt: undefined });
    const after = appendLineage(initial, {
      prompt: 'variant 1',
      theme: 'work',
      shown_at: new Date().toISOString(),
    });
    expect(after.original_prompt).toBe(initial.prompt);
    expect(after.variation_lineage).toHaveLength(1);

    // Cap to 10 entries — 12 appends should yield 10, dropping the oldest.
    let capCheck = baseCard();
    for (let i = 0; i < 12; i++) {
      capCheck = appendLineage(capCheck, {
        prompt: `v${i}`,
        theme: 'work',
        shown_at: new Date().toISOString(),
      });
    }
    expect(capCheck.variation_lineage).toHaveLength(10);
    expect(capCheck.variation_lineage?.[0]?.prompt).toBe('v2');
  });
});
