/**
 * Master agent shared types — the `Briefing` contract that flows from
 * `Master.prescribe` (Wave 5) down to exercise generators.
 *
 * Wave 4 introduces this type so that new exercise components can accept
 * an optional `briefing?: Briefing` prop as plumbing. The prop is ignored
 * in Wave 4; Wave 5 wires the consumers.
 */

import type { CanonicalPatternId } from './card';

/**
 * Modality identifier that a Briefing targets. Kept as a string union rather
 * than an enum so it can be serialised 1:1 in JSON and safely compared to
 * route ids in `modalityRouter.ts`.
 */
export type Modality =
  | 'phrase'
  | 'text'
  | 'roleplay'
  | 'visual'
  | 'cloze'
  | 'spotting'
  | 'reaction'
  | 'shadowing'
  | 'reformulation'
  | 'narrative'
  | 'listening'
  | 'live';

export type ExpectedDifficulty = 'easy' | 'slight_stretch' | 'challenge';

/**
 * Phase 2 (F-P2-05) — When `modality_choice === 'live'`, this hint tells
 * the Live surface whether the Master wants a short, high-frequency
 * touch-point (`mini`, ~3-4 turns) or a full session (`standard`).
 * Default prescription is `mini` because the Master philosophy is
 * "many small lives, not few big ones".
 */
export type SessionSize = 'standard' | 'mini';

/**
 * A prescriptive plan emitted by `Master.prescribe` for a single session.
 *
 * Contract notes:
 * - `target_skill` / `secondary_skill` are opaque strings in practice but
 *   will usually be a canonical pattern id.
 * - `required_elements` / `forbidden_elements` are phrased as *outcome*
 *   constraints for the generator, never as pedagogical labels shown to
 *   the student (stealth curriculum — see design doc §5.7).
 * - Generators must treat the briefing as additional constraints; the
 *   disguise_theme decides the surface topic.
 */
export interface Briefing {
  target_skill: CanonicalPatternId | string;
  secondary_skill?: CanonicalPatternId | string;
  modality_choice: Modality;
  disguise_theme: string;
  required_elements: string[];
  forbidden_elements: string[];
  success_criteria: string;
  expected_difficulty: ExpectedDifficulty;
  rationale?: string;
  /**
   * Phase 2 (F-P2-05) — only meaningful when `modality_choice === 'live'`.
   * Absent briefings default to `'mini'` at the Live surface.
   */
  session_size?: SessionSize;
  /**
   * Phase 8 (F-P8-02) — when a `SessionIntent` shaped the briefing, we
   * write a one-line description of the blending decision here so the
   * behaviour is auditable ("threaded target X into theme Y requested
   * by student"). Never shown to the student.
   */
  blend_rationale?: string;
  /**
   * Phase 8 (F-P8-04) — `true` when the briefing was requested under
   * "quick practice" mode. Generators should bias toward shorter output
   * (fewer phrases, 1-turn cloze, etc.) and skip ancillary prompts.
   */
  quick_practice?: boolean;
}

/**
 * Phase 8 (F-P8-01) — student-declared intent for the current session.
 *
 * All fields are optional. A `SessionIntent` without any `requested_*`
 * field is indistinguishable from "no intent" and is treated as absent
 * by `prescribe`. The Master blends these preferences per the
 * hard-vs-soft priority hierarchy (F-P8-02):
 *
 *   - Hard pins (100% respected): `requested_vocabulary`,
 *     `requested_modality`, `review_focus`.
 *   - Soft preferences (constraints): `requested_theme`,
 *     `requested_pattern`, `requested_difficulty`.
 *
 * `declared_at` / `expires_at` bound the intent's lifetime. When the
 * clock passes `expires_at`, the store drops the intent silently.
 */
export interface SessionIntent {
  /** Theme the student asked for in free text. Soft preference. */
  requested_theme?: string;
  /** Vocabulary the student wants practiced. Hard pin. */
  requested_vocabulary?: string[];
  /** Canonical pattern id (or free-text hint) the student wants to drill. */
  requested_pattern?: CanonicalPatternId | string;
  /** Modality the student pinned for the session. Hard pin. */
  requested_modality?: Modality;
  /** Difficulty bias the student asked for. Soft. */
  requested_difficulty?: 'easier' | 'normal' | 'harder';
  /** Specific card ids the student wants resurfaced (Library pins). */
  review_focus?: string[];
  /** ISO timestamp when the intent was declared. */
  declared_at: string;
  /** ISO timestamp after which the intent is discarded. Omitted = end of session. */
  expires_at?: string;
  /** Optional free-text note the student typed when declaring the intent. */
  note?: string;
  /**
   * F-P8-04 — when true, the Master silences all proactive nudges this
   * session: no LessonOfferCard, no reflections, no cross-surface
   * suggestions. Prescribe still runs when the student explicitly
   * invokes it.
   */
  quick_practice?: boolean;
}
