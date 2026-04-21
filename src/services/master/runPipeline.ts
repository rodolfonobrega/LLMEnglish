/**
 * runPipeline — Phase 1 (F-P1-02, F-P1-03, F-P1-04)
 *
 * Thin wrappers that every surface uses to feed the Master instead of
 * each component re-implementing the "load learner model → evaluate →
 * updateLearnerModel" dance that `useExerciseEvaluation.ts` already
 * does.
 *
 * Three entry points:
 *
 *   - `runMasterPipeline`: surfaces that already produce a 5D
 *     `EvaluationResult` (Reformulation, NarrativeContinuation,
 *     DirectedListening, ImageMode, ReviewPage).
 *
 *   - `recordDrillOutcome`: drills with binary per-round signal and no
 *     5D evaluation (OralCloze, ErrorSpotting, ReactionDrill,
 *     ActiveShadowing). Emits a short acquiring.upsert / chronic
 *     patch rather than calling the LLM evaluator.
 *
 *   - `recordEngagement`: surfaces with no evaluation at all (Scripts
 *     page) — just note that the student is engaged with a theme.
 *
 * All three are fire-and-forget from the caller's perspective. They
 * check `masterEnabled()` internally and swallow errors with warnings.
 */

import { masterEnabled } from '../runtimeConfigSnapshot';
import { getCurrentUser } from '../supabase/auth';
import { loadLearnerModel, applyPatches, savePatchedModel } from '../learnerModel';
import { masterEvaluate } from './evaluate';
import { masterEvaluateLive } from './evaluateLive';
import { updateLearnerModel } from './updateModel';
import {
  computeLiveSessionPoint,
  mergeIntoProfile,
} from './liveFluencyAggregator';
import { computeTrajectory, type TrajectorySample } from './trajectoryEstimator';
import { ensurePatternEvidence } from '../../types/learnerModel';
import type { MetaAssessment } from './evaluate';
import type { Briefing, Modality } from '../../types/master';
import type { EvaluationResult } from '../../types/card';
import type {
  AcquiringPattern,
  LearnerModel,
  LiveMetaAssessment,
  PatchOp,
  TrajectoryState,
} from '../../types/learnerModel';
import type { ConversationTurn, LiveScenario } from '../../types/scenario';

// ---------------------------------------------------------------------------
// Phase 7 helpers — evidence + trajectory patches
// ---------------------------------------------------------------------------

/**
 * Per-pattern slice of evidence produced by a single surface-level event.
 * Fields mirror the `acquiring.evidence_append` patch op.
 */
interface EvidenceSlice {
  patternId: string;
  sessionId: string;
  theme?: string;
  modality: string;
  at: string;
  correct?: number;
  incorrect?: number;
  /** When > 0 a Live-session-touched entry is written. */
  live_turns_correct?: number;
  live_turns_incorrect?: number;
  live_session_id?: string;
  live_theme?: string;
}

/**
 * Phase 7 (F-P7-01 + F-P7-04) — emit `acquiring.evidence_append` per slice
 * **and** a `acquiring.trajectory_set` derived from the pattern's recent
 * history (hydrated after the evidence patches are projected onto the
 * model). Returns a flat patch list ready to concatenate onto a larger
 * patch set. Pure helper — no I/O, no LLM.
 */
function buildEvidencePatches(
  learnerModel: LearnerModel,
  slices: EvidenceSlice[],
): PatchOp[] {
  if (slices.length === 0) return [];

  const patches: PatchOp[] = [];
  for (const s of slices) {
    patches.push({
      op: 'acquiring.evidence_append',
      id: s.patternId,
      session_id: s.sessionId,
      theme: s.theme,
      modality: s.modality,
      at: s.at,
      correct: s.correct,
      incorrect: s.incorrect,
      ...(s.live_turns_correct !== undefined ? { live_turns_correct: s.live_turns_correct } : {}),
      ...(s.live_turns_incorrect !== undefined ? { live_turns_incorrect: s.live_turns_incorrect } : {}),
      ...(s.live_session_id ? { live_session_id: s.live_session_id } : {}),
      ...(s.live_theme ? { live_theme: s.live_theme } : {}),
    });
  }

  // Project per-pattern history to feed the trajectory estimator. We group
  // slices by pattern and append the observation's post-slice success rate
  // to the pattern's prior history. Because we don't persist a full history
  // timeline we approximate using the current learner-model entry plus the
  // new observation — it is enough for "improving / stable / regressing"
  // classification on recent data, which is all Phase 7 uses.
  const byPattern = new Map<string, EvidenceSlice[]>();
  for (const s of slices) {
    if (!byPattern.has(s.patternId)) byPattern.set(s.patternId, []);
    byPattern.get(s.patternId)!.push(s);
  }

  for (const [patternId, list] of byPattern.entries()) {
    const existing = learnerModel.acquiring_patterns.find((p) => p.id === patternId);
    const history: TrajectorySample[] = buildHistoryFromPattern(existing, list);
    if (history.length < 3) continue; // not enough signal yet
    const trajectory: TrajectoryState = computeTrajectory({ history });
    patches.push({
      op: 'acquiring.trajectory_set',
      id: patternId,
      trajectory,
    });
  }

  return patches;
}

