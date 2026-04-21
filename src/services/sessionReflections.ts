/**
 * Session reflections storage — Phase 3 (F-P3-01c).
 *
 * Append-only persistence for end-of-session reflections produced by
 * `Master.summarize_session`. Dismissal and opt-out are soft updates on
 * the same row. All queries are scoped to the current user via RLS.
 *
 * The helpers in this module are intentionally thin: they translate
 * between the client-side `SessionReflection` shape (from
 * `services/master/summarizeSession.ts`) and the `session_reflections`
 * table columns declared in
 * `supabase/migrations/20260421_phase3_reflections.sql`.
 *
 * Error policy: failures never throw to the UI. Inserts return `null`,
 * list/fetch returns an empty array / null. This keeps end-of-session
 * flows graceful when the Supabase migration hasn't landed yet or when
 * the student is offline.
 */

import { supabase } from './supabase/client';
import { getCurrentUser } from './supabase/auth';
import type { CanonicalPatternId } from '../types/card';
import type { SessionReflection, SessionRecap } from './master/summarizeSession';

export interface StoredSessionReflection {
  id: string;
  session_key: string;
  surface: SessionRecap['surface'];
  strength_text: string;
  opportunity_text: string;
  salient_patterns: CanonicalPatternId[];
  themes_observed: string[];
  dismissed_at: string | null;
  opted_out_at: string | null;
  created_at: string;
}

interface ReflectionsRow {
  id: string;
  session_key: string;
  surface: string;
  strength_text: string;
  opportunity_text: string;
  salient_patterns: string[] | null;
  themes_observed: string[] | null;
  dismissed_at: string | null;
  opted_out_at: string | null;
  created_at: string;
}

function rowToStored(row: ReflectionsRow): StoredSessionReflection {
  return {
    id: row.id,
    session_key: row.session_key,
    surface: row.surface as SessionRecap['surface'],
    strength_text: row.strength_text,
    opportunity_text: row.opportunity_text,
    salient_patterns: (row.salient_patterns ?? []) as CanonicalPatternId[],
    themes_observed: row.themes_observed ?? [],
    dismissed_at: row.dismissed_at,
    opted_out_at: row.opted_out_at,
    created_at: row.created_at,
  };
}

export interface InsertReflectionInput {
  session_key: string;
  surface: SessionRecap['surface'];
  reflection: SessionReflection;
}

/**
 * Insert a reflection row. Upserts on `(user_id, session_key)` so a
 * refresh mid-generation can't produce duplicates. Returns the stored
 * row on success, `null` on any failure.
 */
export async function saveSessionReflection(
  input: InsertReflectionInput,
): Promise<StoredSessionReflection | null> {
  const user = getCurrentUser();
  if (!user) return null;

  const payload = {
    user_id: user.id,
    session_key: input.session_key,
    surface: input.surface,
    strength_text: input.reflection.strength_text,
    opportunity_text: input.reflection.opportunity_text,
    salient_patterns: input.reflection.salient_patterns,
    themes_observed: input.reflection.themes_observed,
  };

  try {
    const { data, error } = await supabase
      .from('session_reflections')
      .upsert(payload, { onConflict: 'user_id,session_key' })
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn(`[sessionReflections] insert failed: ${error.message}`);
      return null;
    }

    return data ? rowToStored(data as ReflectionsRow) : null;
  } catch (err) {
    console.warn('[sessionReflections] unexpected insert error', err);
    return null;
  }
}

/**
 * Fetch the N most recent reflections for the current user. Used by the
 * History page to annotate completed sessions.
 */
export async function listRecentReflections(
  limit = 50,
): Promise<StoredSessionReflection[]> {
  const user = getCurrentUser();
  if (!user) return [];

  try {
    const { data, error } = await supabase
      .from('session_reflections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn(`[sessionReflections] list failed: ${error.message}`);
      return [];
    }

    return (data ?? []).map((row) => rowToStored(row as ReflectionsRow));
  } catch (err) {
    console.warn('[sessionReflections] unexpected list error', err);
    return [];
  }
}

/** Soft-dismiss the card. Idempotent. */
export async function dismissReflection(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('session_reflections')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.warn(`[sessionReflections] dismiss failed: ${error.message}`);
    }
  } catch (err) {
    console.warn('[sessionReflections] unexpected dismiss error', err);
  }
}

/**
 * Mark the row as the one that triggered the opt-out. The caller is
 * still responsible for flipping `profiles.reflections_opt_in = false`
 * (we keep those concerns separate so opt-out works even if the row
 * insert failed).
 */
export async function markReflectionOptedOut(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('session_reflections')
      .update({
        opted_out_at: new Date().toISOString(),
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.warn(`[sessionReflections] opt-out mark failed: ${error.message}`);
    }
  } catch (err) {
    console.warn('[sessionReflections] unexpected opt-out mark error', err);
  }
}
