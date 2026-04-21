-- =============================================================================
-- Master Integration — Phase 9 (Review card variation)
--
-- Extends the `master_usage.role` CHECK constraint to accept the new role
-- introduced in Phase 9:
--
--   * 'vary_card' — generator for spaced-repetition review variants
--                   (see src/services/master/varyCard.ts). Each time
--                   `varyCard` produces an LLM-authored variant, a row
--                   with role='vary_card' is inserted into master_usage.
--
-- Notes:
--   * This migration is additive. All previously accepted roles remain
--     valid (matches 20260421_phase2_live_meta_roles.sql).
--   * The `recordMasterUsage` helper already swallows DB errors with a
--     warning, so running the app before this migration is applied is
--     safe — variants still work; telemetry rows are just dropped.
--   * No RLS changes, no data migration.
--   * `learner_model_history.source` is intentionally NOT extended here:
--     `varyCard` does not patch the LearnerModel directly — the
--     evaluation that follows the variant patches it via `runMasterPipeline`
--     using the existing 'evaluate' / 'update_model' sources.
-- =============================================================================

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
    'summarize_session',
    'vary_card'
  ));

COMMENT ON CONSTRAINT master_usage_role_check ON master_usage IS
  'Phase 9 adds vary_card (Review surface variant generator).';
