/**
 * Master.render_moment — Wave 6 Stage B (F31d).
 *
 * Renders the concrete content of one lesson moment (1..5) from a
 * LessonPlan. Each moment has a distinct kind of payload; see the
 * `MomentContent` union in `src/types/learnerModel.ts`.
 *
 * Contract:
 *   - No-op (returns `null`) when Master disabled.
 *   - Calls chatCompletion with a per-moment schema.
 *   - Moments 1..4 are checked by `momentIsStealth`; failing content is
 *     discarded (caller can retry once or abort). Moment 5 is the reveal
 *     and is explicitly allowed to contain pedagogical labels.
 *   - Records telemetry with `role: 'render_moment'`.
 */

import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { cleanJson } from '../../utils/cleanJson';
import { momentIsStealth } from './stealthDetector';
import type {
  LessonPlan,
  LessonMoment,
  MomentContent,
  MomentSignal,
} from '../../types/learnerModel';

export interface RenderMomentInput {
  lessonPlan: LessonPlan;
  momentIndex: 1 | 2 | 3 | 4 | 5;
  /** Signal from the previous moment, if any. Drives adaptation. */
  previousSignal?: MomentSignal;
}

const CONTROLLED_PRACTICE_MODALITIES = [
  'oral_cloze',
  'error_spotting',
  'reaction_drill',
  'active_shadowing',
] as const;

const FREE_PRODUCTION_MODALITIES = ['narrative', 'live_roleplay_short'] as const;

// ---------------------------------------------------------------------------
// Schemas (per-kind)
// ---------------------------------------------------------------------------

const schemas: Record<LessonMoment['role'], Record<string, unknown>> = {
  hook: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const, enum: ['hook'] },
      portuguese_opener: { type: 'string' as const },
      expected_target_usage_hint: { type: 'string' as const },
    },
    required: ['kind', 'portuguese_opener', 'expected_target_usage_hint'],
  },
  noticing: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const, enum: ['noticing'] },
      pairs: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            a: { type: 'string' as const },
            b: { type: 'string' as const },
            portuguese_question: { type: 'string' as const },
          },
          required: ['a', 'b', 'portuguese_question'],
        },
      },
    },
    required: ['kind', 'pairs'],
  },
  controlled_practice: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const, enum: ['controlled_practice'] },
      rounds: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            modality: {
              type: 'string' as const,
              enum: CONTROLLED_PRACTICE_MODALITIES as unknown as string[],
            },
            payload: { type: 'object' as const },
          },
          required: ['modality', 'payload'],
        },
      },
    },
    required: ['kind', 'rounds'],
  },
  free_production: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const, enum: ['free_production'] },
      modality: {
        type: 'string' as const,
        enum: FREE_PRODUCTION_MODALITIES as unknown as string[],
      },
      seed: { type: 'string' as const },
    },
    required: ['kind', 'modality', 'seed'],
  },
  consolidation: {
    type: 'object' as const,
    properties: {
      kind: { type: 'string' as const, enum: ['consolidation'] },
      callback_prompt_pt: { type: 'string' as const },
      reveal_copy_pt: { type: 'string' as const },
    },
    required: ['kind', 'callback_prompt_pt', 'reveal_copy_pt'],
  },
};

function buildSystemPrompt(role: LessonMoment['role']): string {
  const header = `You are the Master, rendering moment ${role} of a focused English lesson. Output ONLY JSON matching the schema.`;
  const stealth = `CRITICAL: student-facing copy MUST NOT mention grammar metalanguage ("past continuous", "phrasal verb", "gramática", etc.) except in the "consolidation" moment, which IS the reveal.`;
  const perRole: Record<LessonMoment['role'], string> = {
    hook: `Produce a one-sentence Portuguese opener that invites the student to tell a small story on the lesson's theme. expected_target_usage_hint is an internal note about what you expect them to produce naturally (not shown to them).`,
    noticing: `Produce 2–3 minimal pairs of English sentences (a/b) that contrast the target pattern in action. portuguese_question is a Portuguese prompt that helps the student notice the difference WITHOUT naming the grammar (e.g. "Qual das duas soa mais natural quando a ação estava em andamento?").`,
    controlled_practice: `Produce 2–3 rounds, each choosing a drill modality from [oral_cloze, error_spotting, reaction_drill, active_shadowing]. Each round's "payload" is an object that the corresponding drill component already knows how to render; keep fields minimal and generic (text, options, target, etc.). No grammar labels in the payload.`,
    free_production: `Pick one of [narrative, live_roleplay_short]. "seed" is the Portuguese/English seed prompt the student reads before speaking.`,
    consolidation: `Produce a callback prompt referring back to the hook, and a reveal_copy_pt string. The reveal IS allowed to name the grammar (one short sentence like "Nesta aula você praticou o passado contínuo em contextos de narrativa interrompida.") so the student walks away knowing what they did.`,
  };
  return `${header}\n\n${stealth}\n\n${perRole[role]}\n\nNo prose outside the JSON object.`;
}

