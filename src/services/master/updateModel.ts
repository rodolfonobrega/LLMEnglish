/**
 * Master.update_model — Wave 5 (F14, F21).
 *
 * After a session finishes, the Master takes:
 *   - the fresh `EvaluationResult`,
 *   - the `MetaAssessment` (or null when evaluate failed),
 *   - a short `sessionSummary` (what modality ran, what theme, outcome),
 *   - the current `LearnerModel`,
 * and asks an LLM to propose a list of typed `PatchOp`s. The patches
 * flow through the deterministic `applyPatches` in `learnerModel.ts`
 * and are persisted via `savePatchedModel`. Unknown ops are ignored
 * by the applier — the schema stays stable over hundreds of updates.
 *
 * The function also folds in CLIENT-SIDE frustration detection (F21):
 * we maintain a small rolling history in-memory and, when heuristics
 * fire, we APPEND an `engagement.update` / `plan.set` patch pair to
 * whatever the LLM produced. This is non-negotiable — it's the
 * anti-fatigue floor.
 *
 * Runs fire-and-forget from the student flow: the caller does NOT
 * await this. Errors are swallowed and logged.
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { cleanJson } from '../../utils/cleanJson';
import { applyPatches, savePatchedModel } from '../learnerModel';
import type {
  LearnerModel,
  PatchOp,
  PatchSource,
} from '../../types/learnerModel';
import type { EvaluationResult } from '../../types/card';
import type { MetaAssessment } from './evaluate';

export interface SessionSummary {
  userId: string;
  modality: string;
  disguiseTheme?: string;
  targetSkill?: string;
  /** Timestamp when the session ended. */
  endedAt: string;
  /** Best-effort duration in minutes for engagement profile sizing. */
  durationMin?: number;
}

export interface UpdateModelInput {
  learnerModel: LearnerModel;
  evaluationResult: EvaluationResult;
  metaAssessment: MetaAssessment | null;
  sessionSummary: SessionSummary;
  /** Wave 6 hook: when true, saves history with source 'lesson_boost'. */
  lessonBoost?: boolean;
}

// ---------------------------------------------------------------------------
// Frustration detection (F21) — per-user rolling window
// ---------------------------------------------------------------------------

interface FrustrationWindow {
  recentGoalMet: boolean[]; // most recent last
  recentPrimaryScore: number[];
  recentEngagement: string[];
}

const MAX_WINDOW = 5;
const frustrationState = new Map<string, FrustrationWindow>();

/** Exposed for tests — clears per-user rolling history. */
export function resetFrustrationState(): void {
  frustrationState.clear();
}

/**
 * Push a new session sample into the rolling window. Exported so tests can
 * drive the window without running the full LLM pipeline.
 */
export function pushFrustrationSample(
  userId: string,
  meta: MetaAssessment | null,
  ev: EvaluationResult,
): FrustrationWindow {
  return updateFrustrationWindow(userId, meta, ev);
}

function updateFrustrationWindow(
  userId: string,
  meta: MetaAssessment | null,
  ev: EvaluationResult,
): FrustrationWindow {
  const existing = frustrationState.get(userId) ?? {
    recentGoalMet: [],
    recentPrimaryScore: [],
    recentEngagement: [],
  };
  const primaryKey = ev.primaryDimension;
  const primaryScore =
    primaryKey && ev.scores5d
      ? ev.scores5d[primaryKey as keyof typeof ev.scores5d]
      : ev.score !== undefined
        ? Math.round(ev.score * 10)
        : undefined;

  const next: FrustrationWindow = {
    recentGoalMet: [...existing.recentGoalMet, meta?.goal_met ?? true].slice(-MAX_WINDOW),
    recentPrimaryScore: [
      ...existing.recentPrimaryScore,
      typeof primaryScore === 'number' ? primaryScore : 50,
    ].slice(-MAX_WINDOW),
    recentEngagement: [
      ...existing.recentEngagement,
      meta?.engagement_signal ?? 'medium',
    ].slice(-MAX_WINDOW),
  };
  frustrationState.set(userId, next);
  return next;
}

/**
 * Evaluate the rolling window and return forced patches when frustration
 * criteria are met. Empty array means the window is healthy.
 */