/**
 * Build a rough `TrajectorySample[]` tail by combining the pattern's
 * persisted `last_seen` rate with the fresh slices. We cannot reconstruct
 * the full history from the current shape (we persist only the latest
 * rolling rate), but the estimator only needs the last few points.
 */
function buildHistoryFromPattern(
  existing: AcquiringPattern | undefined,
  slices: EvidenceSlice[],
): TrajectorySample[] {
  const samples: TrajectorySample[] = [];
  if (existing) {
    // One anchor from persisted state.
    samples.push({ at: existing.last_seen, success_rate: existing.success_rate });
    const evidence = ensurePatternEvidence(existing);
    // Synthetic second anchor derived from recent failures — keeps the
    // estimator from concluding "improving" off a single point.
    if (evidence.last_failure_at && samples.length < 2) {
      samples.push({ at: evidence.last_failure_at, success_rate: Math.max(0, existing.success_rate - 0.1) });
    }
  }
  for (const s of slices) {
    const c = Math.max(0, Math.floor(s.correct ?? s.live_turns_correct ?? 0));
    const i = Math.max(0, Math.floor(s.incorrect ?? s.live_turns_incorrect ?? 0));
    const total = c + i;
    if (total === 0) continue;
    samples.push({ at: s.at, success_rate: c / total });
  }
  return samples;
}

/** Context passed by surfaces that already run a 5D evaluation. */
export interface MasterPipelineInput {
  evaluationResult: EvaluationResult;
  /** The Master briefing that shaped this session, when present. */
  briefing: Briefing | null | undefined;
  /** Modality the surface uses when no briefing is available. */
  fallbackModality: Modality;
  /** Optional theme label used for the session_summary. */
  fallbackTheme?: string;
  /** Optional pattern id that the surface was intentionally drilling. */
  fallbackTargetSkill?: string;
  /** Duration in minutes for engagement sizing (optional). */
  durationMin?: number;
}

export interface MasterPipelineResult {
  meta: MetaAssessment | null;
  triggered: boolean;
}

/**
 * Post-evaluation pipeline — run Master.evaluate + updateLearnerModel.
 *
 * When the Master flag is off, returns `{ meta: null, triggered: false }`
 * and does nothing. Callers do not need to gate around it.
 *
 * `briefing` is optional. Without it, `masterEvaluate` is skipped (it
 * needs a briefing to judge goal_met), and we still fire
 * `updateLearnerModel` so evidence of this session touches the model.
 */
