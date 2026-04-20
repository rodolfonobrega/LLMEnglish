/**
 * Canonical patterns catalogue.
 *
 * Replaces the regex-based `guessCategory` + `createPatternFromCorrection` slice
 * heuristics in `errorAnalysis.ts`. Every canonical pattern has:
 *   - A stable, semantic `id` (e.g. `past_continuous_in_interrupted_narrative`).
 *   - A human-facing Portuguese label used in dashboards and the Master's notes.
 *   - A `category` that maps back to the legacy `ErrorCategory` enum so
 *     existing aggregations keep working.
 *   - A short `description` used by the evaluator prompt as a reference.
 *
 * When the evaluator returns `canonical_pattern: "..."` on a correction, we
 * look it up here. Unknown ids fall through to `softFallbackPattern`, which
 * derives a slugged id from the canonical name without collapsing different
 * phenomena into the same bucket (which was the root cause of the legacy bug).
 *
 * The catalogue intentionally covers only the most impactful ~30 phenomena;
 * the Master (Wave 5) can propose new ones via a `suggest_canonical` path and
 * operators promote them into this file in a follow-up PR.
 */

import type { ErrorCategory } from '../types/errors';

export interface CanonicalPattern {
  /** Stable slug. Treat as immutable once published. */
  id: string;
  /** Portuguese label used in the error dashboard. */
  label: string;
  /** Short English description passed to the evaluator prompt. */
  description: string;
  /** Legacy category for aggregation and filtering. */
  category: ErrorCategory;
  /** CEFR level where this phenomenon typically surfaces. */
  cefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

/**
 * The catalogue. Grouped by rough CEFR progression to help humans scan.
 * IDs are snake_case and must match the evaluator's `canonical_pattern` output.
 */
export const CANONICAL_PATTERNS: readonly CanonicalPattern[] = [
  // --- Verb tense (most frequent error bucket) ---
  {
    id: 'simple_past_of_regular_verbs',
    label: 'Passado simples de verbos regulares',
    description: 'Regular verbs ending in -ed (walked, played). Confuses with present or overuses -ed (goed).',
    category: 'verb-tense',
    cefr: 'A2',
  },
  {
    id: 'simple_past_of_irregular_verbs',
    label: 'Passado simples de verbos irregulares',
    description: 'Irregular past forms (went, took, ran) where the learner produces a regularised form (goed, taked, runned).',
    category: 'verb-tense',
    cefr: 'A2',
  },
  {
    id: 'past_continuous_in_interrupted_narrative',
    label: 'Passado contínuo em narrativas interrompidas',
    description: 'Was/were + -ing for an action in progress when something else happened (I was walking when...).',
    category: 'verb-tense',
    cefr: 'B1',
  },
  {
    id: 'present_perfect_for_recent_past',
    label: 'Present perfect para passado recente',
    description: 'Have/has + past participle for experiences, unfinished time, or recent events (I have just eaten).',
    category: 'verb-tense',
    cefr: 'B1',
  },
  {
    id: 'present_perfect_vs_simple_past',
    label: 'Present perfect vs. passado simples',
    description: 'Choosing present perfect for unspecified time vs. simple past for specific time. Common mix-up.',
    category: 'verb-tense',
    cefr: 'B1',
  },
  {
    id: 'future_going_to_vs_will',
    label: 'Going to vs. will',
    description: 'Going to for intention/planned future, will for decisions-in-the-moment and predictions.',
    category: 'verb-tense',
    cefr: 'A2',
  },
  {
    id: 'third_person_singular_s',
    label: 'Terceira pessoa do singular (-s)',
    description: 'He/she/it + verb with -s in simple present (she works, he goes). Commonly dropped.',
    category: 'grammar',
    cefr: 'A1',
  },
  {
    id: 'modal_verbs_should_could_would',
    label: 'Modais (should/could/would)',
    description: 'Advice, possibility, and hypothetical forms without -to after the modal.',
    category: 'grammar',
    cefr: 'B1',
  },

  // --- Articles ---
  {
    id: 'article_a_vs_an',
    label: 'Artigo a vs. an',
    description: 'A before consonant sounds, an before vowel sounds. Trips learners on h- words.',
    category: 'article',
    cefr: 'A1',
  },
  {
    id: 'definite_article_the_for_specific',
    label: 'Artigo definido the para específico',
    description: 'Use of the to mark specificity or previously mentioned referents. Often omitted by PT-BR speakers.',
    category: 'article',
    cefr: 'A2',
  },
  {
    id: 'zero_article_for_general_plurals',
    label: 'Artigo zero para plurais gerais',
    description: 'Omit the with generic plurals and uncountables (I like coffee, not the coffee).',
    category: 'article',
    cefr: 'A2',
  },

  // --- Prepositions ---
  {
    id: 'prepositions_of_place_in_on_at',
    label: 'Preposições de lugar (in/on/at)',
    description: 'In for enclosed, on for surfaces, at for points. Heavy L1 interference.',
    category: 'preposition',
    cefr: 'A1',
  },
  {
    id: 'prepositions_of_time_in_on_at',
    label: 'Preposições de tempo (in/on/at)',
    description: 'In + months/years, on + days/dates, at + clock times.',
    category: 'preposition',
    cefr: 'A1',
  },
  {
    id: 'dependent_prepositions_verb_combinations',
    label: 'Preposições dependentes de verbo',
    description: 'Verb + preposition collocations (listen to, depend on, arrive at).',
    category: 'preposition',
    cefr: 'B1',
  },

  // --- Word order / syntax ---
  {
    id: 'adjective_before_noun_order',
    label: 'Adjetivo antes do substantivo',
    description: 'English puts adjective before the noun (a red car, not a car red).',
    category: 'word-order',
    cefr: 'A1',
  },
  {
    id: 'question_word_order_inversion',
    label: 'Ordem de inversão em perguntas',
    description: 'Auxiliary inversion in questions (Do you like? Where is she?).',
    category: 'word-order',
    cefr: 'A1',
  },
  {
    id: 'negation_with_dont_doesnt',
    label: 'Negação com don\'t/doesn\'t',
    description: 'Auxiliary + not + base verb (I don\'t like, she doesn\'t work).',
    category: 'grammar',
    cefr: 'A1',
  },

  // --- Countable / uncountable ---
  {
    id: 'countable_vs_uncountable_nouns',
    label: 'Contáveis vs. incontáveis',
    description: 'Some/any, much/many, few/little agreement with countable vs. uncountable.',
    category: 'grammar',
    cefr: 'A2',
  },

  // --- Vocabulary false friends & lexical gaps ---
  {
    id: 'false_friend_substitution',
    label: 'Falso cognato',
    description: 'Portuguese-looking word used with the wrong English meaning (actual, realize, pretend).',
    category: 'vocabulary',
    cefr: 'A2',
  },
  {
    id: 'make_vs_do_collocations',
    label: 'Make vs. do (colocações)',
    description: 'Make a decision, do your homework — collocations with few semantic rules.',
    category: 'vocabulary',
    cefr: 'A2',
  },
  {
    id: 'phrasal_verbs_daily_life',
    label: 'Phrasal verbs de uso diário',
    description: 'Get up, turn on, figure out — non-compositional meaning.',
    category: 'vocabulary',
    cefr: 'B1',
  },

  // --- Fluency / pragmatics / discourse ---
  {
    id: 'discourse_markers_and_fillers',
    label: 'Marcadores de discurso e fillers',
    description: 'You know, like, well, I mean, actually — keep speech sounding natural.',
    category: 'fluency',
    cefr: 'B1',
  },
  {
    id: 'contractions_in_casual_speech',
    label: 'Contrações na fala casual',
    description: 'I\'m, don\'t, gonna, wanna — missing contractions make speech sound textbook-stiff.',
    category: 'fluency',
    cefr: 'A2',
  },
  {
    id: 'register_mismatch_formal_casual',
    label: 'Descompasso de registro',
    description: 'Using formal English ("I would like to inquire") in a casual context ("hey, could I ask you...").',
    category: 'fluency',
    cefr: 'B1',
  },
  {
    id: 'polite_request_forms',
    label: 'Pedidos polidos',
    description: 'Could you, would you mind, I was wondering if — softer alternatives to bare imperatives.',
    category: 'fluency',
    cefr: 'B1',
  },
  {
    id: 'connected_speech_linking',
    label: 'Fala conectada (linking)',
    description: 'Linking consonants to vowels across word boundaries (an apple → "an_apple").',
    category: 'pronunciation',
    cefr: 'B1',
  },
  {
    id: 'sentence_stress_content_words',
    label: 'Acento de frase em palavras de conteúdo',
    description: 'Stress nouns/verbs/adjectives; reduce function words — English rhythm rule.',
    category: 'pronunciation',
    cefr: 'B1',
  },

  // --- Sentence construction / cohesion ---
  {
    id: 'relative_clauses_who_which_that',
    label: 'Orações relativas (who/which/that)',
    description: 'Joining sentences with relative pronouns; dropping the pronoun in object position.',
    category: 'syntax',
    cefr: 'B1',
  },
  {
    id: 'conditional_type_1_real_future',
    label: 'Condicional real (tipo 1)',
    description: 'If + present, will + base — real future conditions (If it rains, I\'ll stay).',
    category: 'verb-tense',
    cefr: 'A2',
  },
  {
    id: 'conditional_type_2_hypothetical',
    label: 'Condicional hipotético (tipo 2)',
    description: 'If + past simple, would + base — unreal present/future (If I were you...).',
    category: 'verb-tense',
    cefr: 'B2',
  },
  {
    id: 'reporting_verbs_say_tell_ask',
    label: 'Verbos de relato (say/tell/ask)',
    description: 'Say (to someone) vs. tell (someone) vs. ask — indirect speech basics.',
    category: 'grammar',
    cefr: 'B1',
  },
];

const BY_ID = new Map(CANONICAL_PATTERNS.map((p) => [p.id, p]));

/** Look up a canonical pattern by id, returning `undefined` if unknown. */
export function getCanonicalPattern(id: string): CanonicalPattern | undefined {
  return BY_ID.get(id);
}

/** Normalise a raw string into a stable slug used when inventing fallback ids. */
export function slugifyPatternId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'unclassified';
}

