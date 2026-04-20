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
}
