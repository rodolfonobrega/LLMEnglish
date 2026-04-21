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

/**
 * Phase 7 (F-P7-02) — one re-exposure probe on a pattern. A re-exposure
 * check is a deliberate later re-test of a pattern the student already
 * seemed to know, in a **different** theme or modality than the one where
 * mastery was originally claimed. Live re-exposures (`was_live: true`)
 * carry disproportionate weight in the promotion gate — a pattern that
 * passes only in drills is not yet transferable.
 */
export interface ReExposureCheck {
  /** ISO timestamp when the re-exposure ran. */
  at: string;
  /** Whether the student produced the pattern correctly. */
  passed: boolean;
  /** Short human-readable context (e.g. "different theme: travel"). */
  context: string;
  /** True when the re-exposure happened inside a Live or mini-live session. */
  was_live: boolean;
}

/**
 * Phase 7 (F-P7-01) — rich evidence block attached to every acquiring
 * pattern. The promotion gate in 7c.3 reads these fields directly, so
 * the only source of truth for "has the student really learned this?"
 * lives here. Fields are deliberately optional on the parent so older
 * persisted models deserialise without migration; call
 * `ensurePatternEvidence()` before reading.
 */
export interface AcquiringPatternEvidence {
  /** Distinct session ids the pattern has been correctly produced in. */
  sessions_touched: string[];
  /** Distinct engagement themes the pattern has been produced in. */
  themes_seen: string[];
  /** Distinct modalities (phrase, text, roleplay, live, …). */
  modalities_seen: string[];

  /** Cumulative correct Live turns across all sessions. */
  live_turns_correct: number;
  /** Cumulative incorrect Live turns across all sessions. */
  live_turns_incorrect: number;
  /** Distinct Live session ids (roleplay or mini-live) with a correct turn. */
  live_sessions_touched: string[];
  /** Distinct themes the pattern was correctly produced in, in Live. */
  live_themes_seen: string[];
  first_live_success_at: string | null;
  last_live_success_at: string | null;

  /** Current streak of consecutive correct attempts (any modality). */
  consecutive_correct: number;
  /** Historical longest streak. */
  longest_streak: number;
  first_success_at: string | null;
  last_failure_at: string | null;

  /** Ordered list of scheduled re-exposure probes (oldest first). */
  re_exposure_checks: ReExposureCheck[];
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
  /**
   * Phase 7 (F-P7-01) — rich evidence block. Optional for back-compat
   * with models persisted before Phase 7. Use `ensurePatternEvidence`
   * to read with a safe default.
   */
  evidence?: AcquiringPatternEvidence;
  /**
   * Phase 7 (F-P7-04) — deterministic trajectory estimate derived from
   * the last K sessions of success rate. Optional for back-compat.
   */
  trajectory?: TrajectoryState;
}

/**
 * Produce a zero-initialised evidence block. Used by type guards and when
 * `acquiring.evidence_append` lands on a pattern that has no block yet.
 */
export function emptyPatternEvidence(): AcquiringPatternEvidence {
  return {
    sessions_touched: [],
    themes_seen: [],
    modalities_seen: [],
    live_turns_correct: 0,
    live_turns_incorrect: 0,
    live_sessions_touched: [],
    live_themes_seen: [],
    first_live_success_at: null,
    last_live_success_at: null,
    consecutive_correct: 0,
    longest_streak: 0,
    first_success_at: null,
    last_failure_at: null,
    re_exposure_checks: [],
  };
}

/**
 * Return a deep-copied, non-null evidence block for a pattern, hydrating
 * from `emptyPatternEvidence` when the field is missing. Callers can
 * mutate the returned object safely.
 */
