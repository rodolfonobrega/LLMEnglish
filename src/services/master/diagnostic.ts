/**
 * Diagnostic cold-start — Wave 5 (F18).
 *
 * For the first few sessions of a new learner (or a freshly reset one),
 * the Master does NOT have enough signal to prescribe meaningfully. The
 * diagnostic helper answers two questions for the `prescribe` caller:
 *   1. Should we still be in diagnostic mode at all?
 *   2. If so, which diversification axis should this session explore?
 *
 * Exit criteria (per §6.2.8):
 *   - `confidence >= 0.6`, OR
 *   - `sessions_since_creation >= 5 AND confidence >= 0.4`.
 *
 * The number of diagnostic sessions is derived from
 * `learner_model_history` row count; since fetching that synchronously
 * would bloat prescribe, we approximate it from `attempts` totals in
 * `acquiring_patterns` (a rough but monotonic proxy). The exact count
 * is always available to `update_model` via DB and is used to emit
 * `diagnostic.set` with value=false when the criteria flip.
 */

import type { LearnerModel, PatchOp } from '../../types/learnerModel';
import type { Modality } from '../../types/master';

export interface DiagnosticAdvice {
  /** True when the Master should prescribe neutral, diversified content. */
  isDiagnostic: boolean;
  /** Rotating modality suggestion to ensure breadth. */
  suggestedModality: Modality;
  /** Difficulty bias — all diagnostic sessions stay around slight_stretch. */
  difficultyBias: 'easy' | 'slight_stretch' | 'challenge';
  /** Themes to prefer when diversifying. */
  themePool: string[];
}

const DIAGNOSTIC_MIN_SESSIONS_TO_EXIT = 5;
const DIAGNOSTIC_HIGH_CONFIDENCE = 0.6;
const DIAGNOSTIC_EXIT_CONFIDENCE_FLOOR = 0.4;

const NEUTRAL_THEMES: readonly string[] = [
  'weekend plans',
  'cooking',
  'commuting',
  'small talk at work',
  'a favourite movie',
  'a recent trip',
  'asking for help',
  'giving directions',
  'reacting to news',
  'restaurant ordering',
];

const DIAGNOSTIC_MODALITY_ROTATION: readonly Modality[] = [
  'phrase',
  'roleplay',
  'cloze',
  'reformulation',
  'text',
];

/** Estimate how many diagnostic sessions have run so far. */
function estimateSessionsCount(model: LearnerModel): number {
  const totalAttempts = model.acquiring_patterns.reduce(
    (sum, p) => sum + (p.attempts ?? 0),
    0,
  );
  // Roughly 1 attempt per session per pattern; clamp to [0, 20] to avoid
  // runaway numbers once the learner is way past diagnostic mode.
  return Math.min(20, Math.floor(totalAttempts / Math.max(1, model.acquiring_patterns.length || 1)));
}

export function shouldExitDiagnostic(model: LearnerModel): boolean {
  if (!model.diagnostic_mode) return true; // already out
  if (model.confidence >= DIAGNOSTIC_HIGH_CONFIDENCE) return true;
  const sessions = estimateSessionsCount(model);
  if (sessions >= DIAGNOSTIC_MIN_SESSIONS_TO_EXIT && model.confidence >= DIAGNOSTIC_EXIT_CONFIDENCE_FLOOR) {
    return true;
  }
  return false;
}

export function adviseDiagnostic(
  model: LearnerModel,
  recentModalityChoices: string[] = [],
): DiagnosticAdvice {
  const sessions = estimateSessionsCount(model);
  // Bias against the most recent modality.
  const avoid = new Set(recentModalityChoices.slice(0, 2));
  const rotationIdx = sessions % DIAGNOSTIC_MODALITY_ROTATION.length;
  let suggested = DIAGNOSTIC_MODALITY_ROTATION[rotationIdx];
  if (avoid.has(suggested)) {
    suggested =
      DIAGNOSTIC_MODALITY_ROTATION.find((m) => !avoid.has(m)) ?? suggested;
  }
  const themePool =
    model.engagement_profile.themes_that_land.length >= 2
      ? model.engagement_profile.themes_that_land
      : [...NEUTRAL_THEMES];
  return {
    isDiagnostic: !shouldExitDiagnostic(model),
    suggestedModality: suggested,
    difficultyBias: 'slight_stretch',
    themePool,
  };
}

/**
 * When the learner has satisfied the exit criteria but the model is
 * still flagged diagnostic, return a `diagnostic.set` patch that
 * `update_model` can append.
 */
export function maybeExitDiagnosticPatch(model: LearnerModel): PatchOp | null {
  if (model.diagnostic_mode && shouldExitDiagnostic(model)) {
    return { op: 'diagnostic.set', value: false };
  }
  return null;
}
