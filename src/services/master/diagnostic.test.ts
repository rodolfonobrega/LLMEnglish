import { describe, expect, it } from 'vitest';
import {
  adviseDiagnostic,
  maybeExitDiagnosticPatch,
  shouldExitDiagnostic,
} from './diagnostic';
import { createDiagnosticModel } from '../../types/learnerModel';
import type { LearnerModel } from '../../types/learnerModel';

function mkModel(overrides: Partial<LearnerModel> = {}): LearnerModel {
  return { ...createDiagnosticModel(), ...overrides };
}

describe('diagnostic helpers', () => {
  it('stays in diagnostic for a fresh model with no confidence', () => {
    const m = mkModel({ diagnostic_mode: true, confidence: 0 });
    expect(shouldExitDiagnostic(m)).toBe(false);
    expect(adviseDiagnostic(m).isDiagnostic).toBe(true);
  });

  it('exits diagnostic when confidence crosses the high threshold', () => {
    const m = mkModel({ diagnostic_mode: true, confidence: 0.7 });
    expect(shouldExitDiagnostic(m)).toBe(true);
    expect(maybeExitDiagnosticPatch(m)).toEqual({ op: 'diagnostic.set', value: false });
  });

  it('exits diagnostic after enough sessions and medium confidence', () => {
    const m = mkModel({
      diagnostic_mode: true,
      confidence: 0.45,
      acquiring_patterns: [
        {
          id: 'past_continuous_in_interrupted_narrative',
          hypothesis: 'h',
          attempts: 6,
          success_rate: 0.5,
          last_seen: new Date().toISOString(),
        },
      ],
    });
    expect(shouldExitDiagnostic(m)).toBe(true);
  });

  it('does not emit an exit patch when already out of diagnostic', () => {
    const m = mkModel({ diagnostic_mode: false, confidence: 0.9 });
    expect(maybeExitDiagnosticPatch(m)).toBeNull();
  });

  it('advises a suggested modality that is not the most recent choice', () => {
    const m = mkModel({ diagnostic_mode: true, confidence: 0.1 });
    const advice = adviseDiagnostic(m, ['phrase']);
    expect(advice.suggestedModality).not.toBe('phrase');
  });

  it('falls back to the neutral theme pool when engagement_profile has no themes', () => {
    const m = mkModel({ diagnostic_mode: true, confidence: 0.1 });
    const advice = adviseDiagnostic(m);
    expect(advice.themePool.length).toBeGreaterThan(0);
  });

  it('prefers themes_that_land when available', () => {
    const m = mkModel({
      diagnostic_mode: true,
      confidence: 0.1,
      engagement_profile: {
        ...createDiagnosticModel().engagement_profile,
        themes_that_land: ['cooking', 'sports'],
      },
    });
    const advice = adviseDiagnostic(m);
    expect(advice.themePool).toEqual(['cooking', 'sports']);
  });
});