export async function runMasterPipeline(
  input: MasterPipelineInput,
): Promise<MasterPipelineResult> {
  if (!masterEnabled()) return { meta: null, triggered: false };

  try {
    const user = getCurrentUser();
    if (!user) return { meta: null, triggered: false };

    const learnerModel = await loadLearnerModel(user.id);

    let meta: MetaAssessment | null = null;
    if (input.briefing) {
      try {
        meta = await masterEvaluate({
          briefing: input.briefing,
          evaluationResult: input.evaluationResult,
          learnerModel,
        });
      } catch (evalErr) {
        console.warn('[runMasterPipeline] masterEvaluate failed (swallowed):', evalErr);
      }
    }

    // Phase 7 (F-P7-01 + F-P7-04) — accumulate rich evidence + trajectory
    // for any pattern that the 5D evaluation or the briefing pins down.
    // These patches travel alongside the LLM-proposed patch set inside
    // `updateLearnerModel`, so the 7-rule gate sees them too.
    const modality: Modality = input.briefing?.modality_choice ?? input.fallbackModality;
    const theme = input.briefing?.disguise_theme ?? input.fallbackTheme;
    const targetPattern = input.briefing?.target_skill ?? input.fallbackTargetSkill;
    const now = new Date().toISOString();
    const correctSignal = input.evaluationResult.score >= 7 ? 1 : 0;
    const incorrectSignal = 1 - correctSignal;
    const slices: EvidenceSlice[] = [];
    if (targetPattern) {
      slices.push({
        patternId: targetPattern,
        sessionId: `surface:${modality}:${now}`,
        theme,
        modality,
        at: now,
        correct: correctSignal,
        incorrect: incorrectSignal,
      });
    }
    const extraPatches = buildEvidencePatches(learnerModel, slices);

    void updateLearnerModel({
      learnerModel,
      evaluationResult: input.evaluationResult,
      metaAssessment: meta,
      extraPatches,
      sessionSummary: {
        userId: user.id,
        modality,
        disguiseTheme: theme,
        targetSkill: targetPattern,
        endedAt: now,
        durationMin: input.durationMin,
      },
    });

    return { meta, triggered: true };
  } catch (err) {
    console.warn('[runMasterPipeline] swallowed error:', err);
    return { meta: null, triggered: false };
  }
}

// ---------------------------------------------------------------------------
// Drill outcome (F-P1-03) — binary per-round drills without 5D
// ---------------------------------------------------------------------------

export interface DrillOutcome {
  /** Canonical pattern id being drilled, if any (preferred over briefing.target_skill). */
  canonicalPattern?: string;
  /** Total attempts in this drill session (rounds). */
  attempts: number;
  /** Attempts considered correct (matches the success bar of the drill). */
  correct: number;
  /** Modality the drill runs on. */
  modality: Modality;
  /** Optional theme label for traceability. */
  theme?: string;
  /** Optional hypothesis / reason string for the pattern note. */
  hypothesis?: string;
}

/**
 * Record a drill outcome without a full LLM evaluate call. Emits a
 * tiny patch set reflecting the drill's binary signal:
 *
 *   - `acquiring.upsert` with blended success_rate/attempts when the
 *     drill targeted a canonical pattern.
 *   - `engagement.update` with `last_session_engagement` bumped (or
 *     lowered when the drill was mostly wrong).
 *
 * Never throws. Fire-and-forget.
 */
export async function recordDrillOutcome(
  briefing: Briefing | null | undefined,
  outcome: DrillOutcome,
): Promise<void> {
  if (!masterEnabled()) return;

  try {
    const user = getCurrentUser();
    if (!user) return;

    const learnerModel = await loadLearnerModel(user.id);

    const patternId = outcome.canonicalPattern ?? briefing?.target_skill ?? null;
    const attempts = Math.max(1, Math.floor(outcome.attempts));
    const correct = Math.min(attempts, Math.max(0, Math.floor(outcome.correct)));
    const roundRate = correct / attempts;

    const patches: PatchOp[] = [];

    const nowIso = new Date().toISOString();
    if (patternId) {
      const existing = learnerModel.acquiring_patterns.find((p) => p.id === patternId);
      const priorRate = existing?.success_rate ?? 0;
      const priorAttempts = existing?.attempts ?? 0;
      const blendedAttempts = priorAttempts + attempts;
      const blendedRate =
        blendedAttempts > 0
          ? (priorRate * priorAttempts + roundRate * attempts) / blendedAttempts
          : roundRate;

      patches.push({
        op: 'acquiring.upsert',
        id: patternId,
        success_rate: Math.max(0, Math.min(1, blendedRate)),
        attempts: blendedAttempts,
        last_seen: nowIso,
        hypothesis: outcome.hypothesis ?? existing?.hypothesis,
      });

      // Phase 7 — evidence + trajectory for the drill slice.
      const evidencePatches = buildEvidencePatches(learnerModel, [
        {
          patternId,
          sessionId: `drill:${outcome.modality}:${nowIso}`,
          theme: outcome.theme,
          modality: outcome.modality,
          at: nowIso,
          correct,
          incorrect: attempts - correct,
        },
      ]);
      patches.push(...evidencePatches);
    }

    const engagement: 'high' | 'medium' | 'low' | 'frustrated' =
      roundRate >= 0.7 ? 'high' : roundRate >= 0.4 ? 'medium' : 'low';
    patches.push({
      op: 'engagement.update',
      patch: {
        last_session_engagement: engagement,
      },
    });

    if (patches.length === 0) return;

    const nextModel: LearnerModel = applyPatches(learnerModel, patches);
    await savePatchedModel(
      user.id,
      nextModel,
      patches,
      `drill_outcome:${outcome.modality}:${correct}/${attempts}`,
      'update_model',
    );
  } catch (err) {
    console.warn('[recordDrillOutcome] swallowed error:', err);
  }
}

