/**
 * Master.prescribe — Wave 5 (F11).
 *
 * Given the current `LearnerModel`, produce a `Briefing` that tells a
 * generator what to target, which modality to use, and under what
 * disguise theme. The Master is silent: the student never sees the
 * briefing; it only reshapes the generated content.
 *
 * Contract:
 *   - No-op (returns `null`) when `masterEnabled()` is false.
 *   - Runs a schema-validated LLM call. Malformed responses → `null`.
 *   - Caches the last briefing per `(userId, requestedExerciseType)` for
 *     10 minutes to avoid spamming the planner when the student restarts
 *     an exercise. Cache is invalidated whenever a new exercise type is
 *     requested.
 *   - Records telemetry (`role: 'prescribe'`) for every call that reaches
 *     the LLM. Cache hits do not emit telemetry.
 *
 * The generated Briefing is the single source of truth for §6.2.2 (the
 * generators read this) and §6.2.3 (the modality router routes to a URL
 * derived from `modality_choice`).
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { cleanJson } from '../../utils/cleanJson';
import type { Briefing, Modality } from '../../types/master';
import type { LearnerModel } from '../../types/learnerModel';

const MODALITIES: readonly Modality[] = [
  'phrase',
  'text',
  'roleplay',
  'visual',
  'cloze',
  'spotting',
  'reaction',
  'shadowing',
  'reformulation',
  'narrative',
  'listening',
  'live',
];

export interface PrescribeInput {
  learnerModel: LearnerModel;
  /**
   * If the caller already committed to a specific exercise family
   * (e.g. the student clicked "Frases"), the Master respects it and
   * only chooses target/disguise — modality is fixed.
   */
  requestedExerciseType?: Modality;
  /** Optional theme the student asked for. Overrides engagement-based choice. */
  userTheme?: string;
  /** Recent modality choices (most recent first) to bias diversification. */
  recentModalityChoices?: string[];
}

// ---------------------------------------------------------------------------
// Session cache (per §6.2.1)
// ---------------------------------------------------------------------------

interface CacheEntry {
  briefing: Briefing;
  at: number;
  requestedExerciseType: Modality | undefined;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const briefingCache = new Map<string, CacheEntry>();

function cacheKey(userId: string, requestedExerciseType?: Modality): string {
  return `${userId}::${requestedExerciseType ?? 'auto'}`;
}

export function clearPrescribeCache(): void {
  briefingCache.clear();
}

// ---------------------------------------------------------------------------
// LLM plumbing
// ---------------------------------------------------------------------------

const briefingSchema = {
  type: 'object' as const,
  properties: {
    target_skill: {
      type: 'string' as const,
      description: 'Canonical pattern id the exercise must exercise (never user-facing).',
    },
    secondary_skill: { type: 'string' as const, description: 'Optional secondary target.' },
    modality_choice: {
      type: 'string' as const,
      enum: MODALITIES as unknown as string[],
      description: 'Which exercise modality should execute this briefing.',
    },
    disguise_theme: {
      type: 'string' as const,
      description:
        'Thematic wrapper for the content, drawn from engagement_profile.themes_that_land when available.',
    },
    required_elements: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description:
        'Outcome-level constraints the content must contain (phrased as outcomes, not labels).',
    },
    forbidden_elements: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Outcome-level constraints the content must avoid.',
    },
    success_criteria: {
      type: 'string' as const,
      description: 'One-line check the evaluator uses to decide if the goal was met.',
    },
    expected_difficulty: {
      type: 'string' as const,
      enum: ['easy', 'slight_stretch', 'challenge'],
    },
    rationale: {
      type: 'string' as const,
      description: 'Internal reasoning for debugging. NEVER shown to the student.',
    },
  },
  required: [
    'target_skill',
    'modality_choice',
    'disguise_theme',
    'required_elements',
    'forbidden_elements',
    'success_criteria',
    'expected_difficulty',
  ],
};

function buildSystemPrompt(): string {
  return `You are the Master, a silent English-learning planner. Given a JSON snapshot of the learner's current state, you MUST output a single JSON object that briefs an exercise generator on what to produce next.

CRITICAL CONTRACT:
- The briefing is internal. The student never sees it. You can use grammatical metalanguage here.
- But the content that the downstream generator produces MUST NOT mention grammatical labels — so phrase "required_elements" as outcome constraints ("the natural English translation must describe an ongoing action that gets interrupted"), NOT as labels ("use past continuous").
- Choose modality_choice from the allowed enum. Prefer diversification when "recent_modality_choices" shows repetition.
- disguise_theme should be drawn from engagement_profile.themes_that_land when non-empty; otherwise pick a neutral, natural-sounding theme (cooking, weekend plans, commuting, pets, sports, etc.).
- success_criteria is a short one-line test that the evaluator will use, e.g. "The student produced at least one clause describing an ongoing action that was interrupted by another event."
- expected_difficulty relative to the learner's current state. In diagnostic_mode, bias toward "slight_stretch" with diversified themes.
- Output STRICT JSON. No prose outside the JSON. No code fences.`;
}

