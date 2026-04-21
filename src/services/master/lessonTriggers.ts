/**
 * Lesson triggers — Wave 6 Stage A (F31b).
 *
 * Runs after every `update_model`. Given the updated `LearnerModel` and
 * recent `lesson_offers` rows, produces at most ONE `LessonCandidate` per
 * call in priority order **chronic > stuck > breakthrough > cadence**:
 *
 *   - chronic      any chronic_errors item with occurrences >= 5 across
 *                  ≥ 3 sessions (teaching_attempts proxy), not already
 *                  addressed within 14 days.
 *   - stuck        any acquiring_patterns item with teaching_attempts >= 3
 *                  (attempts proxy) and a plateaued success rate.
 *   - breakthrough any pattern whose mastery would cross a CEFR threshold.
 *   - cadence      no accepted lesson in 7 days AND no candidate fired
 *                  in the last 48 h.
 *
 * Frequency caps: ≤ 3 offers/week, ≥ 48 h between offers.
 *
 * CURRENT LIVE BEHAVIOR:
 *   - Writes with `status: 'would_offer'` and `dry_run: false`.
 *   - Practice Hub may surface the offer when the global opt-in is enabled.
 *
 * Historical note: Stage A wrote `dry_run: true` rows only for silent
 * telemetry gathering. Stage B flipped the insert default live.
 */

import { supabase } from '../supabase/client';
import { getCurrentUser } from '../supabase/auth';
import { masterEnabled } from '../runtimeConfigSnapshot';
import type {
  LearnerModel,
  AcquiringPattern,
  ChronicError,
} from '../../types/learnerModel';
import type {
  LessonOfferRow,
  LessonTriggerType,
} from '../../types/supabase';

export interface LessonCandidate {
  candidate_pattern: string;
  trigger_type: LessonTriggerType;
  reason: string;
}

export interface EvaluateTriggersInput {
  learnerModel: LearnerModel;
  /**
   * Recent lesson_offers for the user, most recent first. When omitted the
   * helper fetches them itself (Stage A always needs history to respect
   * frequency caps).
   */
  recentOffers?: LessonOfferRow[];
}

const CHRONIC_OCCURRENCES_MIN = 5;
const CHRONIC_TEACHING_ATTEMPTS_MIN = 3;
const STUCK_TEACHING_ATTEMPTS_MIN = 3;
const STUCK_PLATEAU_DELTA = 0.05;
const CADENCE_QUIET_HOURS = 48;
const CADENCE_STALE_LESSON_DAYS = 7;
const FREQ_CAP_OFFERS_PER_WEEK = 3;
const MIN_HOURS_BETWEEN_OFFERS = 48;
const CHRONIC_COOLDOWN_DAYS = 14;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------
// Pure evaluation (no DB)
// ---------------------------------------------------------------------------

/**
 * Pure evaluator — deterministic given the inputs. Returns the winning
 * candidate (if any) in priority order. Exposed separately from the DB
 * writer so tests can assert behaviour without Supabase.
 */
export function evaluateTriggers(input: EvaluateTriggersInput): LessonCandidate | null {
  const { learnerModel, recentOffers = [] } = input;

  if (!respectsFrequencyCaps(recentOffers)) return null;

  const now = Date.now();

  const chronic = pickChronicCandidate(learnerModel.chronic_errors, recentOffers, now);
  if (chronic) return chronic;

  const stuck = pickStuckCandidate(learnerModel.acquiring_patterns);
  if (stuck) return stuck;

  const breakthrough = pickBreakthroughCandidate(learnerModel);
  if (breakthrough) return breakthrough;

  const cadence = pickCadenceCandidate(learnerModel, recentOffers, now);
  if (cadence) return cadence;

  return null;
}

function respectsFrequencyCaps(recentOffers: LessonOfferRow[]): boolean {
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const minGap = MIN_HOURS_BETWEEN_OFFERS * HOUR_MS;

  const withinWeek = recentOffers.filter(
    (o) => new Date(o.created_at).getTime() >= weekAgo,
  );
  if (withinWeek.length >= FREQ_CAP_OFFERS_PER_WEEK) return false;

  const latest = recentOffers[0];
  if (latest && now - new Date(latest.created_at).getTime() < minGap) {
    return false;
  }
  return true;
}

function pickChronicCandidate(
  chronic: ChronicError[],
  recentOffers: LessonOfferRow[],
  now: number,
): LessonCandidate | null {
  const cooldownMs = CHRONIC_COOLDOWN_DAYS * DAY_MS;
  const recentlyAddressed = new Set(
    recentOffers
      .filter(
        (o) =>
          o.status === 'accepted' &&
          now - new Date(o.created_at).getTime() <= cooldownMs,
      )
      .map((o) => o.candidate_pattern),
  );

  for (const err of chronic) {
    if (recentlyAddressed.has(err.id)) continue;
    if (
      err.occurrences >= CHRONIC_OCCURRENCES_MIN &&
      err.teaching_attempts >= CHRONIC_TEACHING_ATTEMPTS_MIN
    ) {
      return {
        candidate_pattern: err.id,
        trigger_type: 'chronic',
        reason: `chronic: ${err.occurrences}x across ${err.teaching_attempts}+ sessions`,
      };
    }
  }
  return null;
}

