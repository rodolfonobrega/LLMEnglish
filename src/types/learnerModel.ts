/**
 * LearnerModel — per-user pedagogical portrait maintained by the Master.
 *
 * Storage: one row per user in the Supabase `learner_models` table.
 * Updates flow ONLY through the patch protocol (`PatchOp` below). The LLM
 * never regenerates the full model; it proposes typed patches that a
 * deterministic applier consumes. This guarantees schema stability over
 * hundreds of updates and a complete audit trail in `learner_model_history`.
 *
 * Wave 3 scope: types + service + feature flag + telemetry + manual reset.
 * The Master stays silent in this wave — no model field influences
 * student-visible output yet. Prescription / evaluation / update paths land
 * in Wave 5.
 */

import type { CanonicalPatternId } from './card';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface CEFREstimate {
  /** Best current estimate of the student's CEFR level. */
  level: CEFRLevel;
  /** 0–1 confidence in the estimate. Below 0.5 keeps the model in diagnostic mode. */
  confidence: number;
  /** Optional target the Master is steering toward (usually the next level up). */
  target?: CEFRLevel;
  /** ISO timestamp of the last (re)assessment. */
  last_reassessed?: string;
}

export interface AcquiringPattern {
  id: CanonicalPatternId;
  /** 0–1 rolling success rate (last `attempts` exposures). */
  success_rate: number;
  /** How many times this pattern has been exercised. */
  attempts: number;
  /** ISO timestamp of the last exposure. */
  last_seen: string;
  /** Optional hypothesis the Master maintains (debug-only, not user-facing). */
  hypothesis?: string;
}

export interface ChronicError {
  id: CanonicalPatternId;
  /** Total occurrences across all sessions. */
  occurrences: number;
  last_seen: string;
  /** How many direct teaching attempts have been made. Caps indirect re-teaching decisions. */
  teaching_attempts: number;
  hypothesis?: string;
}

export type EngagementSignal = 'high' | 'medium' | 'low' | 'frustrated';

export interface EngagementProfile {
  /** Themes that consistently produce engaged responses. Ranked by recency + success. */
  themes_that_land: string[];
  /** Themes that flop (low effort, disengagement signals). */
  themes_that_flop: string[];
  /** Optional ordered list of exercise modality ids the student responds best to. */
  preferred_modalities?: string[];
  /** Latest session's engagement vibe. Feeds the anti-fatigue loop. */
  last_session_engagement: EngagementSignal;
  /** Average session length in minutes. Drives prescription sizing. */
  average_session_length_min?: number;
}

export type ExpectedDifficulty = 'easy' | 'slight_stretch' | 'challenge';

export interface NextStepPlan {
  /**
   * Primary pedagogical goal for the next session(s). Usually a canonical
   * pattern id, but may be the string `"diagnostic"` during bootstrapping.
   */
  primary_goal: string;
  secondary_goal?: string;
  /** Expected difficulty relative to the student's current state. */
  expected_difficulty: ExpectedDifficulty;
  /** Short internal note for debugging. NEVER user-facing. */
  rationale: string;
  /**
   * Optional ISO timestamp. When set, the Master stays in "consolidation"
   * mode (varied contexts for the same pattern) until this date passes.
   * Used by the post-lesson boost in Wave 6.
   */
  consolidation_until?: string;
  /** Optional list of pattern ids the Master should avoid prescribing right now. */
  avoid_for_now?: CanonicalPatternId[];
}

export interface LearnerModelMeta {
  created_at: string;
  updated_at: string;
  /** Bumped whenever a breaking schema change ships. Wave 3 = 1. */
  schema_version: 1;
}

/**
 * Wave 6 Stage B — patterns the Master should back off from for a while
 * because a recent lesson produced weak gains or triggered frustration.
 * `next_retry_at` is an ISO timestamp after which the Master may retry.
 */
export interface HardForUserEntry {
  id: CanonicalPatternId;
  next_retry_at: string;
  reason?: string;
}

export interface LearnerModel {
  cefr_estimate: CEFREstimate;
  mastered_patterns: CanonicalPatternId[];
  acquiring_patterns: AcquiringPattern[];
  chronic_errors: ChronicError[];
  strengths: string[];
  engagement_profile: EngagementProfile;
  next_step_plan: NextStepPlan;
  /** True while the model is still gathering signal (first ~2-3 sessions). */
  diagnostic_mode: boolean;
  /** 0–1 calibration of the whole model. Rises as evidence accumulates. */
  confidence: number;
  /**
   * Wave 6 Stage B — patterns blacklisted for a cool-off period after a
   * weak lesson. Optional so older persisted models stay valid.
   */
  hard_for_user?: HardForUserEntry[];
  meta: LearnerModelMeta;
}

// ---------------------------------------------------------------------------
// Lesson types — Wave 6 Stage B
// ---------------------------------------------------------------------------

/**
 * Signal captured at the end of each lesson moment so the Master can adapt
 * the remaining moments. Q-11 in the design doc.
 */
export interface MomentSignal {
  goal_met: boolean;
  difficulty_actual: 'easy' | 'ok' | 'hard';
  observed_issues: string[];
  notable_successes: string[];
  engagement_observed: EngagementSignal;
}

