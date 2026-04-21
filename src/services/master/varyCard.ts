/**
 * Master.varyCard — Phase 9 (F-P9-02).
 *
 * Produces a *variant* of an existing spaced-repetition card that:
 *  - preserves the card's target canonical pattern,
 *  - preserves the card's type (phrase / text / roleplay / image),
 *  - swaps the surface (theme, verbs, specifics) so the student
 *    practices **transfer** instead of memorising the exact prompt.
 *
 * This is what makes Review actually pedagogical. SM-2 alone re-shows
 * the identical card and counts "remembered this sentence" as mastery.
 * Phase 7's gate explicitly requires evidence across themes — `varyCard`
 * is what generates that evidence from the Review surface.
 *
 * Soft-fail contract (intentional):
 *  - When `masterEnabled()` is false, when the card has no canonical
 *    pattern, or when the LLM output is malformed, we return the
 *    ORIGINAL prompt with `source: 'original'`. Never block Review.
 *  - Diversity guard, stealth check and theme exclusion happen
 *    deterministically AFTER the LLM call, not via retries — a
 *    mis-behaving LLM is caught locally and falls back to the
 *    original prompt rather than thrashing.
 */

import type { Card, VariationLineageEntry } from '../../types/card';
import type { LearnerModel } from '../../types/learnerModel';
import {
  cardVariationResponseSchema,
  getCardVariationPrompt,
} from '../../utils/prompts';
import { cleanJson } from '../../utils/cleanJson';
import { chatCompletion } from '../openai';
import { masterEnabled } from '../runtimeConfigSnapshot';
import { recordMasterUsage } from '../masterTelemetry';
import { resolveMasterModel } from './resolveMasterModel';
import { containsPedagogicalLeak } from './stealthDetector';

export interface VaryCardResult {
  /** The prompt the student should see right now. */
  prompt: string;
  /** Optional extra situation framing (e.g. roleplay context). */
  context?: string;
  /** Theme of the variant (lowercase, single token). */
  theme: string;
  /** Core English verbs expected; informational, never shown to student. */
  verbs: string[];
  /** Where this variant came from, for observability and tests. */
  source: 'original' | 'llm' | 'fallback';
  /** Appended to `card.variation_lineage` by the caller. */
  lineageEntry: VariationLineageEntry;
  /** Optional human-readable reason (diagnostic only). */
  reason?: string;
}

export interface VaryCardInput {
  card: Card;
  learnerModel: LearnerModel;
}

/**
 * Lineage window size used by the diversity guard. Keeps the check
 * cheap and bounded even for cards reviewed dozens of times.
 */
const LINEAGE_WINDOW = 3;

/**
 * Entry point. See file header for the soft-fail contract.
 */