function buildUserMessage(input: RenderMomentInput, role: LessonMoment['role']): string {
  const { lessonPlan, momentIndex, previousSignal } = input;
  const moment = lessonPlan.moments[momentIndex - 1];
  return `lesson_context:
${JSON.stringify(
  {
    title_thematic: lessonPlan.title_thematic,
    target_canonical_pattern: lessonPlan.target_canonical_pattern,
    engagement_context: lessonPlan.engagement_context,
    moment_role: role,
    moment_adaptation_rules: moment?.adaptation_rules ?? '',
    expected_difficulty: lessonPlan.expected_difficulty_curve[momentIndex - 1] ?? null,
  },
  null,
  2,
)}

${previousSignal ? `previous_moment_signal:\n${JSON.stringify(previousSignal, null, 2)}\n\n` : ''}Produce a single MomentContent JSON object.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function renderMoment(
  input: RenderMomentInput,
): Promise<MomentContent | null> {
  if (!masterEnabled()) return null;

  const moment = input.lessonPlan.moments[input.momentIndex - 1];
  if (!moment) return null;

  const systemPrompt = buildSystemPrompt(moment.role);
  const userMessage = buildUserMessage(input, moment.role);
  const schema = schemas[moment.role];

  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(systemPrompt, userMessage, undefined, schema);
  } catch (err) {
    console.warn('[Master.render_moment] LLM call failed:', err);
    return null;
  }
  const latencyMs = Date.now() - started;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.render_moment] Malformed JSON, discarding:', err);
    return null;
  }

  const content = coerceMomentContent(parsed, moment.role);
  if (!content) {
    console.warn('[Master.render_moment] Schema mismatch, discarding');
    return null;
  }

  if (!momentIsStealth({ index: input.momentIndex, studentFacingText: collectStudentText(content) })) {
    console.warn('[Master.render_moment] stealth check failed, discarding');
    return null;
  }

  try {
    await recordMasterUsage({
      role: 'render_moment',
      latencyMs,
      tokensIn: estimateTokens(systemPrompt + userMessage),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.render_moment] telemetry failed (swallowed):', err);
  }

  return content;
}

// ---------------------------------------------------------------------------
// Helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Flatten all student-facing strings of a MomentContent into a single
 * blob so the stealth detector can inspect them. For moment 5 this
 * includes the reveal; callers get an allowlist via `momentIsStealth`.
 */
export function collectStudentText(content: MomentContent): string {
  switch (content.kind) {
    case 'hook':
      return `${content.portuguese_opener}\n${content.expected_target_usage_hint}`;
    case 'noticing':
      return content.pairs
        .map((p) => `${p.a}\n${p.b}\n${p.portuguese_question}`)
        .join('\n');
    case 'controlled_practice':
      return content.rounds
        .map((r) => (typeof r.payload === 'object' ? JSON.stringify(r.payload) : String(r.payload ?? '')))
        .join('\n');
    case 'free_production':
      return content.seed;
    case 'consolidation':
      return `${content.callback_prompt_pt}\n${content.reveal_copy_pt}`;
  }
}

export function coerceMomentContent(
  raw: unknown,
  expectedRole: LessonMoment['role'],
): MomentContent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const kindMap: Record<LessonMoment['role'], MomentContent['kind']> = {
    hook: 'hook',
    noticing: 'noticing',
    controlled_practice: 'controlled_practice',
    free_production: 'free_production',
    consolidation: 'consolidation',
  };
  const expectedKind = kindMap[expectedRole];
  if (r.kind !== expectedKind) return null;

  switch (expectedKind) {
    case 'hook':
      if (typeof r.portuguese_opener !== 'string' || !r.portuguese_opener) return null;
      if (typeof r.expected_target_usage_hint !== 'string') return null;
      return {
        kind: 'hook',
        portuguese_opener: r.portuguese_opener,
        expected_target_usage_hint: r.expected_target_usage_hint,
      };
    case 'noticing': {
      if (!Array.isArray(r.pairs) || r.pairs.length < 2 || r.pairs.length > 4) return null;
      const pairs: Array<{ a: string; b: string; portuguese_question: string }> = [];
      for (const p of r.pairs) {
        if (typeof p !== 'object' || p === null) return null;
        const pr = p as Record<string, unknown>;
        if (typeof pr.a !== 'string' || !pr.a) return null;
        if (typeof pr.b !== 'string' || !pr.b) return null;
        if (typeof pr.portuguese_question !== 'string' || !pr.portuguese_question) return null;
        pairs.push({ a: pr.a, b: pr.b, portuguese_question: pr.portuguese_question });
      }
      return { kind: 'noticing', pairs };
    }
    case 'controlled_practice': {
      if (!Array.isArray(r.rounds) || r.rounds.length < 1 || r.rounds.length > 4) return null;
      const rounds: Array<{
        modality: (typeof CONTROLLED_PRACTICE_MODALITIES)[number];
        payload: unknown;
      }> = [];
      for (const roundRaw of r.rounds) {
        if (typeof roundRaw !== 'object' || roundRaw === null) return null;
        const rr = roundRaw as Record<string, unknown>;
        if (
          typeof rr.modality !== 'string' ||
          !(CONTROLLED_PRACTICE_MODALITIES as readonly string[]).includes(rr.modality)
        ) {
          return null;
        }
        if (typeof rr.payload !== 'object' || rr.payload === null) return null;
        rounds.push({
          modality: rr.modality as (typeof CONTROLLED_PRACTICE_MODALITIES)[number],
          payload: rr.payload,
        });
      }
      return { kind: 'controlled_practice', rounds };
    }
    case 'free_production':
      if (
        typeof r.modality !== 'string' ||
        !(FREE_PRODUCTION_MODALITIES as readonly string[]).includes(r.modality)
      ) {
        return null;
      }
      if (typeof r.seed !== 'string' || !r.seed) return null;
      return {
        kind: 'free_production',
        modality: r.modality as (typeof FREE_PRODUCTION_MODALITIES)[number],
        seed: r.seed,
      };
    case 'consolidation':
      if (typeof r.callback_prompt_pt !== 'string' || !r.callback_prompt_pt) return null;
      if (typeof r.reveal_copy_pt !== 'string' || !r.reveal_copy_pt) return null;
      return {
        kind: 'consolidation',
        callback_prompt_pt: r.callback_prompt_pt,
        reveal_copy_pt: r.reveal_copy_pt,
      };
  }
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