export interface LessonMoment {
  /** 1..5 — matches the 5-moment arc from the design doc §7.2.2. */
  index: 1 | 2 | 3 | 4 | 5;
  role: 'hook' | 'noticing' | 'controlled_practice' | 'free_production' | 'consolidation';
  duration_minutes: number;
  /** Free-form adaptation notes the renderer can follow (never user-facing). */
  adaptation_rules: string;
}

export interface LessonEngagementContext {
  theme: string;
  tone_hint?: 'casual' | 'balanced' | 'formal';
}

/**
 * Plan returned by `Master.compose_lesson`. Crystallised once at
 * offer-acceptance and saved into `lessons.lesson_plan`.
 */
export interface LessonPlan {
  title_thematic: string;
  target_canonical_pattern: CanonicalPatternId;
  moments: LessonMoment[];
  engagement_context: LessonEngagementContext;
  expected_difficulty_curve: number[];
}

/**
 * Per-moment content returned by `Master.render_moment`. Discriminated on
 * `kind` so each moment UI can type-narrow safely.
 */
export type MomentContent =
  | {
      kind: 'hook';
      portuguese_opener: string;
      expected_target_usage_hint: string;
    }
  | {
      kind: 'noticing';
      pairs: Array<{ a: string; b: string; portuguese_question: string }>;
    }
  | {
      kind: 'controlled_practice';
      rounds: Array<{
        modality: 'oral_cloze' | 'error_spotting' | 'reaction_drill' | 'active_shadowing';
        payload: unknown;
      }>;
    }
  | {
      kind: 'free_production';
      modality: 'narrative' | 'live_roleplay_short';
      seed: string;
    }
  | {
      kind: 'consolidation';
      callback_prompt_pt: string;
      reveal_copy_pt: string;
    };

// ---------------------------------------------------------------------------
// Patch protocol
// ---------------------------------------------------------------------------

/**
 * Closed discriminated union of every supported patch operation.
 *
 * Unknown ops are ignored with a `console.warn` by the applier, which is
 * what protects the model from LLM drift over hundreds of updates.
 */
export type PatchOp =
  | { op: 'cefr.set'; level: CEFRLevel; confidence: number; target?: CEFRLevel }
  | { op: 'mastered.add'; id: CanonicalPatternId }
  | { op: 'mastered.remove'; id: CanonicalPatternId }
  | {
      op: 'acquiring.upsert';
      id: CanonicalPatternId;
      success_rate: number;
      attempts: number;
      last_seen: string;
      hypothesis?: string;
    }
  | { op: 'acquiring.remove'; id: CanonicalPatternId }
  | {
      op: 'chronic.upsert';
      id: CanonicalPatternId;
      occurrences: number;
      last_seen: string;
      teaching_attempts: number;
      hypothesis?: string;
    }
  | { op: 'chronic.remove'; id: CanonicalPatternId }
  | { op: 'strengths.set'; list: string[] }
  | { op: 'engagement.update'; patch: Partial<EngagementProfile> }
  | { op: 'plan.set'; plan: NextStepPlan }
  | { op: 'diagnostic.set'; value: boolean }
  | { op: 'confidence.set'; value: number }
  /** Wave 6 Stage B — blacklist a pattern until `next_retry_at` passes. */
  | {
      op: 'hard_for_user.upsert';
      id: CanonicalPatternId;
      next_retry_at: string;
      reason?: string;
    }
  | { op: 'hard_for_user.remove'; id: CanonicalPatternId };

export type PatchOpName = PatchOp['op'];

export const PATCH_OPS: readonly PatchOpName[] = [
  'cefr.set',
  'mastered.add',
  'mastered.remove',
  'acquiring.upsert',
  'acquiring.remove',
  'chronic.upsert',
  'chronic.remove',
  'strengths.set',
  'engagement.update',
  'plan.set',
  'diagnostic.set',
  'confidence.set',
  'hard_for_user.upsert',
  'hard_for_user.remove',
] as const;

/** Sources recognised by the `learner_model_history.source` check constraint. */
export type PatchSource =
  | 'evaluate'
  | 'update_model'
  | 'reset'
  | 'lesson_boost'
  /** Wave 6 extension; also accepted by the history check constraint in W6A migration. */
  | 'breakthrough_event';

/**
 * Build a fresh diagnostic-mode model. Used:
 *   - for first-time users (row missing in DB),
 *   - when the user resets their tutor from Settings.
 */
export function createDiagnosticModel(now: string = new Date().toISOString()): LearnerModel {
  return {
    cefr_estimate: { level: 'A2', confidence: 0.0 },
    mastered_patterns: [],
    acquiring_patterns: [],
    chronic_errors: [],
    strengths: [],
    engagement_profile: {
      themes_that_land: [],
      themes_that_flop: [],
      last_session_engagement: 'medium',
    },
    next_step_plan: {
      primary_goal: 'diagnostic',
      expected_difficulty: 'slight_stretch',
      rationale: 'Cold start: probe across difficulty and themes to calibrate the model.',
    },
    diagnostic_mode: true,
    confidence: 0,
    meta: {
      created_at: now,
      updated_at: now,
      schema_version: 1,
    },
  };
}
