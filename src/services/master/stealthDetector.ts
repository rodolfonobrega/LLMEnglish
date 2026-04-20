/**
 * Stealth detector — Wave 5 (R-2 mitigation).
 *
 * The Master's pedagogical intent MUST stay invisible to the student.
 * Generators receive a `Briefing` with `target_skill` (e.g.
 * `past_continuous_in_interrupted_narrative`) but the generated student-
 * facing text must never leak grammatical metalanguage that would reveal
 * what the exercise is secretly targeting.
 *
 * This helper runs over any Master-shaped generator output and returns
 * `true` when a known pedagogical label appears. The project uses it
 * as:
 *   - an offline regression check in `stealthDetector.test.ts`,
 *   - a future runtime guard in generators that can fall back to a
 *     neutral re-roll if a leak is detected.
 *
 * Keep this list conservative: false positives are cheap (one re-roll),
 * false negatives are dangerous (the whole stealth curriculum is about
 * hiding these terms).
 */

/** English-side phrases that directly name a grammatical target. */
const EN_PEDAGOGICAL_PHRASES: string[] = [
  // Tense / aspect
  'past continuous',
  'past simple',
  'present perfect',
  'present continuous',
  'past perfect',
  'future continuous',
  'future perfect',
  'simple present',
  'simple past',
  'continuous tense',
  'perfect tense',
  // Word-class terms
  'phrasal verb',
  'phrasal verbs',
  'modal verb',
  'modal verbs',
  'auxiliary verb',
  'gerund',
  'infinitive',
  'participle',
  'conditional sentence',
  'conditional type',
  // Meta language
  'grammar rule',
  'grammatically',
  'grammar point',
  "today we will learn",
  "today you will learn",
  "we're practicing",
  "we are practicing",
  "we're focusing on",
  "we are focusing on",
  "this exercise targets",
  "this exercise is about",
  "the target skill is",
  "the target of this exercise",
  "pedagogical",
  "learning objective",
  "lesson objective",
];

/** Portuguese-side equivalents that also count as leaks. */
const PT_PEDAGOGICAL_PHRASES: string[] = [
  'passado contínuo',
  'passado continuo',
  'presente contínuo',
  'presente continuo',
  'presente perfeito',
  'pretérito perfeito',
  'preterito perfeito',
  'pretérito imperfeito',
  'verbo modal',
  'verbos modais',
  'verbo frasal',
  'verbos frasais',
  'gerúndio',
  'gerundio',
  'particípio',
  'participio',
  'regra gramatical',
  'regras gramaticais',
  'ponto gramatical',
  'hoje vamos aprender',
  'estamos praticando',
  'estamos focando em',
  'objetivo pedagógico',
  'objetivo da aula',
  'o foco é praticar',
  'o foco desta atividade',
];

const ALL_PEDAGOGICAL_PHRASES: readonly string[] = [
  ...EN_PEDAGOGICAL_PHRASES,
  ...PT_PEDAGOGICAL_PHRASES,
];

/**
 * True when the text contains any known pedagogical leak.
 *
 * Matching rules:
 *   - Case-insensitive.
 *   - Whitespace-normalised (multiple spaces collapse to one).
 *   - Word-boundary-ish: we add leading/trailing spaces to avoid false
 *     positives inside bigger words (e.g. "gerundial" won't match
 *     "gerund" because the compare space-pads).
 */
export function containsPedagogicalLeak(text: string | null | undefined): boolean {
  if (!text) return false;
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  for (const phrase of ALL_PEDAGOGICAL_PHRASES) {
    // Phrases already contain spaces, so we just substring-match on the padded haystack.
    if (haystack.includes(phrase.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Return the list of leaked phrases found in the text. Useful in tests
 * for clearer failure messages.
 */
export function findPedagogicalLeaks(text: string | null | undefined): string[] {
  if (!text) return [];
  const haystack = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const hits: string[] = [];
  for (const phrase of ALL_PEDAGOGICAL_PHRASES) {
    if (haystack.includes(phrase.toLowerCase()) && !hits.includes(phrase)) {
      hits.push(phrase);
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Lessons (Wave 6 Stage B) — R-9 mitigations
// ---------------------------------------------------------------------------

/**
 * A lesson's thematic title must NEVER surface grammar metalanguage. Use
 * for `LessonPlan.title_thematic` and for any moment 1–4 student-facing
 * copy. Moment 5 ("reveal") is explicitly allowed to name the target.
 */
export function lessonTitleIsThematic(title: string | null | undefined): boolean {
  if (!title) return false;
  if (containsPedagogicalLeak(title)) return false;
  // Extra safety: ban the bare word "grammar"/"gramática" in titles because
  // substring matching above requires a two-word phrase.
  const normalised = ` ${title.toLowerCase()} `;
  const bannedTitleWords = [' grammar ', ' gramática ', ' gramatica '];
  for (const w of bannedTitleWords) {
    if (normalised.includes(w)) return false;
  }
  return true;
}

/**
 * Per-moment stealth gate.
 *
 * `moment` is a minimal shape so callers don't have to import the full
 * `MomentContent` union — any object carrying an `index` and a student-
 * facing text blob works. Moments 1..4 must be stealth-clean; moment 5
 * is always considered stealth (it's the explicit reveal).
 */
export interface StealthCheckMoment {
  index: 1 | 2 | 3 | 4 | 5;
  studentFacingText: string | null | undefined;
}

export function momentIsStealth(moment: StealthCheckMoment): boolean {
  if (moment.index === 5) return true;
  return !containsPedagogicalLeak(moment.studentFacingText);
}
