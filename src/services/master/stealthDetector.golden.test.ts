import { describe, expect, it } from 'vitest';
import {
  containsPedagogicalLeak,
  lessonTitleIsThematic,
  momentIsStealth,
} from './stealthDetector';

/**
 * Golden test: a curated corpus of generator-style outputs that resembles
 * what the downstream prompts should produce. If any of these samples
 * trigger the leak detector, the fixture is wrong — keep them clean of
 * grammatical metalanguage. Conversely, the intentionally-bad samples
 * MUST be flagged.
 */
const CLEAN_SAMPLES: readonly string[] = [
  // Phrase generator
  'Ontem à noite eu tava cozinhando quando o João ligou.',
  'Quando eu cheguei em casa, minha irmã tava assistindo TV.',
  // Text generator
  'Na minha última viagem de carro, aconteceu uma coisa inesperada.',
  // Roleplay
  'Você está num café e o garçom trouxe o prato errado. Reclama educadamente.',
  // Cloze (underscore blank)
  'I ____ a movie when the power went out. (watch)',
  // Error spotting
  'Yesterday I go to the park with my friends.',
  // Reaction drill
  'Oh no, my laptop just crashed!',
  // Narrative seed
  'It was a quiet Sunday morning when a strange noise woke me up.',
  // Listening passage
  'A short clip about how a barista fixes a broken coffee machine in the middle of a rush.',
];

const LEAKY_SAMPLES: readonly string[] = [
  'Today we will learn the past continuous tense.',
  'Use phrasal verbs to complete the sentence.',
  'Esse exercício foca no present perfect.',
  'Observe o objetivo pedagógico desta frase.',
  'Este drill pratica verbos modais como should e must.',
];

describe('stealthDetector — golden corpus', () => {
  it.each(CLEAN_SAMPLES)('does not flag clean sample: %s', (sample) => {
    expect(containsPedagogicalLeak(sample)).toBe(false);
  });

  it.each(LEAKY_SAMPLES)('flags leaky sample: %s', (sample) => {
    expect(containsPedagogicalLeak(sample)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wave 6 Stage B — Lesson-level stealth tests
// ---------------------------------------------------------------------------

const CLEAN_LESSON_TITLES: readonly string[] = [
  'An interrupted Saturday morning',
  'The phone call that changed my evening',
  'A funny commute story',
  'O dia em que o jantar saiu errado',
];

const LEAKY_LESSON_TITLES: readonly string[] = [
  'Past continuous masterclass',
  'Aula de presente perfeito',
  'Grammar lesson: phrasal verbs',
  'Tudo sobre o passado contínuo',
  'Aula de gramática',
];

describe('lessonTitleIsThematic', () => {
  it.each(CLEAN_LESSON_TITLES)('accepts thematic title: %s', (title) => {
    expect(lessonTitleIsThematic(title)).toBe(true);
  });

  it.each(LEAKY_LESSON_TITLES)('rejects didactic title: %s', (title) => {
    expect(lessonTitleIsThematic(title)).toBe(false);
  });
});

describe('momentIsStealth', () => {
  it('flags a moment 1 hook with grammar metalanguage', () => {
    expect(
      momentIsStealth({
        index: 1,
        studentFacingText: 'Hoje vamos praticar o presente perfeito.',
      }),
    ).toBe(false);
  });

  it('accepts a clean moment 3 payload', () => {
    expect(
      momentIsStealth({
        index: 3,
        studentFacingText: 'I ____ reading when he called.',
      }),
    ).toBe(true);
  });

  it('ALWAYS allows moment 5 (reveal) regardless of grammar labels', () => {
    expect(
      momentIsStealth({
        index: 5,
        studentFacingText:
          'Nesta aula você praticou o passado contínuo em narrativas interrompidas.',
      }),
    ).toBe(true);
  });
});