export function ensurePatternEvidence(
  pattern: Pick<AcquiringPattern, 'evidence'>,
): AcquiringPatternEvidence {
  const src = pattern.evidence ?? emptyPatternEvidence();
  return {
    sessions_touched: [...src.sessions_touched],
    themes_seen: [...src.themes_seen],
    modalities_seen: [...src.modalities_seen],
    live_turns_correct: src.live_turns_correct,
    live_turns_incorrect: src.live_turns_incorrect,
    live_sessions_touched: [...src.live_sessions_touched],
    live_themes_seen: [...src.live_themes_seen],
    first_live_success_at: src.first_live_success_at,
    last_live_success_at: src.last_live_success_at,
    consecutive_correct: src.consecutive_correct,
    longest_streak: src.longest_streak,
    first_success_at: src.first_success_at,
    last_failure_at: src.last_failure_at,
    re_exposure_checks: src.re_exposure_checks.map((c) => ({ ...c })),
  };
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
  /**
   * Phase 7 (F-P7-03) — scheduled re-exposure probes. Populated by
   * `updateModel` after a pattern crosses to `mastered`; consumed by
   * `prescribe` which threads due entries into upcoming briefings.
   * Entries whose `scheduled_for` is in the past are candidates right
   * now; the prescribe loop pops them as it consumes them.
   */
  re_exposure_queue?: ReExposureQueueEntry[];
}

/**
 * Phase 7 (F-P7-03) — one scheduled re-exposure probe. Persisted in
 * `next_step_plan.re_exposure_queue[]`; consumed by `prescribe`.
 */