/**
 * Build an `ErrorPattern`-shaped id+label pair from a known canonical id.
 * Callers compose this with the evaluation context to persist a row.
 */
export function buildPatternFromCanonicalId(id: string): {
  id: string;
  label: string;
  category: ErrorCategory;
  cefr?: CanonicalPattern['cefr'];
} {
  const entry = BY_ID.get(id);
  if (entry) {
    return { id: entry.id, label: entry.label, category: entry.category, cefr: entry.cefr };
  }
  // Preserve the incoming id so different phenomena don't collapse, but tag
  // the row as `other` so the dashboard still works.
  return { id, label: id.replace(/_/g, ' '), category: 'other' };
}

/**
 * Fallback used when the evaluator omitted `canonical_pattern`. Slugifies the
 * short tip so two different tips hash to two different buckets. Much better
 * than the legacy `slice(0, 30)` approach, which collapsed anything sharing
 * a prefix under the same bucket.
 */
export function softFallbackPattern(
  tip: string,
  category: ErrorCategory,
): { id: string; label: string; category: ErrorCategory } {
  const slug = slugifyPatternId(tip);
  return {
    id: `fallback_${category}_${slug}`,
    label: tip.length > 80 ? tip.slice(0, 77) + '...' : tip,
    category,
  };
}

/** Convenience listing used by admin tooling / tests. */
export function listCanonicalPatterns(): readonly CanonicalPattern[] {
  return CANONICAL_PATTERNS;
}
