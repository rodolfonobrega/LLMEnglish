-- =============================================================================
-- Master Integration — Phase 2 (Live & Paths)
--
-- This migration extends the CHECK constraints from
-- `20260420_wave3_learner_model_and_telemetry.sql` so that:
--
--   * `master_usage.role` accepts the new roles introduced in Phase 2:
--       - 'live_meta'          — post-conversation Live evaluator
--                                (masterEvaluateLive, Phase 2 F-P2-01c)
--       - 'summarize_session'  — Phase 3 session summariser
--                                (added here pre-emptively because Phase 3
--                                 migration lives in its own file; having
--                                 the enum accept it now avoids a
--                                 "invalid role" error if Phase 3 rolls
--                                 out before its own migration)
--
--   * `learner_model_history.source` accepts 'live_meta' so that patches
--     emitted by the Live pipeline carry a distinct provenance instead of
--     being coerced to 'update_model' (see src/services/learnerModel.ts
--     `savePatchedModel` for the current coercion fallback).
--
-- Notes:
--   * The enum is implemented as a CHECK constraint (not a Postgres enum
--     type), so we simply DROP and re-add it. This matches the original
--     style used in the Wave 3 migration.
--   * Existing rows are unaffected — the new values are supersets of the
--     previous set.
--   * No RLS changes. No data migration.
--   * Once this migration is applied in production the fallback logic in
--     `savePatchedModel` can be removed (a follow-up code-only change).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- master_usage.role — add 'live_meta' and 'summarize_session'
-- -----------------------------------------------------------------------------

ALTER TABLE master_usage
  DROP CONSTRAINT IF EXISTS master_usage_role_check;

ALTER TABLE master_usage
  ADD CONSTRAINT master_usage_role_check
  CHECK (role IN (
    'prescribe',
    'evaluate',
    'update_model',
    'compose_lesson',
    'render_moment',
    'live_meta',
    'summarize_session'
  ));

COMMENT ON CONSTRAINT master_usage_role_check ON master_usage IS
  'Phase 2 adds live_meta (post-Live evaluator) and pre-registers summarize_session (Phase 3).';

-- -----------------------------------------------------------------------------
-- learner_model_history.source — add 'live_meta'
-- -----------------------------------------------------------------------------

ALTER TABLE learner_model_history
  DROP CONSTRAINT IF EXISTS learner_model_history_source_check;

ALTER TABLE learner_model_history
  ADD CONSTRAINT learner_model_history_source_check
  CHECK (source IN (
    'evaluate',
    'update_model',
    'reset',
    'lesson_boost',
    'live_meta'
  ));

COMMENT ON CONSTRAINT learner_model_history_source_check ON learner_model_history IS
  'Phase 2 adds live_meta so Live pipeline patches keep their provenance.';
