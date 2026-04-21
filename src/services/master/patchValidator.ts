/**
 * patchValidator — Phase 7 (F-P7-02 + F-P7-05).
 *
 * Client-side guardrails that sit between the LLM's proposed patch list
 * and `applyPatches`. Two responsibilities:
 *
 *   1. Promotion gate (F-P7-02). Any `mastered.add` patch is validated
 *      against the 7-rule gate in `promotionGate.ts`. Rejected promotions
 *      are stripped from the patch list so the pattern stays in
 *      `acquiring`. This is a hard floor: even if the LLM is convinced a
 *      student is ready, the code decides.
 *
 *   2. Ladder memory (F-P7-05). Every `mastered.add` MUST be paired with
 *      a `plan.set` whose `primary_goal` differs from the mastered id.
 *      Rationale: promotion without a next target is a ladder with a
 *      missing rung. When the LLM emits one without the other, we reject
 *      the whole patch set and log a warning — better to keep the old
 *      model than to land half a promotion.
 *
 * Pure functions, no I/O.
 */

import type { LearnerModel, PatchOp, ReExposureQueueEntry } from '../../types/learnerModel';
import { canPromote } from './promotionGate';
import { applyPatches } from '../learnerModel';
import { buildReExposureEntry } from './prescribe';

export interface ValidationResult {
  /** The patches that survived validation. Empty when ladder check fails. */
  patches: PatchOp[];
  /** Diagnostic annotations for the audit trail. */
  rejected: Array<{ patch: PatchOp; reason: string }>;
  /** True when the whole patch set was dropped (ladder violation). */
  wholeSetRejected: boolean;
}

/**
 * Filter and validate a patch list before it hits `applyPatches`.
 *
 * Returns a `{ patches, rejected, wholeSetRejected }` triple. Callers
 * should log `rejected` and fall back to the unpatched model when
 * `wholeSetRejected` is true.
 */
export function validatePatches(
  patches: PatchOp[],
  learnerModel: LearnerModel,
): ValidationResult {
  const rejected: Array<{ patch: PatchOp; reason: string }> = [];

  // First pass: strip failing `mastered.add` per the promotion gate. We
  // project the effect of prior acquiring-related patches onto a working
  // copy so a pattern the LLM *just* evidence-appended can still be
  // evaluated against the updated shape. We deliberately exclude
  // `mastered.add` / `mastered.remove` from the projection because the
  // gate reads the acquiring entry, and `mastered.add` otherwise deletes
  // it prematurely via the main applier.
  const projectable = patches.filter(
    (p) => p.op !== 'mastered.add' && p.op !== 'mastered.remove',
  );
  const working = applyPatches(learnerModel, projectable);

  const gated: PatchOp[] = [];
  for (const patch of patches) {
    if (patch.op !== 'mastered.add') {
      gated.push(patch);
      continue;
    }
    const pattern = working.acquiring_patterns.find((p) => p.id === patch.id);
    if (!pattern) {
      // Cannot evaluate without an acquiring record — be strict.
      rejected.push({
        patch,
        reason: `mastered.add for ${patch.id} has no acquiring_patterns entry; cannot verify evidence.`,
      });
      continue;
    }
    const gate = canPromote(pattern);
    if (!gate.allowed) {
      rejected.push({
        patch,
        reason: `mastered.add for ${patch.id} failed promotion gate: ${gate.missing.join(', ')}`,
      });
      continue;
    }
    gated.push(patch);
  }

  // Second pass: ladder memory. Every surviving `mastered.add` must have
  // a matching `plan.set` whose primary_goal differs from the mastered
  // id. We check the full set, not just LLM-emitted: a synthetic
  // `lesson_boost` patch that emits both is valid.
  const masteredAdds = gated.filter((p): p is Extract<PatchOp, { op: 'mastered.add' }> => p.op === 'mastered.add');
  if (masteredAdds.length > 0) {
    const planSets = gated.filter((p): p is Extract<PatchOp, { op: 'plan.set' }> => p.op === 'plan.set');
    for (const m of masteredAdds) {
      const hasLadderPlan = planSets.some((ps) => ps.plan.primary_goal && ps.plan.primary_goal !== m.id);
      if (!hasLadderPlan) {
        return {
          patches: [],
          rejected: [
            ...rejected,
            {
              patch: m,
              reason: `ladder_memory: mastered.add(${m.id}) without a plan.set whose primary_goal differs — whole patch set rejected.`,
            },
          ],
          wholeSetRejected: true,
        };
      }
    }
  }

  // Third pass (F-P7-03) — for every approved `mastered.add`, append a
  // Live-biased re-exposure probe to the first `plan.set` that carries
  // the ladder's new `primary_goal`. We mutate a clone of that patch so
  // callers can still log the LLM's original plan shape via `rejected`.
  if (masteredAdds.length > 0) {
    const themesToAvoid = collectThemesFromPatches(gated, masteredAdds[0]!.id, working);
    const augmented: PatchOp[] = [];
    let augmentedOnce = false;
    for (const p of gated) {
      if (!augmentedOnce && p.op === 'plan.set' && p.plan.primary_goal && masteredAdds.some((m) => m.id !== p.plan.primary_goal)) {
        const extraEntries: ReExposureQueueEntry[] = masteredAdds.map((m) =>
          buildReExposureEntry({
            patternId: m.id,
            themesToExclude: themesToAvoid,
            modality: 'live',
            priorProbes: 0,
            reason: `Live-biased re-exposure after mastered.add(${m.id}).`,
          }),
        );
        augmented.push({
          ...p,
          plan: {
            ...p.plan,
            re_exposure_queue: [
              ...(p.plan.re_exposure_queue ?? []),
              ...extraEntries,
            ],
          },
        });
        augmentedOnce = true;
        continue;
      }
      augmented.push(p);
    }
    // Edge case: no `plan.set` with a differing primary_goal exists to
    // piggyback on. Earlier pass already rejected this situation via
    // ladder_memory check, so we should never reach here. Fall through.
    return { patches: augmented, rejected, wholeSetRejected: false };
  }

  return { patches: gated, rejected, wholeSetRejected: false };
}

/**
 * Collect the themes the learner encountered for the given pattern so the
 * next probe excludes them. We look at the working model's evidence
 * (already projected) to stay deterministic.
 */
function collectThemesFromPatches(
  _patches: PatchOp[],
  patternId: string,
  working: LearnerModel,
): string[] {
  const pattern = working.acquiring_patterns.find((p) => p.id === patternId);
  const evidence = pattern?.evidence;
  const fromEvidence = evidence?.themes_seen ?? [];
  return Array.from(new Set(fromEvidence.map((t) => t.trim().toLowerCase()).filter(Boolean)));
}