// ---------------------------------------------------------------------------
// Engagement record (F-P1-04) — surfaces with no evaluation at all
// ---------------------------------------------------------------------------

/**
 * Record a soft engagement touch — the student chose to engage with a
 * theme / intent even if no evaluation ran (e.g. Scripts page).
 *
 * Appends the theme to `engagement_profile.themes_that_land` without
 * tracking any acquisition.
 */
export async function recordEngagement(theme: string, intent?: string): Promise<void> {
  if (!masterEnabled()) return;

  try {
    const user = getCurrentUser();
    if (!user) return;

    const learnerModel = await loadLearnerModel(user.id);

    const existingThemes = learnerModel.engagement_profile.themes_that_land ?? [];
    const normalised = theme.trim().toLowerCase();
    if (!normalised) return;

    const nextThemes = existingThemes.includes(normalised)
      ? existingThemes
      : [...existingThemes, normalised].slice(-20);

    const patches: PatchOp[] = [
      {
        op: 'engagement.update',
        patch: {
          themes_that_land: nextThemes,
        },
      },
    ];

    const nextModel = applyPatches(learnerModel, patches);
    await savePatchedModel(
      user.id,
      nextModel,
      patches,
      intent ? `engagement:${intent}` : 'engagement:touch',
      'update_model',
    );
  } catch (err) {
    console.warn('[recordEngagement] swallowed error:', err);
  }
}

// ---------------------------------------------------------------------------
// Live pipeline (F-P2-01 / F-P2-04)
// ---------------------------------------------------------------------------

/** Input passed by `ConversationAnalysis` after a Live session finishes. */
export interface LivePipelineInput {
  sessionId: string;
  scenario: LiveScenario;
  turns: ConversationTurn[];
  endedAt: string;
  /** Optional briefing — when `prescribe` drove the session (Phase 2.2/2.3). */
  briefing?: Briefing | null;
}

export interface LivePipelineResult {
  meta: LiveMetaAssessment | null;
  triggered: boolean;
}

/**
 * Post-conversation pipeline: deterministic `LiveFluencyProfile` aggregation
 * + LLM `LiveMetaAssessment` + per-pattern acquiring/chronic patches. Never
 * throws. Fire-and-forget from the caller.
 *
 * Notes:
 *   - We ALWAYS emit the `live_fluency.update` patch, even when the LLM
 *     call fails, because the numeric aggregates are the mother metric and
 *     must not depend on model availability.
 *   - When `masterEvaluateLive` returns a meta, we translate its turn
 *     arrays into one `acquiring.upsert` per salient pattern (blended with
 *     any existing entry) and one `chronic.upsert` for patterns the student
 *     missed in Live. Phase 7 will later layer the richer evidence struct
 *     on top of this; here we only maintain the existing shape so Phase 7
 *     has a foundation to build on.
 */
