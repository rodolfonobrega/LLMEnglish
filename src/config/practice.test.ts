import { describe, expect, it } from 'vitest';
import { exerciseSetupSteps, liveSetupScenarios } from './practice';

describe('exerciseSetupSteps', () => {
  it('keeps the agreed setup order', () => {
    expect(exerciseSetupSteps).toEqual(['format', 'type', 'theme', 'generate']);
  });
});

describe('liveSetupScenarios', () => {
  it('includes everyday and skill scenarios', () => {
    expect(liveSetupScenarios.map(s => s.id)).toEqual(['everyday', 'skill']);
  });

  it('skill scenario is highlighted', () => {
    const skill = liveSetupScenarios.find(s => s.id === 'skill');
    expect(skill?.highlighted).toBe(true);
  });
});
