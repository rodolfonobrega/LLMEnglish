/**
 * LearnerModel service — Wave 3 silent substrate.
 *
 * This module owns three concerns:
 *   1. Loading the per-user `LearnerModel` row (with a safe default when absent).
 *   2. Applying typed `PatchOp`s to a `LearnerModel` deterministically.
 *   3. Persisting a patched model + recording the patch trail in
 *      `learner_model_history` for audit / rollback.
 *
 * The Master does NOT consume this service for student-visible decisions in
 * Wave 3 — callers only record signal. Prescription lands in Wave 5.
 *
 * Every public entry is a no-op when `masterEnabled()` returns false, EXCEPT
 * `applyPatches` (pure function, safe to call) and the admin/reset path
 * (`savePatchedModel` is still protected by `masterEnabled` at its callsite).
 */

import { supabase } from './supabase/client';
import { getCurrentUser } from './supabase/auth';
import { masterEnabled } from './runtimeConfigSnapshot';
import {
  createDiagnosticModel,
  ensurePatternEvidence,
  type LearnerModel,
  type PatchOp,
  type PatchSource,
  type AcquiringPattern,
} from '../types/learnerModel';

function requireUserId(): string {
  const user = getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/**
 * Load the learner model for the current user.
 * Returns a fresh diagnostic model when no row exists yet.
 *
 * SAFETY: the caller SHOULD check `masterEnabled()` first. This function
 * does not short-circuit because it's useful for debug surfaces.
 */
export async function loadLearnerModel(userId?: string): Promise<LearnerModel> {
  const uid = userId ?? requireUserId();

  const { data, error } = await supabase
    .from('learner_models')
    .select('model')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load learner model: ${error.message}`);
  }

  if (!data?.model) {
    return createDiagnosticModel();
  }

  return data.model as LearnerModel;
}

/**
 * Apply a list of patches to a model. Pure — never mutates the input.
 * Unknown ops are logged and skipped; this is what prevents LLM drift.
 */
export function applyPatches(model: LearnerModel, patches: PatchOp[]): LearnerModel {
  let next: LearnerModel = deepCloneModel(model);

  for (const patch of patches) {
    next = applySinglePatch(next, patch);
  }

  next.meta = {
    ...next.meta,
    updated_at: new Date().toISOString(),
  };

  return next;
}

function deepCloneModel(model: LearnerModel): LearnerModel {
  return JSON.parse(JSON.stringify(model)) as LearnerModel;
}

function applySinglePatch(model: LearnerModel, patch: PatchOp): LearnerModel {
  switch (patch.op) {
    case 'cefr.set':
      return {
        ...model,
        cefr_estimate: {
          ...model.cefr_estimate,
          level: patch.level,
          confidence: clamp01(patch.confidence),
          target: patch.target ?? model.cefr_estimate.target,
          last_reassessed: new Date().toISOString(),
        },
      };

    case 'mastered.add':
      if (model.mastered_patterns.includes(patch.id)) return model;
      return {
        ...model,
        mastered_patterns: [...model.mastered_patterns, patch.id],
        acquiring_patterns: model.acquiring_patterns.filter((p) => p.id !== patch.id),
      };

    case 'mastered.remove':
      return {
        ...model,
        mastered_patterns: model.mastered_patterns.filter((id) => id !== patch.id),
      };

    case 'acquiring.upsert': {
      const existingIdx = model.acquiring_patterns.findIndex((p) => p.id === patch.id);
      const entry = {
        id: patch.id,
        success_rate: clamp01(patch.success_rate),
        attempts: Math.max(0, Math.floor(patch.attempts)),
        last_seen: patch.last_seen,
        hypothesis: patch.hypothesis,
      };
      const nextList =
        existingIdx >= 0
          ? model.acquiring_patterns.map((p, i) => (i === existingIdx ? { ...p, ...entry } : p))
          : [...model.acquiring_patterns, entry];
      return { ...model, acquiring_patterns: nextList };
    }

    case 'acquiring.evidence_append': {
      const existingIdx = model.acquiring_patterns.findIndex((p) => p.id === patch.id);
      const base: AcquiringPattern =
        existingIdx >= 0
          ? model.acquiring_patterns[existingIdx]
          : {
              id: patch.id,
              success_rate: 0,
              attempts: 0,
              last_seen: patch.at,
            };
      const evidence = ensurePatternEvidence(base);

      const normalise = (v?: string) => (v ?? '').trim().toLowerCase();
      const addUnique = (list: string[], value?: string) => {
        const key = normalise(value);
        if (!key) return list;
        return list.includes(key) ? list : [...list, key];
      };

      evidence.sessions_touched = addUnique(evidence.sessions_touched, patch.session_id);
      evidence.themes_seen = addUnique(evidence.themes_seen, patch.theme);
      evidence.modalities_seen = addUnique(evidence.modalities_seen, patch.modality);

      const correct = Math.max(0, Math.floor(patch.correct ?? 0));
      const incorrect = Math.max(0, Math.floor(patch.incorrect ?? 0));

      if (correct > 0) {
        evidence.consecutive_correct += correct;
        if (evidence.consecutive_correct > evidence.longest_streak) {
          evidence.longest_streak = evidence.consecutive_correct;
        }
        if (!evidence.first_success_at) evidence.first_success_at = patch.at;
      }
      if (incorrect > 0) {
        evidence.consecutive_correct = 0;
        evidence.last_failure_at = patch.at;
      }

      const liveCorrect = Math.max(0, Math.floor(patch.live_turns_correct ?? 0));
      const liveIncorrect = Math.max(0, Math.floor(patch.live_turns_incorrect ?? 0));

      if (liveCorrect > 0 || liveIncorrect > 0) {
        evidence.live_turns_correct += liveCorrect;
        evidence.live_turns_incorrect += liveIncorrect;
        if (liveCorrect > 0) {
          evidence.live_sessions_touched = addUnique(
            evidence.live_sessions_touched,
            patch.live_session_id,
          );
          evidence.live_themes_seen = addUnique(evidence.live_themes_seen, patch.live_theme);
          if (!evidence.first_live_success_at) evidence.first_live_success_at = patch.at;
          evidence.last_live_success_at = patch.at;
        }
      }

      const nextPattern: AcquiringPattern = {
        ...base,
        evidence,
        last_seen: patch.at,
      };

      const nextList =
        existingIdx >= 0
          ? model.acquiring_patterns.map((p, i) => (i === existingIdx ? nextPattern : p))
          : [...model.acquiring_patterns, nextPattern];
      return { ...model, acquiring_patterns: nextList };
    }

    case 'acquiring.trajectory_set': {
      const existingIdx = model.acquiring_patterns.findIndex((p) => p.id === patch.id);
      if (existingIdx < 0) return model;
      const nextList = model.acquiring_patterns.map((p, i) =>
        i === existingIdx ? { ...p, trajectory: patch.trajectory } : p,
      );
      return { ...model, acquiring_patterns: nextList };
    }

    case 'acquiring.re_exposure_append': {
      const existingIdx = model.acquiring_patterns.findIndex((p) => p.id === patch.id);
      if (existingIdx < 0) return model;
      const base = model.acquiring_patterns[existingIdx];
      const evidence = ensurePatternEvidence(base);
      evidence.re_exposure_checks.push({ ...patch.check });
      const nextPattern: AcquiringPattern = { ...base, evidence };
      const nextList = model.acquiring_patterns.map((p, i) =>
        i === existingIdx ? nextPattern : p,
      );
      return { ...model, acquiring_patterns: nextList };
    }

    case 'acquiring.remove':
      return {
        ...model,
        acquiring_patterns: model.acquiring_patterns.filter((p) => p.id !== patch.id),
      };

    case 'chronic.upsert': {
      const existingIdx = model.chronic_errors.findIndex((p) => p.id === patch.id);
      const entry = {
        id: patch.id,
        occurrences: Math.max(0, Math.floor(patch.occurrences)),
        last_seen: patch.last_seen,
        teaching_attempts: Math.max(0, Math.floor(patch.teaching_attempts)),
        hypothesis: patch.hypothesis,
      };
      const nextList =
        existingIdx >= 0
          ? model.chronic_errors.map((p, i) => (i === existingIdx ? { ...p, ...entry } : p))
          : [...model.chronic_errors, entry];
      return { ...model, chronic_errors: nextList };
    }

    case 'chronic.remove':
      return {
        ...model,
        chronic_errors: model.chronic_errors.filter((p) => p.id !== patch.id),
      };

    case 'strengths.set':
      return { ...model, strengths: [...patch.list] };

    case 'engagement.update':
      return {
        ...model,
        engagement_profile: { ...model.engagement_profile, ...patch.patch },
      };

    case 'plan.set':
      return { ...model, next_step_plan: { ...patch.plan } };

    case 'diagnostic.set':
      return { ...model, diagnostic_mode: patch.value };

    case 'confidence.set':
      return { ...model, confidence: clamp01(patch.value) };

    case 'hard_for_user.upsert': {
      const list = model.hard_for_user ?? [];
      const idx = list.findIndex((e) => e.id === patch.id);
      const entry = {
        id: patch.id,
        next_retry_at: patch.next_retry_at,
        reason: patch.reason,
      };
      const next =
        idx >= 0
          ? list.map((e, i) => (i === idx ? { ...e, ...entry } : e))
          : [...list, entry];
      return { ...model, hard_for_user: next };
    }

    case 'hard_for_user.remove':
      return {
        ...model,
        hard_for_user: (model.hard_for_user ?? []).filter((e) => e.id !== patch.id),
      };

    case 'live_fluency.update':
      return {
        ...model,
        live_fluency_profile: {
          ...patch.profile,
          sessions_considered: [...patch.profile.sessions_considered],
          themes_in_window: [...patch.profile.themes_in_window],
          session_points: patch.profile.session_points.map((p) => ({ ...p })),
        },
      };

    default: {
      // Unknown op — intentional: protects against LLM-drifted ops.
      // The `never` cast documents the exhaustiveness of the union.
      const unknownOp = patch as { op?: string };
      console.warn(`[learnerModel] Unknown patch op skipped:`, unknownOp?.op);
      return model;
    }
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Persist a patched model + append a history row. No-op when the Master
 * flag is disabled (caller should check, but we double-gate here).
 */
export async function savePatchedModel(
  userId: string,
  nextModel: LearnerModel,
  patches: PatchOp[],
  reason: string,
  source: PatchSource,
): Promise<void> {
  if (!masterEnabled()) return;

  const uid = userId || requireUserId();
  const now = new Date().toISOString();

  const modelToWrite: LearnerModel = {
    ...nextModel,
    meta: { ...nextModel.meta, updated_at: now },
  };

  const { error: upsertError } = await supabase
    .from('learner_models')
    .upsert(
      {
        id: uid,
        model: modelToWrite,
        version: modelToWrite.meta.schema_version,
        updated_at: now,
      },
      { onConflict: 'id' },
    );

  if (upsertError) {
    throw new Error(`Failed to save learner model: ${upsertError.message}`);
  }

  // Phase 2 — the `live_meta` source is introduced in this phase, but the
  // matching `learner_model_history_source_chk` extension is still pending
  // (see `docs/pending-ops-todos.md`). Until the migration lands we coerce
  // it to `'update_model'` and prefix the reason so the provenance is still
  // auditable. Rip this once the check constraint allows `live_meta`.
  const persistedSource: PatchSource = source === 'live_meta' ? 'update_model' : source;
  const persistedReason = source === 'live_meta' ? `live_meta:${reason}` : reason;

  const { error: historyError } = await supabase
    .from('learner_model_history')
    .insert({
      user_id: uid,
      patch_ops: patches,
      reason: persistedReason,
      source: persistedSource,
    });

  if (historyError) {
    console.warn(`[learnerModel] Failed to append history row: ${historyError.message}`);
  }
}

/**
 * Local-only debug helper. When the feature flag is off we can still log
 * what *would* have been patched so we can analyse signal capture without
 * touching the DB.
 */
export function logPatches(patches: PatchOp[], reason: string): void {
  if (masterEnabled()) return;
  if (!import.meta.env.DEV) return;
  console.debug('[learnerModel] dry-run patches', { reason, patches });
}

/**
 * Reset the current user's model. Appends a history row with source `reset`.
 */
export async function resetLearnerModel(reason = 'user reset'): Promise<LearnerModel> {
  const uid = requireUserId();
  const fresh = createDiagnosticModel();
  await savePatchedModel(
    uid,
    fresh,
    [
      { op: 'diagnostic.set', value: true },
      { op: 'confidence.set', value: 0 },
      { op: 'strengths.set', list: [] },
    ],
    reason,
    'reset',
  );
  return fresh;
}
