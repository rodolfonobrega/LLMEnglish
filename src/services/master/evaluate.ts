/**
 * Master.evaluate — Wave 5 (F13).
 *
 * After a generator produces an exercise and the standard evaluator
 * produces an `EvaluationResult`, the Master asks a second LLM to make
 * a pedagogical judgement:
 *   - Was the briefing's `target_skill` actually exercised?
 *   - Which corrections are relevant to the briefing (pinned top)?
 *   - What is the student's engagement signal?
 *   - What comes next — advance, consolidate, step back, probe breadth?
 *
 * The output is a `MetaAssessment`. Consumers (EvaluationResults,
 * Master.update_model, card selector) rely on it to reshape behaviour.
 *
 * No-op when the Master flag is off (returns `null`).
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { resolveMasterModel } from './resolveMasterModel';
import { cleanJson } from '../../utils/cleanJson';
import type { Briefing } from '../../types/master';
import type { LearnerModel } from '../../types/learnerModel';
import type { EvaluationResult } from '../../types/card';
import { normalizeCorrectionItem } from '../../types/card';

export type EngagementSignal = 'high' | 'medium' | 'low' | 'frustrated';

export type MetaRecommendation =
  | 'advance'
  | 'consolidate'
  | 'step_back'
  | 'probe_breadth';

export interface MetaAssessment {
  /** Whether the target skill was actually exercised and performed acceptably. */
  goal_met: boolean;
  /** Brief internal reasoning. Never user-facing. */
  reason?: string;
  /** Canonical pattern ids that surfaced unexpectedly (not in the briefing). */
  unexpected_errors: string[];
  engagement_signal: EngagementSignal;
  /** Correction ids from `evaluationResult.corrections[].id` that matter now. */
  relevant_correction_ids: string[];
  recommendation: MetaRecommendation;
}

const metaSchema = {
  type: 'object' as const,
  properties: {
    goal_met: { type: 'boolean' as const },
    reason: { type: 'string' as const },
    unexpected_errors: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    engagement_signal: {
      type: 'string' as const,
      enum: ['high', 'medium', 'low', 'frustrated'],
    },
    relevant_correction_ids: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    recommendation: {
      type: 'string' as const,
      enum: ['advance', 'consolidate', 'step_back', 'probe_breadth'],
    },
  },
  required: [
    'goal_met',
    'unexpected_errors',
    'engagement_signal',
    'relevant_correction_ids',
    'recommendation',
  ],
};

function compactEvaluation(ev: EvaluationResult) {
  const corrections = (ev.corrections ?? [])
    .map((c) => normalizeCorrectionItem(c))
    .map((c) => ({
      id: c.id,
      tip: c.tip,
      canonical_pattern: c.canonical_pattern,
      severity: c.severity,
      example: c.example,
    }));
  return {
    score: ev.score,
    scores5d: ev.scores5d,
    primaryDimension: ev.primaryDimension,
    corrections,
    correctedVersion: ev.correctedVersion,
    fluency_stats: ev.fluency_stats,
  };
}

function compactLearnerModel(m: LearnerModel) {
  return {
    cefr_estimate: m.cefr_estimate,
    acquiring_patterns: m.acquiring_patterns.slice(0, 5).map((p) => ({
      id: p.id,
      success_rate: p.success_rate,
    })),
    chronic_errors: m.chronic_errors.slice(0, 5).map((p) => ({
      id: p.id,
      occurrences: p.occurrences,
    })),
    strengths: m.strengths.slice(0, 5),
    engagement_profile: {
      last_session_engagement: m.engagement_profile.last_session_engagement,
      themes_that_land: m.engagement_profile.themes_that_land.slice(0, 5),
    },
    next_step_plan: m.next_step_plan,
    diagnostic_mode: m.diagnostic_mode,
    confidence: m.confidence,
  };
}

