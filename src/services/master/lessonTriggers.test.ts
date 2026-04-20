import { describe, expect, it } from 'vitest';
import { evaluateTriggers } from './lessonTriggers';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { LearnerModel } from '../../types/learnerModel';
import type { LessonOfferRow } from '../../types/supabase';

const NOW = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function offer(overrides: Partial<LessonOfferRow> = {}): LessonOfferRow {
  return {
    id: 'o_' + Math.random().toString(36).slice(2),
    user_id: 'u1',
    candidate_pattern: 'past_continuous_in_interrupted_narrative',
    trigger_type: 'chronic',
    status: 'would_offer',
    dry_run: true,
    mute_until: null,
    created_at: new Date(NOW - 10 * DAY).toISOString(),
    ...overrides,
  };
}

function withChronic(model: LearnerModel, count = 6): LearnerModel {
  return {
    ...model,
    chronic_errors: [
      {
        id: 'article_a_vs_the',
        occurrences: count,
        teaching_attempts: 3,
        last_seen: new Date(NOW).toISOString(),
      },
    ],
  };
}

function withStuck(model: LearnerModel): LearnerModel {
  return {
    ...model,
    acquiring_patterns: [
      {
        id: 'past_continuous_in_interrupted_narrative',
        success_rate: 0.4,
        attempts: 4,
        last_seen: new Date(NOW).toISOString(),
      },
    ],
  };
}

function withBreakthrough(model: LearnerModel): LearnerModel {
  return {
    ...model,
    acquiring_patterns: [
      {
        id: 'present_perfect_for_experiences',
        success_rate: 0.85,
        attempts: 6,
        last_seen: new Date(NOW).toISOString(),
      },
    ],
  };
}

describe('evaluateTriggers', () => {
  it('returns null when no triggers fire on a fresh model', () => {
    expect(evaluateTriggers({ learnerModel: createDiagnosticModel() })).toBeNull();
  });

  it('prefers chronic over everything else', () => {
    const model = withBreakthrough(withStuck(withChronic(createDiagnosticModel())));
    const c = evaluateTriggers({ learnerModel: model });
    expect(c?.trigger_type).toBe('chronic');
  });

  it('picks stuck when chronic does not qualify', () => {
    const model = withStuck(createDiagnosticModel());
    const c = evaluateTriggers({ learnerModel: model });
    expect(c?.trigger_type).toBe('stuck');
  });

  it('picks breakthrough when nothing chronic/stuck qualifies', () => {
    const model = withBreakthrough(createDiagnosticModel());
    const c = evaluateTriggers({ learnerModel: model });
    expect(c?.trigger_type).toBe('breakthrough');
  });

  it('picks cadence as the last resort when there is a real goal', () => {
    const base = createDiagnosticModel();
    const model: LearnerModel = {
      ...base,
      next_step_plan: {
        ...base.next_step_plan,
        primary_goal: 'past_continuous_in_interrupted_narrative',
      },
    };
    const c = evaluateTriggers({ learnerModel: model });
    expect(c?.trigger_type).toBe('cadence');
  });

  it('skips the chronic candidate that was recently accepted', () => {
    const model = withChronic(createDiagnosticModel());
    model.chronic_errors[0].id = 'past_continuous_in_interrupted_narrative';
    const recent = offer({
      status: 'accepted',
      candidate_pattern: 'past_continuous_in_interrupted_narrative',
      created_at: new Date(NOW - 3 * DAY).toISOString(),
    });
    expect(evaluateTriggers({ learnerModel: model, recentOffers: [recent] })).toBeNull();
  });

  it('enforces ≤ 3 offers per week', () => {
    const model = withChronic(createDiagnosticModel());
    const recentOffers = [
      offer({ created_at: new Date(NOW - 1 * DAY).toISOString() }),
      offer({ created_at: new Date(NOW - 3 * DAY).toISOString() }),
      offer({ created_at: new Date(NOW - 4 * DAY).toISOString() }),
    ];
    expect(evaluateTriggers({ learnerModel: model, recentOffers })).toBeNull();
  });

  it('enforces ≥ 48 h between offers', () => {
    const model = withChronic(createDiagnosticModel());
    const recentOffers = [
      offer({ created_at: new Date(NOW - 10 * HOUR).toISOString() }),
    ];
    expect(evaluateTriggers({ learnerModel: model, recentOffers })).toBeNull();
  });

  it('cadence suppresses itself when a candidate fired recently', () => {
    const base = createDiagnosticModel();
    const model: LearnerModel = {
      ...base,
      next_step_plan: { ...base.next_step_plan, primary_goal: 'some_goal' },
    };
    const recentOffers = [offer({ created_at: new Date(NOW - 24 * HOUR).toISOString() })];
    const c = evaluateTriggers({ learnerModel: model, recentOffers });
    // 24 h < 48 h => frequency cap suppresses entirely before cadence checks run
    expect(c).toBeNull();
  });

  it('cadence also suppresses when an accepted lesson is within 7 days', () => {
    const base = createDiagnosticModel();
    const model: LearnerModel = {
      ...base,
      next_step_plan: { ...base.next_step_plan, primary_goal: 'some_goal' },
    };
    const recentOffers = [
      offer({
        status: 'accepted',
        created_at: new Date(NOW - 5 * DAY).toISOString(),
      }),
    ];
    // The 5-day-old offer does not block frequency caps (only 1 per week so
    // far). But accepted-within-7d blocks cadence. Chronic etc. don't fire.
    expect(evaluateTriggers({ learnerModel: model, recentOffers })).toBeNull();
  });
});
