-- =============================================================================
-- Wave 2 — Canonical patterns + 5D scorecard migration
--
-- NON-DESTRUCTIVE, ADDITIVE ONLY.
-- Authored but NOT applied automatically. Apply via `supabase db push` or the
-- Supabase dashboard SQL editor when ready. Every change is idempotent so the
-- migration can be re-run safely.
--
-- Scope:
--  1. card_evaluations — store 5D scorecard, primary dimension, fluency stats,
--     and keep `corrections` shape backward compatible (JSONB array of either
--     legacy strings or new {tip, example, severity, canonical_pattern}
--     objects).
--  2. error_patterns — add an explicit `canonical_pattern` column indexed for
--     dashboard filtering; continue using `pattern_key` as the row id so we
--     don't break existing rows.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- card_evaluations: 5D + rich corrections
-- -----------------------------------------------------------------------------

-- `corrections` was TEXT[] originally; new rows want objects. We keep the
-- column typed as TEXT[] to stay backward compatible with existing inserts
-- (each element holds a JSON-serialised object) and add a parallel JSONB
-- column for new writes. Application code normalises both paths via
-- `normalizeCorrectionItem`.
ALTER TABLE card_evaluations
  ADD COLUMN IF NOT EXISTS corrections_json JSONB;

COMMENT ON COLUMN card_evaluations.corrections_json IS
  'Array of {tip, example?, severity?, canonical_pattern?}. New evaluations write here. Legacy rows keep using corrections TEXT[].';

ALTER TABLE card_evaluations
  ADD COLUMN IF NOT EXISTS scores5d JSONB;

COMMENT ON COLUMN card_evaluations.scores5d IS
  '5-dimensional scorecard: {naturalness, accuracy, fluency, pragmatics, completeness} — each 0-100 integer.';

ALTER TABLE card_evaluations
  ADD COLUMN IF NOT EXISTS primary_dimension TEXT
    CHECK (primary_dimension IS NULL OR primary_dimension IN (
      'naturalness','accuracy','fluency','pragmatics','completeness'
    ));

COMMENT ON COLUMN card_evaluations.primary_dimension IS
  'Single axis the tutor considers most impactful. NULL for legacy evaluations.';

ALTER TABLE card_evaluations
  ADD COLUMN IF NOT EXISTS fluency_stats JSONB;

COMMENT ON COLUMN card_evaluations.fluency_stats IS
  'Optional fluency metrics (e.g. {"wpm": 135}). Populated by narrative-style exercises in Wave 4.';

-- -----------------------------------------------------------------------------
-- error_patterns: canonical_pattern column + index
-- -----------------------------------------------------------------------------

ALTER TABLE error_patterns
  ADD COLUMN IF NOT EXISTS canonical_pattern TEXT;

COMMENT ON COLUMN error_patterns.canonical_pattern IS
  'Stable canonical pattern id (e.g. past_continuous_in_interrupted_narrative). May be NULL for legacy fallback patterns.';

CREATE INDEX IF NOT EXISTS idx_error_patterns_user_canonical
  ON error_patterns(user_id, canonical_pattern)
  WHERE canonical_pattern IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Optional: recompute `pattern_key` for legacy rows.
--
-- Intentionally NOT performed here. Existing rows keep their legacy
-- `pattern_key` so the dashboard continues to work; future writes use the
-- canonical id path in `errorAnalysis.ts`. A separate, manual backfill can be
-- run when the catalogue stabilises (Wave 5).
-- -----------------------------------------------------------------------------

-- End of Wave 2 migration.
