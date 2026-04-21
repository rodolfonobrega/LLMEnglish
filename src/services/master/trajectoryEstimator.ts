/**
 * trajectoryEstimator — Phase 7 (F-P7-04).
 *
 * Deterministic trajectory classification for an acquiring pattern.
 * Consumed both by the promotion gate (rule 5 requires a trajectory of
 * `improving` or `stable`) and by the prescribe prompt as an internal
 * hint that influences which patterns get re-exposed.
 *
 * We intentionally keep this logic in code — not in an LLM prompt —
 * because small-sample noise is the most common failure mode of this
 * metric and we want the classification to be reproducible. The only
 * input is the ordered history of `{ at, success_rate }` observations;
 * output is a `TrajectoryState`.
 *
 * Rules (mirroring §7c.5 of the master-integration-plan):
 *   - `noisy`     — fewer than 3 samples, OR
 *                   high variance relative to the overall trend.
 *   - `improving` — last 3 rolling means are monotonically increasing.
 *   - `regressing`— last 3 rolling means are monotonically decreasing,
 *                   OR the most recent sample wiped out a long streak.
 *   - `stable`    — the absolute change across the last window is
 *                   within ±0.1 AND the series is not classified noisy.
 */

import type { TrajectoryState } from '../../types/learnerModel';

/**
 * One observation contributing to the trajectory. `success_rate` is
 * expected in [0, 1]. Callers feed the rolling rate after each session.
 */
export interface TrajectorySample {
  at: string;
  success_rate: number;
}

export interface TrajectoryInput {
  /** Ordered oldest→newest. The estimator only reads the tail. */
  history: TrajectorySample[];
  /**
   * Optional: true when the most recent sample broke a long streak of
   * correct attempts. When set we bias toward `regressing`.
   */
  streakJustBroken?: boolean;
}

/** Public entry point. */
export function computeTrajectory(input: TrajectoryInput): TrajectoryState {
  const h = Array.isArray(input.history) ? input.history : [];
  if (h.length < 3) return 'noisy';

  const rates = h.map((s) => clamp01(s.success_rate));
  const tail = rates.slice(-5);

  // Rolling 3-session means (windowed).
  const means: number[] = [];
  for (let i = 2; i < tail.length; i++) {
    means.push((tail[i - 2] + tail[i - 1] + tail[i]) / 3);
  }

  const delta = means.length >= 2 ? means[means.length - 1] - means[0] : 0;

  // Session-to-session jitter — absolute differences in the tail.
  const diffs: number[] = [];
  for (let i = 1; i < tail.length; i++) diffs.push(Math.abs(tail[i] - tail[i - 1]));
  const avgJitter = diffs.length > 0 ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0;

  // Noisy: large jitter relative to trend, or a large swing with no direction.
  const jitterDominates = avgJitter > 0.2 && avgJitter > Math.abs(delta);
  if (jitterDominates) return 'noisy';

  // Regressing — monotonic decrease across rolling means, OR a broken streak.
  const monotonicallyDown = means.every(
    (m, i, arr) => i === 0 || m <= arr[i - 1],
  );
  const monotonicallyUp = means.every(
    (m, i, arr) => i === 0 || m >= arr[i - 1],
  );
  const strictlyDown = means.length >= 2 && monotonicallyDown && means[means.length - 1] < means[0];
  const strictlyUp = means.length >= 2 && monotonicallyUp && means[means.length - 1] > means[0];

  if (input.streakJustBroken) return 'regressing';
  if (strictlyDown && delta <= -0.05) return 'regressing';
  if (strictlyUp && delta >= 0.05) return 'improving';

  // Everything else within a narrow band — stable.
  if (Math.abs(delta) <= 0.1) return 'stable';

  // Directional change too small to be improving/regressing but outside
  // the stable band — treat as noisy.
  return 'noisy';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