function pickStuckCandidate(acquiring: AcquiringPattern[]): LessonCandidate | null {
  for (const p of acquiring) {
    if (p.attempts < STUCK_TEACHING_ATTEMPTS_MIN) continue;
    // The model doesn't retain a per-session history; we use success_rate as
    // the plateau proxy — low + not improving means we're stuck. In Stage B
    // we switch this to a real rolling delta once we persist it.
    if (p.success_rate < 0.5 + STUCK_PLATEAU_DELTA) {
      return {
        candidate_pattern: p.id,
        trigger_type: 'stuck',
        reason: `stuck: ${p.attempts} attempts, success_rate=${p.success_rate.toFixed(2)}`,
      };
    }
  }
  return null;
}

function pickBreakthroughCandidate(model: LearnerModel): LessonCandidate | null {
  // A pattern is a breakthrough candidate when the learner is about to
  // cross the mastery bar (success_rate >= 0.8 with attempts >= 5). We
  // surface the highest-confidence acquiring pattern that meets the bar.
  const ready = model.acquiring_patterns.find(
    (p) => p.success_rate >= 0.8 && p.attempts >= 5,
  );
  if (!ready) return null;
  return {
    candidate_pattern: ready.id,
    trigger_type: 'breakthrough',
    reason: `breakthrough: near mastery (success_rate=${ready.success_rate.toFixed(2)})`,
  };
}

function pickCadenceCandidate(
  model: LearnerModel,
  recentOffers: LessonOfferRow[],
  now: number,
): LessonCandidate | null {
  const cadenceQuietMs = CADENCE_QUIET_HOURS * HOUR_MS;
  const staleLessonMs = CADENCE_STALE_LESSON_DAYS * DAY_MS;

  const hasRecentCandidate = recentOffers.some(
    (o) => now - new Date(o.created_at).getTime() < cadenceQuietMs,
  );
  if (hasRecentCandidate) return null;

  const hasRecentAcceptedLesson = recentOffers.some(
    (o) => o.status === 'accepted' && now - new Date(o.created_at).getTime() < staleLessonMs,
  );
  if (hasRecentAcceptedLesson) return null;

  const fallback =
    model.next_step_plan.primary_goal ||
    model.acquiring_patterns[0]?.id ||
    model.chronic_errors[0]?.id ||
    null;
  if (!fallback || fallback === 'diagnostic') return null;

  return {
    candidate_pattern: fallback,
    trigger_type: 'cadence',
    reason: 'cadence: no recent accepted lesson or candidate',
  };
}

// ---------------------------------------------------------------------------
// DB-backed entry point
// ---------------------------------------------------------------------------

/**
 * Fetch recent offers for a user, newest first. Internal helper.
 */
async function fetchRecentOffers(userId: string): Promise<LessonOfferRow[]> {
  const since = new Date(Date.now() - 14 * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('lesson_offers')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[lessonTriggers] failed to fetch recent offers:', error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Runs the trigger evaluator and persists the winning candidate (if any)
 * as a live `would_offer` row with `dry_run: false`. Non-blocking — never throws
 * into the caller's flow.
 *
 * Short-circuits when:
 *   - Master is disabled (feature flag off), OR
 *   - No authenticated user is available.
 */
export async function evaluateAndRecordTriggers(
  learnerModel: LearnerModel,
): Promise<LessonCandidate | null> {
  if (!masterEnabled()) return null;

  const user = getCurrentUser();
  if (!user) return null;

  // Wave 6 Stage B — respect the global opt-out. `null`/`true` both mean
  // "allow" (default), `false` short-circuits the trigger evaluator.
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('lessons_opt_in')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && profile.lessons_opt_in === false) {
      return null;
    }
  } catch (err) {
    // If we can't read the profile we fail open to avoid blocking lesson offers
    // on a transient profile read failure.
    console.warn('[lessonTriggers] opt-in read failed, allowing:', err);
  }

  try {
    const recentOffers = await fetchRecentOffers(user.id);
    const candidate = evaluateTriggers({ learnerModel, recentOffers });
    if (!candidate) return null;

    const { error } = await supabase.from('lesson_offers').insert({
      user_id: user.id,
      candidate_pattern: candidate.candidate_pattern,
      trigger_type: candidate.trigger_type,
      status: 'would_offer',
      dry_run: false,
    });
    if (error) {
      console.warn('[lessonTriggers] insert failed:', error.message);
    }
    return candidate;
  } catch (err) {
    console.warn('[lessonTriggers] unexpected failure (swallowed):', err);
    return null;
  }
}
