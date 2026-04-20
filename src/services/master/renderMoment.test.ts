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

import { renderMoment, coerceMomentContent, collectStudentText } from './renderMoment';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import type { LessonPlan } from '../../types/learnerModel';

const chatCompletionMock = vi.mocked(chatCompletion);
const masterEnabledMock = vi.mocked(masterEnabled);

const PLAN: LessonPlan = {
  title_thematic: 'An interrupted Saturday morning',
  target_canonical_pattern: 'past_continuous_in_interrupted_narrative',
  engagement_context: { theme: 'weekend', tone_hint: 'casual' },
  expected_difficulty_curve: [0.2, 0.4, 0.6, 0.7, 0.5],
  moments: [
    { index: 1, role: 'hook', duration_minutes: 2, adaptation_rules: 'invite a short story.' },
    { index: 2, role: 'noticing', duration_minutes: 3, adaptation_rules: 'show 3 pairs.' },
    { index: 3, role: 'controlled_practice', duration_minutes: 4, adaptation_rules: 'drill.' },
    { index: 4, role: 'free_production', duration_minutes: 4, adaptation_rules: 'open-ended.' },
    { index: 5, role: 'consolidation', duration_minutes: 2, adaptation_rules: 'reveal + recap.' },
  ],
};

describe('Master.render_moment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when master is disabled', async () => {
    masterEnabledMock.mockReturnValue(false);
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 1 });
    expect(content).toBeNull();
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('renders a valid hook moment', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(
      JSON.stringify({
        kind: 'hook',
        portuguese_opener: 'Conte uma manhã de sábado que mudou de rumo.',
        expected_target_usage_hint: 'Expect an ongoing action interrupted by another event.',
      }),
    );
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 1 });
    expect(content?.kind).toBe('hook');
  });

  it('rejects a hook that leaks grammar labels', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(
      JSON.stringify({
        kind: 'hook',
        portuguese_opener: 'Hoje vamos praticar o passado contínuo.',
        expected_target_usage_hint: '...',
      }),
    );
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 1 });
    expect(content).toBeNull();
  });

  it('renders a valid noticing moment', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(
      JSON.stringify({
        kind: 'noticing',
        pairs: [
          { a: 'I watched TV when he arrived.', b: 'I was watching TV when he arrived.', portuguese_question: 'Qual soa mais natural para uma ação em andamento?' },
          { a: 'She cooked when he called.', b: 'She was cooking when he called.', portuguese_question: 'Qual transmite uma cena sendo interrompida?' },
        ],
      }),
    );
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 2 });
    expect(content?.kind).toBe('noticing');
  });

  it('renders a consolidation moment and ALLOWS grammar labels there', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue(
      JSON.stringify({
        kind: 'consolidation',
        callback_prompt_pt: 'Lembra da manhã de sábado?',
        reveal_copy_pt: 'Nesta aula você praticou o passado contínuo em narrativas interrompidas.',
      }),
    );
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 5 });
    expect(content?.kind).toBe('consolidation');
  });

  it('rejects malformed JSON', async () => {
    masterEnabledMock.mockReturnValue(true);
    chatCompletionMock.mockResolvedValue('not json');
    const content = await renderMoment({ lessonPlan: PLAN, momentIndex: 1 });
    expect(content).toBeNull();
  });

  it('rejects mismatched moment role/kind', () => {
    const got = coerceMomentContent(
      { kind: 'noticing', pairs: [{ a: 'x', b: 'y', portuguese_question: 'z' }] },
      'hook',
    );
    expect(got).toBeNull();
  });

  it('collectStudentText aggregates controlled_practice payloads', () => {
    const text = collectStudentText({
      kind: 'controlled_practice',
      rounds: [
        { modality: 'oral_cloze', payload: { text: 'I ___ reading when he called.' } },
        { modality: 'reaction_drill', payload: { prompt: 'respond quickly' } },
      ],
    });
    expect(text).toContain('reading when he called');
    expect(text).toContain('respond quickly');
  });
});
