import { describe, it, expect } from 'vitest';
import { computeTrajectory } from './trajectoryEstimator';

function mk(rates: number[]) {
  return rates.map((r, i) => ({ at: `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00Z`, success_rate: r }));
}

describe('computeTrajectory', () => {
  it('returns noisy when fewer than 3 samples', () => {
    expect(computeTrajectory({ history: [] })).toBe('noisy');
    expect(computeTrajectory({ history: mk([0.8]) })).toBe('noisy');
    expect(computeTrajectory({ history: mk([0.8, 0.85]) })).toBe('noisy');
  });

  it('flags a clean upward series as improving', () => {
    const t = computeTrajectory({ history: mk([0.3, 0.4, 0.5, 0.6, 0.7]) });
    expect(t).toBe('improving');
  });

  it('flags a clean downward series as regressing', () => {
    const t = computeTrajectory({ history: mk([0.9, 0.85, 0.7, 0.55, 0.4]) });
    expect(t).toBe('regressing');
  });

  it('flags a flat series as stable', () => {
    const t = computeTrajectory({ history: mk([0.7, 0.72, 0.69, 0.71, 0.7]) });
    expect(t).toBe('stable');
  });

  it('flags a noisy swinging series as noisy', () => {
    const t = computeTrajectory({ history: mk([0.9, 0.2, 0.9, 0.2, 0.9]) });
    expect(t).toBe('noisy');
  });

  it('overrides with regressing when streakJustBroken is true', () => {
    const t = computeTrajectory({
      history: mk([0.4, 0.5, 0.6, 0.7, 0.8]),
      streakJustBroken: true,
    });
    expect(t).toBe('regressing');
  });

  it('treats small oscillations around the same mean as stable', () => {
    const t = computeTrajectory({ history: mk([0.6, 0.65, 0.6, 0.63, 0.62]) });
    expect(t).toBe('stable');
  });
});
