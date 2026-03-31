import { describe, expect, it } from 'vitest';
import {
  exerciseModes,
  conversationModes,
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
  it('has exactly 3 conversation modes in the correct order', () => {
    expect(conversationModes.map(m => m.id)).toEqual([
      'simulation',
      'interview',
      'visual',
    ]);
  });

  it('interview is marked as highlighted', () => {
    const interview = conversationModes.find(m => m.id === 'interview');
    expect(interview?.highlighted).toBe(true);
  });

  it('only interview is highlighted', () => {
    const highlighted = conversationModes.filter(m => m.highlighted);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe('interview');
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
