import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('./supabase/auth', () => ({
  getCurrentUser: vi.fn(() => ({ id: 'test-user' })),
}));

vi.mock('./runtimeConfigSnapshot', () => ({
  masterEnabled: vi.fn(() => true),
}));

import { applyPatches } from './learnerModel';
import { createDiagnosticModel, type LearnerModel, type PatchOp } from '../types/learnerModel';

function baseModel(): LearnerModel {
  return createDiagnosticModel('2026-04-20T00:00:00Z');
}

describe('applyPatches', () => {
  it('never mutates the input model', () => {
    const original = baseModel();
    const snapshot = JSON.stringify(original);
    applyPatches(original, [{ op: 'confidence.set', value: 0.5 }]);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('cefr.set updates level + confidence and clamps confidence', () => {
    const next = applyPatches(baseModel(), [
      { op: 'cefr.set', level: 'B2', confidence: 1.7, target: 'C1' },
    ]);
    expect(next.cefr_estimate.level).toBe('B2');
    expect(next.cefr_estimate.confidence).toBe(1);
    expect(next.cefr_estimate.target).toBe('C1');
    expect(next.cefr_estimate.last_reassessed).toBeTruthy();
  });

  it('mastered.add inserts and removes from acquiring', () => {
    const model = applyPatches(baseModel(), [
      {
        op: 'acquiring.upsert',
        id: 'past_continuous_in_interrupted_narrative',
        success_rate: 0.6,
        attempts: 3,
        last_seen: '2026-04-19T00:00:00Z',
      },
    ]);

    const next = applyPatches(model, [
      { op: 'mastered.add', id: 'past_continuous_in_interrupted_narrative' },
    ]);

    expect(next.mastered_patterns).toContain('past_continuous_in_interrupted_narrative');
    expect(next.acquiring_patterns.find((p) => p.id === 'past_continuous_in_interrupted_narrative')).toBeUndefined();
  });

  it('mastered.add is idempotent for already-mastered ids', () => {
    const model = applyPatches(baseModel(), [{ op: 'mastered.add', id: 'article_a_vs_an' }]);
    const next = applyPatches(model, [{ op: 'mastered.add', id: 'article_a_vs_an' }]);
    expect(next.mastered_patterns.filter((id) => id === 'article_a_vs_an')).toHaveLength(1);
  });

  it('acquiring.upsert replaces an existing row by id', () => {
    const model = applyPatches(baseModel(), [
      {
        op: 'acquiring.upsert',
        id: 'third_person_singular_s',
        success_rate: 0.5,
        attempts: 1,
        last_seen: '2026-04-18T00:00:00Z',
      },
    ]);

    const next = applyPatches(model, [
      {
        op: 'acquiring.upsert',
        id: 'third_person_singular_s',
        success_rate: 0.8,
        attempts: 4,
        last_seen: '2026-04-20T00:00:00Z',
      },
    ]);

    expect(next.acquiring_patterns).toHaveLength(1);
    expect(next.acquiring_patterns[0].success_rate).toBe(0.8);
    expect(next.acquiring_patterns[0].attempts).toBe(4);
  });

  it('chronic.upsert clamps occurrences and teaching_attempts to non-negative integers', () => {
    const next = applyPatches(baseModel(), [
      {
        op: 'chronic.upsert',
        id: 'article_the_for_specific',
        occurrences: -3,
        teaching_attempts: 2.7,
        last_seen: '2026-04-20T00:00:00Z',
      },
    ]);

    expect(next.chronic_errors[0].occurrences).toBe(0);
    expect(next.chronic_errors[0].teaching_attempts).toBe(2);
  });

  it('engagement.update merges partial fields without clobbering unset ones', () => {
    const next = applyPatches(baseModel(), [
      { op: 'engagement.update', patch: { themes_that_land: ['food', 'travel'] } },
    ]);
    expect(next.engagement_profile.themes_that_land).toEqual(['food', 'travel']);
    expect(next.engagement_profile.last_session_engagement).toBe('medium');
  });

  it('plan.set replaces the next_step_plan wholesale', () => {
    const next = applyPatches(baseModel(), [
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'past_continuous_in_interrupted_narrative',
          expected_difficulty: 'slight_stretch',
          rationale: 'student just exited diagnostic mode',
        },
      },
    ]);
    expect(next.next_step_plan.primary_goal).toBe('past_continuous_in_interrupted_narrative');
    expect(next.diagnostic_mode).toBe(true);
  });

  it('confidence.set clamps to [0, 1]', () => {
    const high = applyPatches(baseModel(), [{ op: 'confidence.set', value: 2.5 }]);
    const low = applyPatches(baseModel(), [{ op: 'confidence.set', value: -3 }]);
    expect(high.confidence).toBe(1);
    expect(low.confidence).toBe(0);
  });

  it('unknown ops are ignored without mutating the model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = baseModel();
    const after = applyPatches(before, [{ op: 'does.not.exist', anything: true } as unknown as PatchOp]);
    expect(after.cefr_estimate).toEqual(before.cefr_estimate);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('updates meta.updated_at on every apply', async () => {
    const base = baseModel();
    // Small delay to guarantee a distinct ISO timestamp.
    await new Promise((resolve) => setTimeout(resolve, 2));
    const next = applyPatches(base, [{ op: 'confidence.set', value: 0.3 }]);
    expect(next.meta.updated_at).not.toBe(base.meta.updated_at);
  });
});
