import { describe, expect, it } from 'vitest';
import { exerciseSetupSteps, liveSetupScenarios } from './practice';

describe('exerciseSetupSteps', () => {
  it('keeps the agreed setup order', () => {
    expect(exerciseSetupSteps).toEqual(['format', 'type', 'theme', 'generate']);
  });
});

describe('liveSetupScenarios', () => {
  it('includes everyday and interview scenarios', () => {
    expect(liveSetupScenarios.map(s => s.id)).toEqual(['everyday', 'interview']);
  });

  it('interview scenario is highlighted', () => {
    const interview = liveSetupScenarios.find(s => s.id === 'interview');
    expect(interview?.highlighted).toBe(true);
  });
});