export async function varyCard(input: VaryCardInput): Promise<VaryCardResult> {
  const { card, learnerModel } = input;

  if (card.pin_to_original) {
    return buildOriginalResult(card, 'Card is explicitly pinned to its original prompt.');
  }
  if (!masterEnabled()) {
    return buildOriginalResult(card, 'Master disabled — reusing original prompt.');
  }
  if (!card.canonical_pattern) {
    return buildOriginalResult(card, 'Card has no canonical_pattern — cannot vary safely.');
  }

  const themesToAvoid = computeThemesToAvoid(card, learnerModel);
  const verbsUsedRecently = computeVerbsUsedRecently(card);

  const promptInput = {
    card: {
      id: card.id,
      type: card.type,
      prompt: card.prompt,
      original_prompt: card.original_prompt ?? card.prompt,
      canonical_pattern: card.canonical_pattern,
      theme: card.theme,
      targetVocabulary: card.targetVocabulary,
    },
    learnerModel: {
      cefr_estimate: learnerModel.cefr_estimate.level,
      themes_that_land: learnerModel.engagement_profile?.themes_that_land ?? [],
      themes_in_live_window: learnerModel.live_fluency_profile?.themes_in_window ?? [],
      mastered_patterns: learnerModel.mastered_patterns.slice(0, 10),
    },
    themesToAvoid,
    verbsUsedRecently,
  };

  const { system, user } = getCardVariationPrompt(promptInput);

  const resolved = resolveMasterModel('vary_card');
  const started = Date.now();
  let raw: string;
  try {
    raw = await chatCompletion(
      system,
      user,
      { model: resolved.model, source: resolved.source },
      cardVariationResponseSchema,
    );
  } catch (err) {
    console.warn('[Master.varyCard] LLM call failed:', err);
    return buildOriginalResult(card, 'LLM call failed; reusing original prompt.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn('[Master.varyCard] Malformed JSON:', err);
    return buildOriginalResult(card, 'LLM returned malformed JSON; reusing original.');
  }

  const coerced = coerceVariation(parsed);
  if (!coerced) {
    return buildOriginalResult(card, 'LLM output did not match schema; reusing original.');
  }

  // Diversity guard (F-P9-04) — deterministic.
  const themeOk = !themesToAvoid.includes(coerced.theme);
  const leak = containsPedagogicalLeak(coerced.prompt);
  if (!themeOk || leak) {
    const reason = !themeOk
      ? `Variant used banned theme "${coerced.theme}" (themesToAvoid=${themesToAvoid.join(',')}); falling back.`
      : 'Variant leaked pedagogical vocabulary; falling back.';
    console.warn('[Master.varyCard] diversity/stealth guard tripped:', reason);
    return buildOriginalResult(card, reason);
  }

  const latencyMs = Date.now() - started;
  try {
    await recordMasterUsage({
      role: 'vary_card',
      model: resolved.model,
      latencyMs,
      tokensIn: estimateTokens(system + user),
      tokensOut: estimateTokens(raw),
    });
  } catch (err) {
    console.warn('[Master.varyCard] telemetry failed (swallowed):', err);
  }

  const lineageEntry: VariationLineageEntry = {
    prompt: coerced.prompt,
    context: coerced.context,
    theme: coerced.theme,
    verbs: coerced.verbs,
    shown_at: new Date().toISOString(),
    reason: 'llm_variant',
  };

  return {
    prompt: coerced.prompt,
    context: coerced.context,
    theme: coerced.theme,
    verbs: coerced.verbs,
    source: 'llm',
    lineageEntry,
  };
}

/**
 * Compute the list of themes the variant MUST avoid. Combines:
 *   - the card's current `theme`,
 *   - the last `LINEAGE_WINDOW` themes from `variation_lineage`,
 *   - the themes that already dominate the student's Live window
 *     (so Phase 7's theme-variety gate isn't defeated by the Review
 *     surface flooding the student with one theme),
 *   - if the card has a `theme` at all, its normalised form.
 */
export function computeThemesToAvoid(card: Card, learnerModel: LearnerModel): string[] {
  const out = new Set<string>();
  if (card.theme) out.add(normalise(card.theme));
  const lineage = card.variation_lineage ?? [];
  for (const entry of lineage.slice(-LINEAGE_WINDOW)) {
    if (entry.theme) out.add(normalise(entry.theme));
  }
  const live = learnerModel.live_fluency_profile?.themes_in_window ?? [];
  for (const t of live) {
    if (!t) continue;
    out.add(normalise(t));
  }
  out.delete('');
  return [...out];
}

/**
 * Collect verbs used by the student on the last variant attempt.
 * Informational to the LLM — by telling it which verbs the student
 * already used, we nudge the variant toward a different set without
 * forcing it deterministically (verb variation is a soft guard).
 */
export function computeVerbsUsedRecently(card: Card): string[] {
  const lineage = card.variation_lineage ?? [];
  if (lineage.length === 0) return [];
  const latest = lineage[lineage.length - 1];
  return (latest?.verbs ?? []).map((v) => v.toLowerCase()).filter(Boolean);
}

/**
 * Public helper for the ReviewPage to append the lineage entry to the
 * card before persisting. Bounded at 10 entries — older variants are
 * dropped (we still have `original_prompt` as the anchor).
 */
export function appendLineage(card: Card, entry: VariationLineageEntry): Card {
  const previous = card.variation_lineage ?? [];
  const updated = [...previous, entry].slice(-10);
  return {
    ...card,
    variation_lineage: updated,
    original_prompt: card.original_prompt ?? card.prompt,
  };
}

function buildOriginalResult(card: Card, reason: string): VaryCardResult {
  const theme = normalise(card.theme ?? 'general');
  const lineageEntry: VariationLineageEntry = {
    prompt: card.prompt,
    context: card.context,
    theme,
    shown_at: new Date().toISOString(),
    reason,
  };
  return {
    prompt: card.prompt,
    context: card.context,
    theme,
    verbs: [],
    source: 'original',
    lineageEntry,
    reason,
  };
}

interface RawVariation {
  prompt: string;
  context?: string;
  theme: string;
  verbs: string[];
}

function coerceVariation(raw: unknown): RawVariation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const prompt = typeof r.prompt === 'string' ? r.prompt.trim() : '';
  if (!prompt) return null;
  const theme = typeof r.theme === 'string' ? normalise(r.theme) : '';
  if (!theme) return null;
  const verbsRaw = Array.isArray(r.verbs) ? r.verbs : [];
  const verbs: string[] = [];
  for (const v of verbsRaw) {
    if (typeof v !== 'string') continue;
    const n = v.trim().toLowerCase();
    if (n) verbs.push(n);
  }
  const context = typeof r.context === 'string' && r.context.trim() ? r.context.trim() : undefined;
  return { prompt, context, theme, verbs };
}

function normalise(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}
