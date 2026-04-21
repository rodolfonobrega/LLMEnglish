/**
 * promotionGate — Phase 7 (F-P7-02).
 *
 * Client-side, deterministic guardrail for the `mastered.add` patch op.
 * Even when the Master LLM proposes a promotion, we reject it unless
 * ALL seven rules of §7c.3 hold. The LLM may be convinced the student
 * has learned it; the code's job is to keep the system honest.
 *
 * The gate is invoked by `patchValidator.filterPromotionPatches`, which
 * walks the patch list coming out of `updateModel` (or `runLivePipeline`)
 * and strips any `mastered.add` that fails the gate — while carrying the
 * reason into the `console.warn` output so we can audit rejected
 * promotions in the browser console during development.
 *
 * The rules (verbatim from the plan):
 *   1. attempts >= 10 AND success_rate >= 0.8
 *   2. evidence.sessions_touched.length >= 3
 *   3. evidence.themes_seen.length >= 2
 *   4. evidence.modalities_seen.length >= 2
 *   5. trajectory in { 'improving', 'stable' }
 *   6. Live-confirmed, across time AND themes:
 *        live_turns_correct >= 2
 *        AND live_sessions_touched.length >= 2
 *        AND live_themes_seen.length >= 2
 *        AND (last_live_success_at - first_live_success_at) >= 72h
 *   7. At least one re_exposure_checks entry with:
 *        - passed === true
 *        - at >= first_success_at + 48h
 *        - AND at least one passing entry has was_live === true
 */

import {
  ensurePatternEvidence,
  type AcquiringPattern,
  type ReExposureCheck,
} from '../../types/learnerModel';

export interface PromotionGateResult {
  allowed: boolean;
  /** Human-readable list of failed rule ids for debugging. */
  missing: string[];
  /** Same list keyed by rule number (1..7) with short reason strings. */
  reasons: Record<string, string>;
}

export const RULE_MIN_ATTEMPTS = 10;
export const RULE_MIN_SUCCESS_RATE = 0.8;
export const RULE_MIN_SESSIONS = 3;
export const RULE_MIN_THEMES = 2;
export const RULE_MIN_MODALITIES = 2;
export const RULE_MIN_LIVE_TURNS_CORRECT = 2;
export const RULE_MIN_LIVE_SESSIONS = 2;
export const RULE_MIN_LIVE_THEMES = 2;
export const LIVE_SPREAD_MIN_MS = 72 * 60 * 60 * 1000;
export const RE_EXPOSURE_MIN_DELAY_MS = 48 * 60 * 60 * 1000;

/**
 * Inspect an acquiring pattern and decide whether it can be promoted to
 * `mastered`. Pure — no I/O, no LLM.
 */
export function canPromote(pattern: AcquiringPattern): PromotionGateResult {
  const missing: string[] = [];
  const reasons: Record<string, string> = {};

  const attemptsOk =
    pattern.attempts >= RULE_MIN_ATTEMPTS && pattern.success_rate >= RULE_MIN_SUCCESS_RATE;
  if (!attemptsOk) {
    missing.push('rule1_attempts_success');
    reasons.rule1_attempts_success = `attempts=${pattern.attempts} (need >= ${RULE_MIN_ATTEMPTS}), success_rate=${pattern.success_rate.toFixed(2)} (need >= ${RULE_MIN_SUCCESS_RATE}).`;
  }

  const evidence = ensurePatternEvidence(pattern);

  if (evidence.sessions_touched.length < RULE_MIN_SESSIONS) {
    missing.push('rule2_sessions');
    reasons.rule2_sessions = `sessions_touched=${evidence.sessions_touched.length} (need >= ${RULE_MIN_SESSIONS}).`;
  }
  if (evidence.themes_seen.length < RULE_MIN_THEMES) {
    missing.push('rule3_themes');
    reasons.rule3_themes = `themes_seen=${evidence.themes_seen.length} (need >= ${RULE_MIN_THEMES}).`;
  }
  if (evidence.modalities_seen.length < RULE_MIN_MODALITIES) {
    missing.push('rule4_modalities');
    reasons.rule4_modalities = `modalities_seen=${evidence.modalities_seen.length} (need >= ${RULE_MIN_MODALITIES}).`;
  }

  const trajectory = pattern.trajectory ?? 'noisy';
  if (trajectory !== 'improving' && trajectory !== 'stable') {
    missing.push('rule5_trajectory');
    reasons.rule5_trajectory = `trajectory=${trajectory} (need improving|stable).`;
  }

  // Rule 6 — Live-confirmed across time and themes.
  const liveCountsOk =
    evidence.live_turns_correct >= RULE_MIN_LIVE_TURNS_CORRECT &&
    evidence.live_sessions_touched.length >= RULE_MIN_LIVE_SESSIONS &&
    evidence.live_themes_seen.length >= RULE_MIN_LIVE_THEMES;

  let liveSpreadOk = false;
  if (
    liveCountsOk &&
    evidence.first_live_success_at &&
    evidence.last_live_success_at
  ) {
    const first = Date.parse(evidence.first_live_success_at);
    const last = Date.parse(evidence.last_live_success_at);
    liveSpreadOk =
      Number.isFinite(first) &&
      Number.isFinite(last) &&
      last - first >= LIVE_SPREAD_MIN_MS;
  }

  if (!(liveCountsOk && liveSpreadOk)) {
    missing.push('rule6_live_confirmed');
    reasons.rule6_live_confirmed = `live_turns_correct=${evidence.live_turns_correct} (need >= ${RULE_MIN_LIVE_TURNS_CORRECT}), live_sessions_touched=${evidence.live_sessions_touched.length} (need >= ${RULE_MIN_LIVE_SESSIONS}), live_themes_seen=${evidence.live_themes_seen.length} (need >= ${RULE_MIN_LIVE_THEMES}), spread_ok=${liveSpreadOk}.`;
  }

  // Rule 7 — re-exposure check.
  const firstSuccessTs = evidence.first_success_at
    ? Date.parse(evidence.first_success_at)
    : NaN;
  const qualifyingChecks = evidence.re_exposure_checks.filter((c) =>
    passingReExposure(c, firstSuccessTs),
  );
  const hasPassingCheck = qualifyingChecks.length > 0;
  const hasPassingLiveCheck = qualifyingChecks.some((c) => c.was_live);
  if (!hasPassingCheck || !hasPassingLiveCheck) {
    missing.push('rule7_re_exposure');
    reasons.rule7_re_exposure = `passing_checks=${qualifyingChecks.length}, passing_live_checks=${qualifyingChecks.filter((c) => c.was_live).length}.`;
  }

  return {
    allowed: missing.length === 0,
    missing,
    reasons,
  };
}

function passingReExposure(check: ReExposureCheck, firstSuccessTs: number): boolean {
  if (!check.passed) return false;
  const ts = Date.parse(check.at);
  if (!Number.isFinite(ts)) return false;
  if (!Number.isFinite(firstSuccessTs)) return false;
  return ts - firstSuccessTs >= RE_EXPOSURE_MIN_DELAY_MS;
}
