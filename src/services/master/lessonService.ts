/**
 * Lesson service — Wave 6 Stage B.
 *
 * Thin Supabase wrapper around the `lessons` and `lesson_offers` tables.
 * Callers: Practice Hub offer card, LessonPage runtime, post-lesson update.
 */

import { supabase } from '../supabase/client';
import type {
  LessonRow,
  LessonOfferRow,
  LessonStatus,
  LessonOfferStatus,
} from '../../types/supabase';
import type { LessonPlan } from '../../types/learnerModel';

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export async function fetchLiveOffers(userId: string): Promise<LessonOfferRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('lesson_offers')
    .select('*')
    .eq('user_id', userId)
    .eq('dry_run', false)
    .eq('status', 'would_offer')
    .or(`mute_until.is.null,mute_until.lt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    console.warn('[lessonService] fetchLiveOffers failed:', error.message);
    return [];
  }
  return data ?? [];
}

export async function setOfferStatus(
  offerId: string,
  status: LessonOfferStatus,
  muteUntil?: string,
): Promise<void> {
  const patch: Partial<LessonOfferRow> = { status };
  if (muteUntil) patch.mute_until = muteUntil;
  const { error } = await supabase.from('lesson_offers').update(patch).eq('id', offerId);
  if (error) console.warn('[lessonService] setOfferStatus failed:', error.message);
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

export async function createLesson(
  userId: string,
  plan: LessonPlan,
): Promise<LessonRow | null> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      user_id: userId,
      lesson_plan: plan,
      target_canonical_pattern: plan.target_canonical_pattern,
      status: 'active' satisfies LessonStatus,
      moment_signals: [],
    })
    .select('*')
    .single();
  if (error || !data) {
    console.warn('[lessonService] createLesson failed:', error?.message);
    return null;
  }
  return data;
}

export async function getLesson(lessonId: string): Promise<LessonRow | null> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();
  if (error || !data) {
    console.warn('[lessonService] getLesson failed:', error?.message);
    return null;
  }
  return data;
}

export async function updateLessonSignals(
  lessonId: string,
  signals: unknown[],
): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ moment_signals: signals })
    .eq('id', lessonId);
  if (error) console.warn('[lessonService] updateLessonSignals failed:', error.message);
}

export async function completeLesson(
  lessonId: string,
  payload: {
    baseline_utterance?: string | null;
    final_utterance?: string | null;
    delta_score?: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({
      status: 'completed' satisfies LessonStatus,
      baseline_utterance: payload.baseline_utterance ?? null,
      final_utterance: payload.final_utterance ?? null,
      delta_score: payload.delta_score ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', lessonId);
  if (error) console.warn('[lessonService] completeLesson failed:', error.message);
}

export async function abandonLesson(lessonId: string): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'abandoned' satisfies LessonStatus })
    .eq('id', lessonId);
  if (error) console.warn('[lessonService] abandonLesson failed:', error.message);
}
