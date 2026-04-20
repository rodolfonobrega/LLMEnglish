/**
 * Master.compose_lesson — Wave 6 Stage B (F31c).
 *
 * Runs once at offer-acceptance. Given the updated LearnerModel and the
 * winning LessonCandidate, produces a LessonPlan that structures the
 * 12–18 minute focused session into five moments.
 *
 * Contract:
 *   - No-op (returns `null`) when the Master is disabled.
 *   - Calls chatCompletion with a schema-constrained prompt.
 *   - Thematic title is enforced by `lessonTitleIsThematic`; a malformed
 *     LLM output causes the helper to return `null` (the offer UI then
 *     falls back to an inline retry or abandons).
 *   - Records telemetry with `role: 'compose_lesson'`.
 *
 * The student never sees the briefing-level content; what they see is the
 * output of `renderMoment` for each moment in the plan.
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { cleanJson } from '../../utils/cleanJson';
import { lessonTitleIsThematic } from './stealthDetector';
import type { LearnerModel, LessonPlan, LessonMoment } from '../../types/learnerModel';
import type { LessonCandidate } from './lessonTriggers';

export interface ComposeLessonInput {
  learnerModel: LearnerModel;
  candidate: LessonCandidate;
}

const MOMENT_ROLES: readonly LessonMoment['role'][] = [
  'hook',
  'noticing',
  'controlled_practice',
  'free_production',
  'consolidation',
];

const lessonPlanSchema = {
  type: 'object' as const,
  properties: {
    title_thematic: {
      type: 'string' as const,
      description:
        'Short, natural-sounding thematic title. NEVER includes grammar labels (e.g. "past continuous"). Prefer concrete narrative hooks: "An interrupted Saturday morning".',
    },
    target_canonical_pattern: { type: 'string' as const },
    engagement_context: {
      type: 'object' as const,
      properties: {
        theme: { type: 'string' as const },
        tone_hint: { type: 'string' as const, enum: ['casual', 'balanced', 'formal'] },
      },
      required: ['theme'],
    },
    expected_difficulty_curve: {
      type: 'array' as const,
      items: { type: 'number' as const },
      description: 'Exactly 5 numbers in [0,1] describing the difficulty arc across moments.',
    },
    moments: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          index: { type: 'number' as const, enum: [1, 2, 3, 4, 5] },
          role: {
            type: 'string' as const,
            enum: MOMENT_ROLES as unknown as string[],
          },
          duration_minutes: { type: 'number' as const },
          adaptation_rules: { type: 'string' as const },
        },
        required: ['index', 'role', 'duration_minutes', 'adaptation_rules'],
      },
    },
  },
  required: [
    'title_thematic',
    'target_canonical_pattern',
    'engagement_context',
    'expected_difficulty_curve',
    'moments',
  ],
};

function buildSystemPrompt(): string {
  return `You are the Master, composing a 12–18 minute focused English lesson plan for a single learner. You output ONLY JSON matching the provided schema.

HARD CONSTRAINTS:
- The lesson has exactly 5 moments with roles in fixed order: hook, noticing, controlled_practice, free_production, consolidation.
- title_thematic MUST be natural and story-like. Grammar metalanguage is forbidden (no "past continuous", "phrasal verb", "grammar lesson", "gramática" etc.). Aim for scenes, feelings or situations.
- target_canonical_pattern MUST echo the caller's candidate pattern id verbatim.
- engagement_context.theme should match the learner's engagement_profile.themes_that_land when non-empty.
- adaptation_rules is internal notes for the moment renderer: what to do if the learner struggles, what a strong response looks like. Keep it one or two short sentences per moment.
- expected_difficulty_curve: 5 numbers in [0,1], generally rising then stabilising (e.g. [0.2, 0.4, 0.6, 0.7, 0.5]).
- Output strict JSON, no fences, no prose outside the object.`;
}

function buildUserMessage(input: ComposeLessonInput): string {
  const { learnerModel, candidate } = input;
  const compact = {
    cefr_estimate: learnerModel.cefr_estimate,
    engagement_profile: learnerModel.engagement_profile,
    chronic_errors: learnerModel.chronic_errors.slice(0, 5),
    acquiring_patterns: learnerModel.acquiring_patterns.slice(0, 5),
    next_step_plan: learnerModel.next_step_plan,
  };
  return `learner_model_compact:
${JSON.stringify(compact, null, 2)}

candidate:
${JSON.stringify(candidate, null, 2)}

Produce a single LessonPlan JSON object.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function composeLesson(
  input: ComposeLessonInput,
): Promise<LessonPlan | null> {
  if (!masterEnabled()) return null;

  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage(input);

  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(systemPrompt, userMessage, undefined, lessonPlanSchema);
  } catch (err) {
    console.warn('[Master.compose_lesson] LLM call failed:', err);
    return null;
  }
  const latencyMs = Date.now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.compose_lesson] Malformed JSON, discarding:', err);
    return null;
  }

  const plan = coerceLessonPlan(parsed, input.candidate.candidate_pattern);
  if (!plan) {
    console.warn('[Master.compose_lesson] Schema mismatch, discarding');
    return null;
  }
  if (!lessonTitleIsThematic(plan.title_thematic)) {
    console.warn('[Master.compose_lesson] title failed stealth check, discarding');
    return null;
  }

  try {
    await recordMasterUsage({
      role: 'compose_lesson',
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.compose_lesson] telemetry failed (swallowed):', err);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function coerceLessonPlan(
  raw: unknown,
  expectedTarget: string,
): LessonPlan | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.title_thematic !== 'string' || !r.title_thematic.trim()) return null;
  if (typeof r.target_canonical_pattern !== 'string' || !r.target_canonical_pattern) return null;
  if (r.target_canonical_pattern !== expectedTarget) return null;

  const engagementRaw = r.engagement_context;
  if (typeof engagementRaw !== 'object' || engagementRaw === null) return null;
  const eng = engagementRaw as Record<string, unknown>;
  if (typeof eng.theme !== 'string' || !eng.theme) return null;
  const toneHint =
    typeof eng.tone_hint === 'string' &&
    ['casual', 'balanced', 'formal'].includes(eng.tone_hint)
      ? (eng.tone_hint as 'casual' | 'balanced' | 'formal')
      : undefined;

  const curveRaw = r.expected_difficulty_curve;
  if (!Array.isArray(curveRaw) || curveRaw.length !== 5) return null;
  const curve = curveRaw
    .map((n) => (typeof n === 'number' ? n : NaN))
    .map((n) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : NaN));
  if (curve.some((n) => Number.isNaN(n))) return null;

  const momentsRaw = r.moments;
  if (!Array.isArray(momentsRaw) || momentsRaw.length !== 5) return null;
  const moments: LessonMoment[] = [];
  for (let i = 0; i < 5; i++) {
    const m = momentsRaw[i];
    if (typeof m !== 'object' || m === null) return null;
    const mr = m as Record<string, unknown>;
    const expectedIndex = (i + 1) as LessonMoment['index'];
    if (mr.index !== expectedIndex) return null;
    const role = typeof mr.role === 'string' ? (mr.role as LessonMoment['role']) : null;
    if (!role || !MOMENT_ROLES.includes(role)) return null;
    if (MOMENT_ROLES[i] !== role) return null;
    if (typeof mr.duration_minutes !== 'number') return null;
    if (typeof mr.adaptation_rules !== 'string') return null;
    moments.push({
      index: expectedIndex,
      role,
      duration_minutes: Math.max(1, Math.min(10, mr.duration_minutes)),
      adaptation_rules: mr.adaptation_rules,
    });
  }

  const total = moments.reduce((acc, m) => acc + m.duration_minutes, 0);
  if (total < 8 || total > 22) return null;

  return {
    title_thematic: r.title_thematic.trim(),
    target_canonical_pattern: r.target_canonical_pattern,
    moments,
    engagement_context: { theme: eng.theme, tone_hint: toneHint },
    expected_difficulty_curve: curve,
  };
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
