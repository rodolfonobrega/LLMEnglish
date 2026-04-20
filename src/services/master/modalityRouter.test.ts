import { describe, expect, it } from 'vitest';
import { routeModality } from './modalityRouter';
import type { Briefing, Modality } from '../../types/master';

function briefing(modality: Modality): Briefing {
  return {
    target_skill: 'past_continuous_in_interrupted_narrative',
    modality_choice: modality,
    disguise_theme: 'weekend plans',
    required_elements: [],
    forbidden_elements: [],
    success_criteria: 'ok',
    expected_difficulty: 'slight_stretch',
  };
}

describe('routeModality', () => {
  it('routes every known modality to an existing exercise URL', () => {
    const expectations: Record<Modality, string> = {
      phrase: '/exercises?mode=phrases',
      text: '/exercises?mode=texts',
      roleplay: '/exercises?mode=situations',
      visual: '/exercises?mode=visual',
      cloze: '/exercises?mode=cloze',
      spotting: '/exercises?mode=spotting',
      reaction: '/exercises?mode=reaction',
      shadowing: '/exercises?mode=shadowing',
      reformulation: '/exercises?mode=reformulation',
      narrative: '/exercises?mode=narrative',
      listening: '/exercises?mode=listening',
      live: '/live',
    };

    for (const [modality, path] of Object.entries(expectations) as [Modality, string][]) {
      const target = routeModality(briefing(modality));
      expect(target.path).toBe(path);
      expect(target.state?.briefing.modality_choice).toBe(modality);
    }
  });

  it('falls back to the phrase route for an unknown modality', () => {
    const target = routeModality({
      ...briefing('phrase'),
      modality_choice: 'not_a_mode' as unknown as Modality,
    });
    expect(target.path).toBe('/exercises?mode=phrases');
  });

  it('always carries the briefing forward in route state', () => {
    const b = briefing('text');
    const target = routeModality(b);
    expect(target.state?.briefing).toBe(b);
  });
});