export interface ReExposureQueueEntry {
  pattern_id: CanonicalPatternId;
  /** ISO timestamp after which this probe becomes due. */
  scheduled_for: string;
  /** Preferred modality (Live is preferred for transfer-confirming probes). */
  preferred_modality?: 'live' | 'phrase' | 'text' | 'roleplay' | 'visual' | 'review';
  /** Themes to avoid — typically the themes the pattern was mastered under. */
  preferred_theme_exclude?: string[];
  /** Why this probe was scheduled (debug-only). */
  reason?: string;
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

// ---------------------------------------------------------------------------
// Phase 2 — Live-specific types (see docs/master-integration-plan.md §5)
// ---------------------------------------------------------------------------

/**
 * Trajectory estimate reused by `LiveFluencyProfile` and (later) by
 * `AcquiringPattern.trajectory` (Phase 7). Derived deterministically from
 * rolling-window success rates, never handed to the LLM.
 */
export type TrajectoryState = 'improving' | 'stable' | 'regressing' | 'noisy';

/**
 * Phase 2 — one raw data point per Live session. These accumulate in
 * `live_fluency_profile.session_points[]` and drive the rolling aggregates.
 * Computed post-conversation by the deterministic aggregator, not the LLM.
 */
export interface LiveSessionPoint {
  session_id: string;
  /** ISO timestamp when the session ended. */
  at: string;
  /** Scenario theme used (workplace / travel / social / …). Normalised lowercase. */
  theme: string;
  /** Session size — affects how much weight Phase 7 assigns to evidence. */
  size?: 'standard' | 'mini';
  turns_count: number;
  avg_turn_length_words: number;
  avg_response_latency_ms: number;
  abandoned_turn_count: number;
}

/**
 * Phase 2 — rolling-window fluency profile used as the app's "mother metric"
 * (§5.5 and §11.1 of the plan). Numeric aggregates are deterministic; only
 * the trajectory classification is inferred, and even that is done in code.
 */
export interface LiveFluencyProfile {
  /** Session ids that contributed to the current aggregates, most recent last. */
  sessions_considered: string[];
  avg_turn_length_words: number | null;
  median_turn_length_words: number | null;
  longest_turn_words: number | null;
  avg_response_latency_ms: number | null;
  abandoned_turn_rate: number | null;
  lexical_diversity_estimate: number | null;
  /** Distinct themes in the rolling window. Counted from `themes_in_window`. */
  distinct_themes_in_window: number;
  /** Theme ids in the rolling window, most recent last. Fed to `prescribe`. */
  themes_in_window: string[];
  trajectory: TrajectoryState;
  session_points: LiveSessionPoint[];
}

/**
 * Phase 2 — per-pattern observation block returned by `masterEvaluateLive`.
 * Explicit turn-index lists are required because Phase 7's Live-confirmed
 * mastery gate counts *distinct* correct turns across sessions and themes.
 */
export interface LiveSalientPattern {
  canonical_pattern: CanonicalPatternId;
  /** 1-based turn indices where the student produced the pattern correctly. */
  turns_correct: number[];
  /** 1-based turn indices where the student attempted the pattern incorrectly. */
  turns_incorrect: number[];
  /** Short free-text evidence (debug-only, never user-facing). */
  evidence: string;
}

/**
 * Phase 2 — shape returned by `masterEvaluateLive`. Compact on purpose: we
 * want the minimum signal needed to drive `updateLearnerModel` without
 * forcing the LLM to compute deterministic metrics it shouldn't be computing.
 */
export interface LiveMetaAssessment {
  salient_patterns_observed: LiveSalientPattern[];
  automaticity_estimate: 'low' | 'moderate' | 'high';
  confidence_estimate: 'cold' | 'recovering' | 'warm' | 'hot';
  /** Short internal note that feeds into the next `prescribe` run. */
  suggested_next_step: string;
  respects_stealth: boolean;
  /** Echoed from the scenario so Phase 7 can weight evidence. */
  session_size: 'standard' | 'mini';
  /** Echoed theme so the `updateLearnerModel` path can tag Live evidence. */
  theme: string;
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
  /**
   * Phase 2 — rolling-window Live fluency profile. Optional so older
   * persisted models stay valid; hydrated on the first Live session. See
   * `docs/master-integration-plan.md` §5.5.
   */
  live_fluency_profile?: LiveFluencyProfile;
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
  | { op: 'hard_for_user.remove'; id: CanonicalPatternId }
  /**
   * Phase 2 — replace the `live_fluency_profile` wholesale. The aggregator
   * computes the new profile deterministically in code and emits one of
   * these patches at the end of each Live session. The LLM does not touch
   * this field.
   */
  | { op: 'live_fluency.update'; profile: LiveFluencyProfile }
  /**
   * Phase 7 (F-P7-01) — append a slice of evidence to a pattern. The
   * applier deduplicates union fields (`sessions_touched`, `themes_seen`,
   * …) and accumulates counters. Emitted from the surfaces deterministically
   * by `runPipeline.ts`, never by the LLM directly.
   */
  | {
      op: 'acquiring.evidence_append';
      id: CanonicalPatternId;
      /** Session id the evidence came from (any modality). */
      session_id: string;
      /** Normalised theme label (lowercased, trimmed). */
      theme?: string;
      /** Modality the evidence was produced in. */
      modality: string;
      /** ISO timestamp of the evidence. */
      at: string;
      /** Live session id (mini or standard), if any. */
      live_session_id?: string;
      /** Live theme correctly produced in (only when correct turns > 0). */
      live_theme?: string;
      /** Correct Live turns in this session. */
      live_turns_correct?: number;
      /** Incorrect Live turns in this session. */
      live_turns_incorrect?: number;
      /** Attempts correct in this observation (any modality). */
      correct?: number;
      /** Attempts incorrect in this observation (any modality). */
      incorrect?: number;
    }
  /**
   * Phase 7 (F-P7-04) — trajectory classification. Computed deterministically
   * from the recent success-rate history. Emitted alongside evidence appends.
   */
  | {
      op: 'acquiring.trajectory_set';
      id: CanonicalPatternId;
      trajectory: TrajectoryState;
    }
  /**
   * Phase 7 (F-P7-02) — append a re-exposure probe result to a pattern.
   * Issued by the re-exposure scheduler once a probe has executed.
   */
  | {
      op: 'acquiring.re_exposure_append';
      id: CanonicalPatternId;
      check: ReExposureCheck;
    };

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
  'live_fluency.update',
  'acquiring.evidence_append',
  'acquiring.trajectory_set',
  'acquiring.re_exposure_append',
] as const;

/** Sources recognised by the `learner_model_history.source` check constraint. */
export type PatchSource =
  | 'evaluate'
  | 'update_model'
  | 'reset'
  | 'lesson_boost'
  /** Wave 6 extension; also accepted by the history check constraint in W6A migration. */
  | 'breakthrough_event'
  /**
   * Phase 2 — post-conversation Live evaluation path. Requires a matching
   * `learner_model_history_source_chk` extension (tracked in
   * `docs/pending-ops-todos.md`). Until the migration lands, writes
   * fall back to `'update_model'` so production inserts keep passing.
   */
  | 'live_meta';

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
