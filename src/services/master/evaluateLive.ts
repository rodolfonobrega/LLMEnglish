/**
 * Master.evaluateLive — Phase 2 (F-P2-01).
 *
 * Post-conversation Live evaluation. Runs once per finished Live session
 * after `ConversationAnalysis` has already produced its user-facing
 * feedback. Returns a compact `LiveMetaAssessment` that feeds
 * `updateLearnerModel` with:
 *   - per-pattern `turns_correct[]` / `turns_incorrect[]` indices
 *     (required by Phase 7's Live-confirmed mastery gate),
 *   - per-session automaticity/confidence estimates,
 *   - an internal `suggested_next_step` string for the next prescribe run.
 *
 * No-op when the Master flag is off (returns `null`). All errors are
 * swallowed with a warning so a telemetry outage or a schema mismatch
 * never blocks the Live UX.
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { resolveMasterModel } from './resolveMasterModel';
import { cleanJson } from '../../utils/cleanJson';
import {
  getLiveConversationMasterPrompt,
  liveConversationMasterResponseSchema,
} from '../../utils/prompts';
import type {
  LearnerModel,
  LiveMetaAssessment,
  LiveSalientPattern,
} from '../../types/learnerModel';
import type { CanonicalPatternId } from '../../types/card';
import type { ConversationTurn, LiveScenario } from '../../types/scenario';

export interface EvaluateLiveInput {
  /** Raw turns as stored on the LiveSession. */
  turns: ConversationTurn[];
  scenario: LiveScenario;
  learnerModel: LearnerModel;
  /**
   * Optional pedagogical intent piped through from `prescribe` (Phase 8).
   * When present we surface it to the evaluator so it can weight
   * `turns_correct` toward the intended skill.
   */
  pedagogicalIntent?: {
    target_skill?: string;
    disguise_theme?: string;
  };
}

/**
 * Run the Master's Live evaluation. Returns `null` when masterEnabled is
 * off, when the LLM call fails, or when the output doesn't match the
 * schema. Callers must treat `null` as "skip Live-specific updates and
 * fall back to the numeric aggregator alone".
 */
export async function masterEvaluateLive(
  input: EvaluateLiveInput,
): Promise<LiveMetaAssessment | null> {
  if (!masterEnabled()) return null;

  if (input.turns.length === 0) return null;
  const hasUserTurn = input.turns.some((t) => t.role === 'user');
  if (!hasUserTurn) return null;

  const promptInput = {
    turns: input.turns.map((t) => ({ role: t.role, text: t.text })),
    scenario: {
      theme: input.scenario.theme,
      descriptionPt: input.scenario.descriptionPt,
      userRole: input.scenario.userRole,
      aiRole: input.scenario.aiRole,
      size: input.scenario.mode ?? 'standard',
      target_skill:
        input.pedagogicalIntent?.target_skill ?? input.scenario.masterTargetSkill,
      disguise_theme:
        input.pedagogicalIntent?.disguise_theme ?? input.scenario.masterDisguiseTheme,
    },
    learnerModel: {
      cefr_level: input.learnerModel.cefr_estimate.level,
      acquiring_patterns: input.learnerModel.acquiring_patterns.slice(0, 5).map((p) => ({
        id: p.id,
        success_rate: p.success_rate,
      })),
      chronic_errors: input.learnerModel.chronic_errors.slice(0, 5).map((p) => ({
        id: p.id,
        occurrences: p.occurrences,
      })),
      mastered_patterns: input.learnerModel.mastered_patterns.slice(0, 10),
    },
  };

  const { system, user } = getLiveConversationMasterPrompt(promptInput);

  const resolved = resolveMasterModel('live_meta');
  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(
      system,
      user,
      { model: resolved.model, source: resolved.source },
      liveConversationMasterResponseSchema,
    );
  } catch (err) {
    console.warn('[Master.evaluateLive] LLM call failed:', err);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.evaluateLive] Malformed JSON:', err);
    return null;
  }

  const coerced = coerceLiveMetaAssessment(parsed, input.turns.length, input.scenario.theme);
  if (!coerced) {
    console.warn('[Master.evaluateLive] Schema mismatch');
    return null;
  }

  const latencyMs = Date.now() - started;
  try {
    await recordMasterUsage({
      role: 'live_meta',
      model: resolved.model,
      latencyMs,
      tokensIn: estimateTokens(system + user),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.evaluateLive] telemetry failed (swallowed):', err);
  }

  return coerced;
}

/**
 * Defensive coercion. Rejects obviously malformed outputs but tolerates
 * the LLM nudging fields slightly (extra whitespace, odd casing on the
 * enums, etc.). Also trims per-turn indices to the dialogue's real length
 * to prevent garbage downstream.
 */
function coerceLiveMetaAssessment(
  raw: unknown,
  totalTurns: number,
  scenarioTheme: string,
): LiveMetaAssessment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const patternsRaw = r.salient_patterns_observed;
  if (!Array.isArray(patternsRaw)) return null;

  const patterns: LiveSalientPattern[] = [];
  for (const p of patternsRaw) {
    if (typeof p !== 'object' || p === null) continue;
    const pp = p as Record<string, unknown>;
    const canonical = typeof pp.canonical_pattern === 'string' ? pp.canonical_pattern : null;
    if (!canonical) continue;
    const correct = sanitizeTurnIndices(pp.turns_correct, totalTurns);
    const incorrect = sanitizeTurnIndices(pp.turns_incorrect, totalTurns);
    if (correct.length === 0 && incorrect.length === 0) continue;
    const evidence = typeof pp.evidence === 'string' ? pp.evidence : '';
    patterns.push({
      canonical_pattern: canonical as CanonicalPatternId,
      turns_correct: correct,
      turns_incorrect: incorrect,
      evidence,
    });
  }

  const automaticity = normaliseEnum(r.automaticity_estimate, ['low', 'moderate', 'high']);
  if (!automaticity) return null;

  const confidence = normaliseEnum(r.confidence_estimate, [
    'cold',
    'recovering',
    'warm',
    'hot',
  ]);
  if (!confidence) return null;

  const suggested = typeof r.suggested_next_step === 'string' ? r.suggested_next_step : '';

  const respectsStealth = typeof r.respects_stealth === 'boolean' ? r.respects_stealth : true;

  const sessionSizeRaw = normaliseEnum(r.session_size, ['standard', 'mini']);
  const sessionSize = sessionSizeRaw ?? 'standard';

  const themeRaw = typeof r.theme === 'string' ? r.theme.trim().toLowerCase() : '';
  const theme = themeRaw.length > 0 ? themeRaw : scenarioTheme.trim().toLowerCase();

  return {
    salient_patterns_observed: patterns,
    automaticity_estimate: automaticity as LiveMetaAssessment['automaticity_estimate'],
    confidence_estimate: confidence as LiveMetaAssessment['confidence_estimate'],
    suggested_next_step: suggested,
    respects_stealth: respectsStealth,
    session_size: sessionSize,
    theme,
  };
}

function sanitizeTurnIndices(raw: unknown, totalTurns: number): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!Number.isFinite(n)) continue;
    const idx = Math.trunc(n);
    if (idx < 1 || idx > totalTurns) continue;
    if (seen.has(idx)) continue;
    seen.add(idx);
    out.push(idx);
  }
  out.sort((a, b) => a - b);
  return out;
}

function normaliseEnum<T extends string>(raw: unknown, allowed: readonly T[]): T | null {
  if (typeof raw !== 'string') return null;
  const normalised = raw.trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalised) ? (normalised as T) : null;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
