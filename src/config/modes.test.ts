import { describe, expect, it } from 'vitest';
import { focusedDrillModes, exerciseModes, conversationModes } from './modes';

describe('focusedDrillModes', () => {
  it('contains the 7 Wave 4 modalities', () => {
    expect(focusedDrillModes).toHaveLength(7);
    const ids = focusedDrillModes.map((m) => m.id).sort();
    expect(ids).toEqual(
      ['cloze', 'listening', 'narrative', 'reaction', 'reformulation', 'shadowing', 'spotting'].sort(),
    );
  });

  it('every entry points at /exercises with its mode query param', () => {
    for (const mode of focusedDrillModes) {
      expect(mode.to).toBe(`/exercises?mode=${mode.id}`);
    }
  });

  it('every entry has a distinct colorVar so CSS lookups do not collide', () => {
    const colors = focusedDrillModes.map((m) => m.colorVar);
    const unique = new Set(colors);
    expect(unique.size).toBe(colors.length);
  });

  it('all drills share no ids with the existing exercise or conversation modes', () => {
    const drillIds = new Set(focusedDrillModes.map((m) => m.id));
    const otherIds = [...exerciseModes, ...conversationModes].map((m) => m.id);
    for (const id of otherIds) {
      expect(drillIds.has(id)).toBe(false);
    }
  });
});
