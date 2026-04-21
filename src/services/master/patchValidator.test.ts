import { describe, it, expect } from 'vitest';
import { validatePatches } from './patchValidator';
import {
  createDiagnosticModel,
  emptyPatternEvidence,
  type LearnerModel,
  type PatchOp,
} from '../../types/learnerModel';

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

/** Model with one acquiring pattern that already clears all 7 gate rules. */
function modelWithMasteryReadyPattern(): LearnerModel {
  const model = createDiagnosticModel();
  const evidence = emptyPatternEvidence();
  evidence.sessions_touched = ['s1', 's2', 's3'];
  evidence.themes_seen = ['cooking', 'travel'];
  evidence.modalities_seen = ['phrase', 'live'];
  evidence.live_turns_correct = 3;
  evidence.live_sessions_touched = ['live1', 'live2'];
  evidence.live_themes_seen = ['cooking', 'travel'];
  evidence.first_live_success_at = iso(8);
  evidence.last_live_success_at = iso(2);
  evidence.first_success_at = iso(10);
  evidence.re_exposure_checks = [
    { at: iso(5), passed: true, context: 'different theme: work', was_live: true },
  ];
  model.acquiring_patterns = [
    {
      id: 'past_continuous',
      success_rate: 0.9,
      attempts: 12,
      last_seen: iso(1),
      evidence,
      trajectory: 'stable',
    },
  ];
  return model;
}

describe('validatePatches (Phase 7)', () => {
  it('lets a fully-backed mastered.add through when paired with a ladder plan', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [
      { op: 'mastered.add', id: 'past_continuous' },
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'subjunctive_mood', // different from mastered
          expected_difficulty: 'slight_stretch',
          rationale: 'next rung',
        },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.wholeSetRejected).toBe(false);
    expect(result.patches.some((p) => p.op === 'mastered.add')).toBe(true);
  });

  it('rejects a mastered.add that fails the promotion gate', () => {
    const model = modelWithMasteryReadyPattern();
    // Weaken the pattern so rule 6 fails (only 1 Live session).
    model.acquiring_patterns[0].evidence!.live_sessions_touched = ['live1'];
    model.acquiring_patterns[0].evidence!.live_themes_seen = ['cooking'];

    const patches: PatchOp[] = [
      { op: 'mastered.add', id: 'past_continuous' },
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'next',
          expected_difficulty: 'slight_stretch',
          rationale: 'next',
        },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.patches.some((p) => p.op === 'mastered.add')).toBe(false);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toMatch(/rule6_live_confirmed/);
  });

  it('rejects the whole patch set when mastered.add lacks a ladder plan.set', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [{ op: 'mastered.add', id: 'past_continuous' }];
    const result = validatePatches(patches, model);
    expect(result.wholeSetRejected).toBe(true);
    expect(result.patches).toEqual([]);
  });

  it('rejects the whole patch set when plan.set primary_goal equals the mastered id', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [
      { op: 'mastered.add', id: 'past_continuous' },
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'past_continuous', // same as mastered — no next rung
          expected_difficulty: 'slight_stretch',
          rationale: 'bad',
        },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.wholeSetRejected).toBe(true);
  });

  it('leaves non-mastered patches untouched', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [
      {
        op: 'acquiring.upsert',
        id: 'other',
        success_rate: 0.5,
        attempts: 3,
        last_seen: iso(0),
      },
      {
        op: 'engagement.update',
        patch: { last_session_engagement: 'high' },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.patches).toEqual(patches);
    expect(result.rejected).toEqual([]);
    expect(result.wholeSetRejected).toBe(false);
  });

  it('augments the ladder plan.set with a Live-biased re-exposure probe', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [
      { op: 'mastered.add', id: 'past_continuous' },
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'subjunctive_mood',
          expected_difficulty: 'slight_stretch',
          rationale: 'next rung',
        },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.wholeSetRejected).toBe(false);
    const planSet = result.patches.find(
      (p): p is Extract<PatchOp, { op: 'plan.set' }> => p.op === 'plan.set',
    );
    expect(planSet).toBeDefined();
    expect(planSet!.plan.re_exposure_queue?.length).toBe(1);
    const probe = planSet!.plan.re_exposure_queue![0];
    expect(probe.pattern_id).toBe('past_continuous');
    expect(probe.preferred_modality).toBe('live');
    // `themes_seen` on the evidence were ['cooking', 'travel'] — those
    // should appear in `preferred_theme_exclude` so the probe forces a
    // fresh context.
    expect(probe.preferred_theme_exclude).toEqual(
      expect.arrayContaining(['cooking', 'travel']),
    );
  });

  it('rejects mastered.add for a pattern not present in acquiring_patterns', () => {
    const model = modelWithMasteryReadyPattern();
    const patches: PatchOp[] = [
      { op: 'mastered.add', id: 'unknown_pattern' },
      {
        op: 'plan.set',
        plan: {
          primary_goal: 'other',
          expected_difficulty: 'slight_stretch',
          rationale: 'x',
        },
      },
    ];
    const result = validatePatches(patches, model);
    expect(result.patches.some((p) => p.op === 'mastered.add')).toBe(false);
    expect(result.rejected[0].reason).toMatch(/no acquiring_patterns entry/);
  });
});