function buildUserMessage(input: PrescribeInput): string {
  const { learnerModel, requestedExerciseType, userTheme, recentModalityChoices } = input;

  const compact = {
    cefr_estimate: learnerModel.cefr_estimate,
    mastered_patterns: learnerModel.mastered_patterns.slice(0, 20),
    acquiring_patterns: learnerModel.acquiring_patterns
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        success_rate: p.success_rate,
        attempts: p.attempts,
        hypothesis: p.hypothesis,
      })),
    chronic_errors: learnerModel.chronic_errors.slice(0, 10).map((p) => ({
      id: p.id,
      occurrences: p.occurrences,
      teaching_attempts: p.teaching_attempts,
      hypothesis: p.hypothesis,
    })),
    strengths: learnerModel.strengths.slice(0, 5),
    engagement_profile: learnerModel.engagement_profile,
    next_step_plan: learnerModel.next_step_plan,
    diagnostic_mode: learnerModel.diagnostic_mode,
    confidence: learnerModel.confidence,
  };

  return `learner_model:
${JSON.stringify(compact, null, 2)}

requested_exercise_type: ${requestedExerciseType ?? 'auto'}
user_theme: ${userTheme ?? 'none'}
recent_modality_choices: ${JSON.stringify(recentModalityChoices ?? [])}

Produce the next briefing as a single JSON object per the schema.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Synthesize the next briefing for this learner.
 * Returns `null` when the Master is disabled or the call fails.
 *
 * `userId` is required to namespace the session cache. In anonymous
 * contexts pass a stable string (e.g. `'anon'`).
 */
export async function prescribe(
  userId: string,
  input: PrescribeInput,
): Promise<Briefing | null> {
  if (!masterEnabled()) return null;

  const key = cacheKey(userId, input.requestedExerciseType);
  const cached = briefingCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.briefing;
  }

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(systemPrompt, userMessage, undefined, briefingSchema);
  } catch (err) {
    console.warn('[Master.prescribe] LLM call failed, falling back to null:', err);
    return null;
  }

  const latencyMs = Date.now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.prescribe] Malformed JSON, discarding:', err);
    return null;
  }

  const briefing = coerceBriefing(parsed);
  if (!briefing) {
    console.warn('[Master.prescribe] Schema mismatch, discarding');
    return null;
  }

  // Forbid reusing the modality if caller constrained it.
  if (input.requestedExerciseType && briefing.modality_choice !== input.requestedExerciseType) {
    briefing.modality_choice = input.requestedExerciseType;
  }

  // Wave 6 Stage B — consolidation wave. While `next_step_plan.consolidation_until`
  // is in the future, pin target_skill to that pattern and vary contexts.
  const consolidationUntil = input.learnerModel.next_step_plan.consolidation_until;
  if (consolidationUntil) {
    const ts = Date.parse(consolidationUntil);
    if (Number.isFinite(ts) && ts > Date.now()) {
      briefing.target_skill = input.learnerModel.next_step_plan.primary_goal;
      briefing.rationale =
        (briefing.rationale ? briefing.rationale + ' ' : '') +
        `[consolidation_until=${consolidationUntil}] varying contexts for the same pattern.`;
    }
  }

  // Wave 6 Stage B — `hard_for_user` back-off. If the LLM chose a pattern
  // that's currently blacklisted with a future `next_retry_at`, fall back
  // to the next_step_plan.primary_goal (or leave it untouched if that is
  // also blacklisted — better to be honest than to thrash).
  const blacklisted = (input.learnerModel.hard_for_user ?? []).filter((e) => {
    const t = Date.parse(e.next_retry_at);
    return Number.isFinite(t) && t > Date.now();
  });
  if (blacklisted.some((e) => e.id === briefing.target_skill)) {
    const fallback = input.learnerModel.next_step_plan.primary_goal;
    if (fallback && !blacklisted.some((e) => e.id === fallback)) {
      briefing.target_skill = fallback;
      briefing.rationale =
        (briefing.rationale ? briefing.rationale + ' ' : '') +
        `[hard_for_user] rerouted away from blacklisted pattern.`;
    }
  }

  // Non-blocking telemetry.
  try {
    await recordMasterUsage({
      role: 'prescribe',
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.prescribe] telemetry failed (swallowed):', err);
  }

  briefingCache.set(key, { briefing, at: Date.now(), requestedExerciseType: input.requestedExerciseType });
  return briefing;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function coerceBriefing(raw: unknown): Briefing | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const modalityChoice = typeof r.modality_choice === 'string' ? r.modality_choice : '';
  if (!MODALITIES.includes(modalityChoice as Modality)) return null;

  const expectedDifficulty =
    typeof r.expected_difficulty === 'string' ? r.expected_difficulty : '';
  if (!['easy', 'slight_stretch', 'challenge'].includes(expectedDifficulty)) return null;

  const requiredElements = Array.isArray(r.required_elements)
    ? r.required_elements.filter((x): x is string => typeof x === 'string')
    : null;
  const forbiddenElements = Array.isArray(r.forbidden_elements)
    ? r.forbidden_elements.filter((x): x is string => typeof x === 'string')
    : null;
  if (!requiredElements || !forbiddenElements) return null;

  if (typeof r.target_skill !== 'string' || !r.target_skill) return null;
  if (typeof r.disguise_theme !== 'string') return null;
  if (typeof r.success_criteria !== 'string') return null;

  const briefing: Briefing = {
    target_skill: r.target_skill,
    secondary_skill: typeof r.secondary_skill === 'string' ? r.secondary_skill : undefined,
    modality_choice: modalityChoice as Modality,
    disguise_theme: r.disguise_theme,
    required_elements: requiredElements,
    forbidden_elements: forbiddenElements,
    success_criteria: r.success_criteria,
    expected_difficulty: expectedDifficulty as Briefing['expected_difficulty'],
    rationale: typeof r.rationale === 'string' ? r.rationale : undefined,
  };
  return briefing;
}

function estimateTokens(text: string): number {
  // Rough 4-chars-per-token heuristic; exact counts come from the edge function.
  return Math.max(1, Math.round(text.length / 4));
}