export async function runLivePipeline(
  input: LivePipelineInput,
): Promise<LivePipelineResult> {
  if (!masterEnabled()) return { meta: null, triggered: false };

  try {
    const user = getCurrentUser();
    if (!user) return { meta: null, triggered: false };

    const learnerModel = await loadLearnerModel(user.id);

    const scenarioTheme =
      input.scenario.masterDisguiseTheme?.trim() ||
      input.scenario.theme.trim();

    const sessionPoint = computeLiveSessionPoint({
      sessionId: input.sessionId,
      turns: input.turns,
      theme: scenarioTheme,
      size: input.scenario.mode ?? 'standard',
      endedAt: input.endedAt,
    });
    const nextProfile = mergeIntoProfile(
      learnerModel.live_fluency_profile,
      sessionPoint,
    );

    let meta: LiveMetaAssessment | null = null;
    try {
      meta = await masterEvaluateLive({
        turns: input.turns,
        scenario: input.scenario,
        learnerModel,
        pedagogicalIntent: input.briefing
          ? {
              target_skill: input.briefing.target_skill,
              disguise_theme: input.briefing.disguise_theme,
            }
          : undefined,
      });
    } catch (err) {
      console.warn('[runLivePipeline] masterEvaluateLive failed (swallowed):', err);
    }

    const patches: PatchOp[] = [
      { op: 'live_fluency.update', profile: nextProfile },
    ];

    const now = new Date().toISOString();

    if (meta) {
      const evidenceSlices: EvidenceSlice[] = [];
      for (const pattern of meta.salient_patterns_observed) {
        const existing = learnerModel.acquiring_patterns.find(
          (p) => p.id === pattern.canonical_pattern,
        );
        const attemptsDelta = pattern.turns_correct.length + pattern.turns_incorrect.length;
        if (attemptsDelta === 0) continue;

        const priorRate = existing?.success_rate ?? 0;
        const priorAttempts = existing?.attempts ?? 0;
        const roundRate = pattern.turns_correct.length / attemptsDelta;
        const blendedAttempts = priorAttempts + attemptsDelta;
        const blendedRate =
          blendedAttempts > 0
            ? (priorRate * priorAttempts + roundRate * attemptsDelta) / blendedAttempts
            : roundRate;

        patches.push({
          op: 'acquiring.upsert',
          id: pattern.canonical_pattern,
          success_rate: Math.max(0, Math.min(1, blendedRate)),
          attempts: blendedAttempts,
          last_seen: now,
          hypothesis: pattern.evidence || existing?.hypothesis,
        });

        if (pattern.turns_incorrect.length > 0 && pattern.turns_correct.length === 0) {
          const chronic = learnerModel.chronic_errors.find(
            (c) => c.id === pattern.canonical_pattern,
          );
          patches.push({
            op: 'chronic.upsert',
            id: pattern.canonical_pattern,
            occurrences: (chronic?.occurrences ?? 0) + pattern.turns_incorrect.length,
            last_seen: now,
            teaching_attempts: chronic?.teaching_attempts ?? 0,
            hypothesis: pattern.evidence || chronic?.hypothesis,
          });
        }

        // Phase 7 — Live evidence slice. We tag it with the session id and
        // the scenario theme so the promotion gate sees Live-specific
        // counters (`live_turns_correct`, `live_sessions_touched`,
        // `live_themes_seen`).
        evidenceSlices.push({
          patternId: pattern.canonical_pattern,
          sessionId: `live:${input.sessionId}`,
          theme: scenarioTheme,
          modality: 'live',
          at: now,
          correct: pattern.turns_correct.length,
          incorrect: pattern.turns_incorrect.length,
          live_turns_correct: pattern.turns_correct.length,
          live_turns_incorrect: pattern.turns_incorrect.length,
          live_session_id: input.sessionId,
          live_theme: scenarioTheme,
        });
      }
      const livePatches = buildEvidencePatches(learnerModel, evidenceSlices);
      patches.push(...livePatches);

      patches.push({
        op: 'engagement.update',
        patch: {
          last_session_engagement: engagementFromMeta(meta),
        },
      });
    }

    const nextModel = applyPatches(learnerModel, patches);
    await savePatchedModel(
      user.id,
      nextModel,
      patches,
      `live:${input.sessionId}:${input.scenario.mode ?? 'standard'}:${scenarioTheme.toLowerCase()}`,
      'live_meta',
    );

    return { meta, triggered: true };
  } catch (err) {
    console.warn('[runLivePipeline] swallowed error:', err);
    return { meta: null, triggered: false };
  }
}

function engagementFromMeta(meta: LiveMetaAssessment): 'high' | 'medium' | 'low' | 'frustrated' {
  if (meta.automaticity_estimate === 'high' && meta.confidence_estimate !== 'cold') return 'high';
  if (meta.automaticity_estimate === 'low' && meta.confidence_estimate === 'cold') return 'frustrated';
  if (meta.automaticity_estimate === 'low') return 'low';
  return 'medium';
}
