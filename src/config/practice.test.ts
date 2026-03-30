import { describe, expect, it } from 'vitest';
import { practicePrimaryModes, practiceSecondaryTools, exerciseSetupSteps } from './practice';

describe('practice hub metadata', () => {
  it('keeps only exercises and live simulation as primary modes', () => {
    expect(practicePrimaryModes.map(item => item.id)).toEqual(['exercises', 'live']);
  });

  it('keeps paths, scripts, history, and errors as secondary tools', () => {
    expect(practiceSecondaryTools.map(item => item.id)).toEqual([
      'paths',
      'scripts',
      'history',
      'errors',
    ]);
  });
});

describe('exerciseSetupSteps', () => {
  it('keeps the agreed setup order', () => {
    expect(exerciseSetupSteps).toEqual(['format', 'type', 'theme', 'generate']);
  });
});
