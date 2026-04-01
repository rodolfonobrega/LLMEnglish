import { describe, expect, it } from 'vitest';
import {
  exerciseModes,
  conversationModes,
  trailsMode,
  allModes,
  type PracticeMode,
} from './modes';

describe('exerciseModes', () => {
  it('has exactly 4 exercise modes in the correct order', () => {
    expect(exerciseModes.map(m => m.id)).toEqual([
      'phrases',
      'texts',
      'situations',
      'scripts',
    ]);
  });

  it('each mode has required fields', () => {
    exerciseModes.forEach(mode => {
      expect(mode).toHaveProperty('id');
      expect(mode).toHaveProperty('label');
      expect(mode).toHaveProperty('description');
      expect(mode).toHaveProperty('example');
      expect(mode).toHaveProperty('colorVar');
      expect(mode).toHaveProperty('icon');
      expect(mode).toHaveProperty('to');
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
      expect(mode.example.length).toBeGreaterThan(0);
    });
  });
});

describe('conversationModes', () => {
  it('has exactly 2 conversation modes in the correct order', () => {
    expect(conversationModes.map(m => m.id)).toEqual([
      'simulation',
      'visual',
    ]);
  });

  it('no modes are highlighted', () => {
    const highlighted = conversationModes.filter(m => m.highlighted);
    expect(highlighted).toHaveLength(0);
  });
});

describe('trailsMode', () => {
  it('has the correct id and route', () => {
    expect(trailsMode.id).toBe('trails');
    expect(trailsMode.to).toBe('/paths');
  });
});

describe('allModes', () => {
  it('contains all 7 modes', () => {
    expect(allModes).toHaveLength(7);
  });

  it('has no duplicate ids', () => {
    const ids = allModes.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