function buildSystemPrompt(): string {
  return `You are the Master's evaluator. You are given:
- The internal briefing that told the generator what to produce,
- The learner's performance captured as an EvaluationResult,
- A compact view of the LearnerModel.

Produce a MetaAssessment JSON that answers:
- goal_met: was the briefing.target_skill actually exercised AND performed acceptably (score >= 70 on the primary axis)?
- unexpected_errors: canonical pattern ids that appeared in corrections but were NOT targeted. Use the canonical_pattern on each correction; only include patterns with severity "minor" or worse that recurred or block clarity.
- engagement_signal: judge from the EvaluationResult + learner's last engagement. "frustrated" only when score is low AND corrections are dense AND fluency_stats.wpm is implausibly low (or the student attempted something very short).
- relevant_correction_ids: the 1-2 correction ids that are closest to the target_skill (or to acquiring_patterns in the LearnerModel). Use EMPTY array if nothing is clearly relevant — do NOT pad.
- recommendation:
  - advance → goal_met AND confident performance
  - consolidate → goal_met but shaky; re-expose with varied disguise
  - step_back → clearly too hard; pick a simpler sub-skill next
  - probe_breadth → unrelated emerging gap that warrants widening scope

Output strict JSON per the schema. No prose outside the JSON.`;
}

function buildUserMessage(
  briefing: Briefing,
  evaluation: EvaluationResult,
  learnerModel: LearnerModel,
): string {
  return `briefing:
${JSON.stringify(briefing, null, 2)}

evaluation:
${JSON.stringify(compactEvaluation(evaluation), null, 2)}

learner_model:
${JSON.stringify(compactLearnerModel(learnerModel), null, 2)}`;
}

export interface EvaluateInput {
  briefing: Briefing;
  evaluationResult: EvaluationResult;
  learnerModel: LearnerModel;
}

/**
 * Run the Master's meta-assessment. Returns `null` when the flag is off
 * or the LLM call fails — callers must treat `null` as "render W1 behaviour".
 */
export async function masterEvaluate(
  input: EvaluateInput,
): Promise<MetaAssessment | null> {
  if (!masterEnabled()) return null;

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(
    input.briefing,
    input.evaluationResult,
    input.learnerModel,
  );

  const resolved = resolveMasterModel('evaluate');
  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(
      systemPrompt,
      userMessage,
      { model: resolved.model, source: resolved.source },
      metaSchema,
    );
  } catch (err) {
    console.warn('[Master.evaluate] LLM call failed:', err);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.evaluate] Malformed JSON:', err);
    return null;
  }

  const meta = coerceMetaAssessment(parsed);
  if (!meta) {
    console.warn('[Master.evaluate] Schema mismatch');
    return null;
  }

  const latencyMs = Date.now() - started;
  try {
    await recordMasterUsage({
      role: 'evaluate',
      model: resolved.model,
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.evaluate] telemetry failed (swallowed):', err);
  }

  return meta;
}

function coerceMetaAssessment(raw: unknown): MetaAssessment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.goal_met !== 'boolean') return null;
  const unexpected = Array.isArray(r.unexpected_errors)
    ? r.unexpected_errors.filter((x): x is string => typeof x === 'string')
    : null;
  if (!unexpected) return null;

  const engagement = r.engagement_signal;
  if (
    typeof engagement !== 'string' ||
    !['high', 'medium', 'low', 'frustrated'].includes(engagement)
  ) {
    return null;
  }

  const relevantIds = Array.isArray(r.relevant_correction_ids)
    ? r.relevant_correction_ids.filter((x): x is string => typeof x === 'string')
    : null;
  if (!relevantIds) return null;

  const rec = r.recommendation;
  if (
    typeof rec !== 'string' ||
    !['advance', 'consolidate', 'step_back', 'probe_breadth'].includes(rec)
  ) {
    return null;
  }

  return {
    goal_met: r.goal_met,
    reason: typeof r.reason === 'string' ? r.reason : undefined,
    unexpected_errors: unexpected,
    engagement_signal: engagement as EngagementSignal,
    relevant_correction_ids: relevantIds,
    recommendation: rec as MetaRecommendation,
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
