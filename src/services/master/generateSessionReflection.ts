/**
 * Orchestrator for end-of-session reflections — Phase 3 (F-P3-01c).
 *
 * Surfaces (Live post-session, Review finished stack, Lesson closing,
 * Exercises summary, Paths completion) each hand us a `SessionRecap`
 * and we take care of:
 *
 *   1. Gating: `masterEnabled()` + `profile.reflections_opt_in`.
 *   2. Calling `summarizeSession` with a fresh LearnerModel.
 *   3. Stealth-check and persistence via `saveSessionReflection`.
 *   4. Returning the stored row so the caller can render ReflectionCard.
 *
 * Surfaces stay dumb: they only produce a recap + call this function.
 * All pedagogical / storage logic lives here.
 */

import { masterEnabled } from '../runtimeConfigSnapshot';
import { loadLearnerModel } from '../learnerModel';
import { getProfile } from '../supabase/auth';
import { summarizeSession, type SessionRecap } from './summarizeSession';
import {
  saveSessionReflection,
  type StoredSessionReflection,
} from '../sessionReflections';

export interface GenerateReflectionInput {
  recap: SessionRecap;
  /**
   * Stable key produced by the caller — e.g. `live-${sessionId}`,
   * `review-${stackId}-${isoDateBucket}`. Must uniquely identify the
   * session so refreshes during generation don't duplicate rows.
   */
  sessionKey: string;
}

export interface GenerateReflectionResult {
  reflection: StoredSessionReflection | null;
  /** Why the reflection was skipped, if it was. */
  skippedReason?:
    | 'master_disabled'
    | 'opted_out'
    | 'empty_session'
    | 'llm_failed'
    | 'persist_failed';
}

export async function generateSessionReflection(
  input: GenerateReflectionInput,
): Promise<GenerateReflectionResult> {
  if (!masterEnabled()) {
    return { reflection: null, skippedReason: 'master_disabled' };
  }

  // `attempts === 0` means nothing happened — don't bother the student.
  if (input.recap.attempts === 0) {
    return { reflection: null, skippedReason: 'empty_session' };
  }

  // Opt-out check. NULL is treated as opted-in for backward-compat.
  let optedOut = false;
  try {
    const profile = await getProfile();
    optedOut = profile?.reflections_opt_in === false;
  } catch (err) {
    console.warn('[generateSessionReflection] profile read failed; assuming opt-in', err);
  }
  if (optedOut) {
    return { reflection: null, skippedReason: 'opted_out' };
  }

  let learnerModel;
  try {
    learnerModel = await loadLearnerModel();
  } catch (err) {
    console.warn('[generateSessionReflection] loadLearnerModel failed', err);
    return { reflection: null, skippedReason: 'llm_failed' };
  }

  const reflection = await summarizeSession({
    recap: input.recap,
    learnerModel,
  });

  if (!reflection) {
    return { reflection: null, skippedReason: 'llm_failed' };
  }

  const stored = await saveSessionReflection({
    session_key: input.sessionKey,
    surface: input.recap.surface,
    reflection,
  });

  if (!stored) {
    return { reflection: null, skippedReason: 'persist_failed' };
  }

  return { reflection: stored };
}
