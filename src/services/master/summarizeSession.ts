/**
 * Master.summarize_session — Phase 3 (F-P3-01b).
 *
 * Produces a stealth, first-person reflection at the end of a practice
 * session. Two sentences max:
 *   • strength_text    — an observation about how the student is
 *                        speaking, NOT about which grammar point they
 *                        nailed. "Suas histórias estão ficando mais
 *                        longas" beats "você dominou o past continuous".
 *   • opportunity_text — what to practice next, same stealth rules.
 *
 * The caller assembles a `SessionRecap` from the session's raw
 * `MetaAssessment[]` / `LiveMetaAssessment[]` / drill outcomes and hands
 * it to `summarizeSession`. We don't re-load the LearnerModel here —
 * the caller passes a trimmed view so this service stays pure/testable.
 *
 * Gating:
 *   * `masterEnabled()` — hard gate.
 *   * The caller is responsible for checking `profile.reflections_opt_in`
 *     and `profile.lessons_opt_in` before calling. This service has no
 *     Supabase dependency beyond `recordMasterUsage`.
 *
 * Stealth:
 *   * Post-LLM, we run the same pedagogical-leak detector used for
 *     lesson moments. If either field mentions a grammar label, we
 *     discard the output entirely and the caller falls back silently
 *     (no reflection shown).
 */

import { chatCompletion } from '../openai';
import { cleanJson } from '../../utils/cleanJson';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { containsPedagogicalLeak } from './stealthDetector';
import { resolveMasterModel } from './resolveMasterModel';
import type { LearnerModel } from '../../types/learnerModel';
import type { CanonicalPatternId } from '../../types/card';
import {
  getSummarizeSessionPrompt,
  summarizeSessionResponseSchema,
  type SummarizeSessionPromptInput,
} from '../../utils/prompts';

export interface SessionRecap {
  /**
   * Where the session happened. Used to vary copy ("sua conversa" vs.
   * "seus cards") without leaking grammar labels.
   */
  surface: 'live' | 'mini-live' | 'review' | 'lesson' | 'exercises' | 'paths';
  /**
   * Themes the student touched. Used for the strength observation so the
   * reflection can reference content, not grammar.
   */
  themes: string[];
  /** Canonical patterns the Master saw go well. */
  patterns_correct: CanonicalPatternId[];
  /** Canonical patterns the Master saw break. */
  patterns_incorrect: CanonicalPatternId[];
  /** Number of attempts, turns, cards — whatever the surface counts. */
  attempts: number;
  /**
   * Average 5D score across the session (0-10). Undefined for live
   * sessions where 5D isn't computed.
   */
  avg_score?: number;
  /** True if at least one Live session was part of this recap. */
  had_live: boolean;
  /** Longest Live turn in words, if any. */
  longest_live_turn_words?: number;
}

export interface SessionReflection {
  strength_text: string;
  opportunity_text: string;
  salient_patterns: CanonicalPatternId[];
  themes_observed: string[];
}

export interface SummarizeSessionInput {
  recap: SessionRecap;
  learnerModel: LearnerModel;
}

export async function summarizeSession(
  input: SummarizeSessionInput,
): Promise<SessionReflection | null> {
  if (!masterEnabled()) return null;
  if (input.recap.attempts === 0) return null;

  const promptInput: SummarizeSessionPromptInput = {
    surface: input.recap.surface,
    themes: input.recap.themes,
    patterns_correct: input.recap.patterns_correct,
    patterns_incorrect: input.recap.patterns_incorrect,
    attempts: input.recap.attempts,
    avg_score: input.recap.avg_score ?? null,
    had_live: input.recap.had_live,
    longest_live_turn_words: input.recap.longest_live_turn_words ?? null,
    learner: {
      cefr_estimate: input.learnerModel.cefr_estimate.level,
      chronic_errors: (input.learnerModel.chronic_errors ?? [])
        .slice(0, 3)
        .map((e) => e.id),
      strengths: input.learnerModel.strengths ?? [],
      themes_that_land: input.learnerModel.engagement_profile?.themes_that_land ?? [],
    },
  };

  const { system, user } = getSummarizeSessionPrompt(promptInput);

  const resolved = resolveMasterModel('summarize_session');
  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(
      system,
      user,
      { model: resolved.model, source: resolved.source },
      summarizeSessionResponseSchema,
    );
  } catch (err) {
    console.warn('[Master.summarize_session] LLM call failed:', err);
    return null;
  }

  const latencyMs = Date.now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.summarize_session] JSON parse failed:', err);
    return null;
  }

  const coerced = coerceReflection(parsed);
  if (!coerced) {
    console.warn('[Master.summarize_session] coerce failed — dropping reflection');
    return null;
  }

  // Stealth guard: if EITHER line mentions a grammar label, drop the
  // whole reflection. The caller fails silently (no card shown).
  if (
    containsPedagogicalLeak(coerced.strength_text) ||
    containsPedagogicalLeak(coerced.opportunity_text)
  ) {
    console.warn('[Master.summarize_session] pedagogical leak, discarding');
    return null;
  }

  try {
    await recordMasterUsage({
      role: 'summarize_session',
      model: resolved.model,
      latencyMs,
      tokensIn: estimateTokens(system + user),
      tokensOut: estimateTokens(raw),
    });
  } catch {
    // telemetry is best-effort
  }

  return {
    strength_text: coerced.strength_text,
    opportunity_text: coerced.opportunity_text,
    salient_patterns: Array.from(
      new Set([...input.recap.patterns_correct, ...input.recap.patterns_incorrect]),
    ),
    themes_observed: Array.from(new Set(input.recap.themes)).slice(0, 8),
  };
}

interface CoercedReflection {
  strength_text: string;
  opportunity_text: string;
}

export function coerceReflection(raw: unknown): CoercedReflection | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const strength = typeof obj.strength_text === 'string' ? obj.strength_text.trim() : '';
  const opportunity =
    typeof obj.opportunity_text === 'string' ? obj.opportunity_text.trim() : '';
  if (!strength || !opportunity) return null;
  if (strength.length > 240 || opportunity.length > 240) return null;
  return { strength_text: strength, opportunity_text: opportunity };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