export function detectFrustrationPatches(
  userId: string,
  model: LearnerModel,
): PatchOp[] {
  const w = frustrationState.get(userId);
  if (!w) return [];

  const lastThreeGoalMet = w.recentGoalMet.slice(-3);
  const threeConsecutiveMisses =
    lastThreeGoalMet.length === 3 && lastThreeGoalMet.every((v) => !v);

  const lastThreeScores = w.recentPrimaryScore.slice(-3);
  const rollingScoreLow =
    lastThreeScores.length === 3 &&
    lastThreeScores.reduce((a, b) => a + b, 0) / 3 < 40;

  const engagementTrendedDown = (() => {
    const slice = w.recentEngagement.slice(-3);
    if (slice.length < 2) return false;
    const firstHealthy = ['high', 'medium'].includes(slice[0]);
    const recentFrustrated = ['low', 'frustrated'].some((s) =>
      slice.slice(-2).includes(s),
    );
    return firstHealthy && recentFrustrated;
  })();

  if (!(threeConsecutiveMisses || rollingScoreLow || engagementTrendedDown)) {
    return [];
  }

  const fallbackTheme =
    model.engagement_profile.themes_that_land[0] ?? 'weekend plans';

  return [
    {
      op: 'engagement.update',
      patch: { last_session_engagement: 'frustrated' },
    },
    {
      op: 'plan.set',
      plan: {
        primary_goal: model.next_step_plan.primary_goal,
        expected_difficulty: 'easy',
        rationale: `Frustration detected (consecutive_misses=${threeConsecutiveMisses}, rolling_score_low=${rollingScoreLow}, engagement_trend_down=${engagementTrendedDown}). Widening scope and switching theme to ${fallbackTheme}.`,
        avoid_for_now: model.next_step_plan.avoid_for_now,
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// LLM plumbing
// ---------------------------------------------------------------------------

const patchSchema = {
  type: 'object' as const,
  properties: {
    patches: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          op: { type: 'string' as const },
        },
        required: ['op'],
        additionalProperties: true,
      },
    },
    reason: { type: 'string' as const },
  },
  required: ['patches', 'reason'],
};

function buildSystemPrompt(): string {
  return `You are the Master's update_model role. You inspect the session outcome and propose a SMALL list of typed patches to evolve the LearnerModel.

Allowed patch ops (closed set — other ops will be silently ignored):
- cefr.set { level, confidence, target? }
- mastered.add { id }
- mastered.remove { id }
- acquiring.upsert { id, success_rate, attempts, last_seen, hypothesis? }
- acquiring.remove { id }
- chronic.upsert { id, occurrences, last_seen, teaching_attempts, hypothesis? }
- chronic.remove { id }
- strengths.set { list: string[] }
- engagement.update { patch: Partial<EngagementProfile> }
- plan.set { plan: NextStepPlan }
- diagnostic.set { value: boolean }
- confidence.set { value: number }

RULES:
- Prefer upserts over wholesale replacements; only use plan.set when the next goal actually changes.
- When a pattern crosses the "mastered" bar (success_rate >= 0.8 with attempts >= 5), emit mastered.add and acquiring.remove for the same id.
- Never emit pedagogical leakage in rationales; they're internal but we test for it.
- In diagnostic_mode, after the 5th session with confidence >= 0.4 (or confidence >= 0.6 at any time), emit diagnostic.set with value=false.
- Output STRICT JSON: { "patches": [...], "reason": "short diagnostic" }. Nothing else.`;
}

function buildUserMessage(input: UpdateModelInput): string {
  return `learner_model:
${JSON.stringify(input.learnerModel, null, 2)}

evaluation:
${JSON.stringify(
  {
    score: input.evaluationResult.score,
    scores5d: input.evaluationResult.scores5d,
    primaryDimension: input.evaluationResult.primaryDimension,
    corrections: input.evaluationResult.corrections,
    fluency_stats: input.evaluationResult.fluency_stats,
  },
  null,
  2,
)}

meta_assessment:
${JSON.stringify(input.metaAssessment, null, 2)}

session_summary:
${JSON.stringify(input.sessionSummary, null, 2)}

Propose the next patches.`;
}

function coercePatches(raw: unknown): { patches: PatchOp[]; reason: string } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const reason = typeof r.reason === 'string' ? r.reason : '';
  const rawPatches = Array.isArray(r.patches) ? r.patches : null;
  if (!rawPatches) return null;
  // Keep anything that looks like { op: string, ... }. The applier's
  // switch is the real schema guardrail — unknown ops get warned and
  // ignored there. That's what lets the LearnerModel stay stable.
  const patches = rawPatches.filter(
    (p): p is PatchOp =>
      typeof p === 'object' && p !== null && typeof (p as { op?: unknown }).op === 'string',
  );
  return { patches, reason };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UpdateModelResult {
  nextModel: LearnerModel;
  patches: PatchOp[];
  reason: string;
  source: PatchSource;
  forcedByFrustration: boolean;
}

/**
 * Runs the LLM patch loop, applies the patches, and — unless the
 * Master is disabled — persists the new model.
 *
 * Fire-and-forget in the student flow: the caller does NOT await this.
 */
export async function updateLearnerModel(
  input: UpdateModelInput,
): Promise<UpdateModelResult | null> {
  if (!masterEnabled()) return null;

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(systemPrompt, userMessage, undefined, patchSchema);
  } catch (err) {
    console.warn('[Master.update_model] LLM call failed:', err);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.update_model] Malformed JSON:', err);
    return null;
  }

  const coerced = coercePatches(parsed);
  if (!coerced) {
    console.warn('[Master.update_model] Schema mismatch');
    return null;
  }
  let { patches, reason } = coerced;

  // Fold in frustration-forced patches AFTER the LLM's proposals so they
  // override scope/engagement decisions.
  updateFrustrationWindow(input.sessionSummary.userId, input.metaAssessment, input.evaluationResult);
  const forced = detectFrustrationPatches(input.sessionSummary.userId, input.learnerModel);
  const forcedByFrustration = forced.length > 0;
  if (forcedByFrustration) {
    patches = [...patches, ...forced];
    reason =
      (reason ? reason + ' ' : '') +
      '[frustration-guard] added engagement + plan adjustments.';
  }

  const nextModel = applyPatches(input.learnerModel, patches);
  const source: PatchSource = input.lessonBoost ? 'lesson_boost' : 'update_model';

  const latencyMs = Date.now() - started;
  try {
    await recordMasterUsage({
      role: 'update_model',
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.update_model] telemetry failed (swallowed):', err);
  }

  try {
    await savePatchedModel(input.sessionSummary.userId, nextModel, patches, reason, source);
  } catch (err) {
    console.warn('[Master.update_model] save failed (swallowed):', err);
  }

  return { nextModel, patches, reason, source, forcedByFrustration };
}
