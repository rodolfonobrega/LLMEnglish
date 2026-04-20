/**
 * Modality router — Wave 5 (D-12).
 *
 * Maps a `Briefing.modality_choice` to the concrete URL the app should
 * navigate to. Today every modality resolves to a single pathname with
 * a mode query param (matching how `PracticeHubPage` already routes to
 * `ExercisesPage`); the router also returns an optional `state` hook
 * for callers that want to hand the briefing forward via React Router
 * navigation state.
 *
 * Keep this router dumb: modality → URL is a pure lookup. Any decision
 * about which modality to pick lives in `Master.prescribe`.
 */

import type { Briefing, Modality } from '../../types/master';

export interface RouteTarget {
  path: string;
  /** Optional state payload to pass via `navigate(path, { state })`. */
  state?: { briefing: Briefing };
}

const MODALITY_TO_PATH: Record<Modality, string> = {
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

/**
 * Resolve a briefing to the concrete target URL.
 * Unknown modalities fall back to the phrase exercise (always safe).
 */
export function routeModality(briefing: Briefing): RouteTarget {
  const path = MODALITY_TO_PATH[briefing.modality_choice] ?? MODALITY_TO_PATH.phrase;
  return { path, state: { briefing } };
}
