/**
 * Contextual tone resolution.
 *
 * The global user tone preference (`casual | balanced | formal`) is stored on
 * the profile, but many contexts (live roleplay with a scripted character,
 * translation cards that already encode their own register, and future
 * Master-generated lessons) SHOULD override that preference so that the
 * evaluator and the generator see the register the CONTENT actually demands,
 * not the one the user happened to pick in Settings.
 *
 * The global tone remains the default; this resolver lets callers layer a
 * stronger contextual signal on top.
 */

import type { ConversationTone } from '../types/settings';
import type { Card } from '../types/card';
import { getConversationTone } from './runtimeConfigSnapshot';

export type ToneContextKind =
  | 'solo-phrase'
  | 'solo-text'
  | 'solo-roleplay'
  | 'live-roleplay'
  | 'image'
  | 'review'
  | 'lesson'
  | 'drill';

export interface ToneContext {
  kind: ToneContextKind;
  /** Optional explicit override (e.g. a roleplay character with a scripted tone). */
  override?: ConversationTone;
  /** The card being evaluated, if any. Used for heuristics. */
  card?: Pick<Card, 'type' | 'context' | 'theme'> | null;
  /**
   * Cues lifted from the content itself (e.g. a live-roleplay character's
   * speech style, a lesson's register). Treated as HINTS, not hard overrides.
   */
  contentHints?: string[];
}

const FORMAL_HINTS = [
  'formal', 'business', 'corporate', 'meeting', 'interview', 'court', 'academic',
  'policia', 'police', 'official', 'presentation', 'ceo', 'director', 'diretor',
  'contract', 'legal', 'paper', 'report', 'audience', 'apresentação',
];

const CASUAL_HINTS = [
  'casual', 'friend', 'amigo', 'amiga', 'bar', 'pub', 'festa', 'party',
  'family', 'familia', 'roommate', 'buddy', 'mate', 'chill', 'relaxed',
  'beach', 'game night', 'chat', 'dm',
];

function matchesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/**
 * Resolve the tone that should govern generation + evaluation in `context`.
 *
 * Priority:
 *   1. `context.override` — explicit caller intent (e.g. live roleplay scripted tone).
 *   2. Content hints (`contentHints`, plus `card.context` / `card.theme` keywords).
 *   3. Card type heuristic (image/roleplay lean casual; text leans balanced).
 *   4. Global user preference from the runtime snapshot.
 */
export function resolveContextualTone(context: ToneContext): ConversationTone {
  if (context.override) {
    return context.override;
  }

  const hintsBlob = [
    ...(context.contentHints ?? []),
    context.card?.context ?? '',
    context.card?.theme ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (hintsBlob) {
    if (matchesAny(hintsBlob, FORMAL_HINTS)) return 'formal';
    if (matchesAny(hintsBlob, CASUAL_HINTS)) return 'casual';
  }

  // Card-type bias is SOFT — only kicks in if we have no hints and no override.
  const global = getConversationTone();
  if (context.card?.type === 'roleplay' && global === 'balanced') return 'casual';
  if (context.card?.type === 'image' && global === 'balanced') return 'casual';

  return global;
}
