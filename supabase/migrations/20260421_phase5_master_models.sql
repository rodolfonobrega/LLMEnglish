-- =============================================================================
-- Master Integration — Phase 5 (Per-role Master model configuration)
--
-- Adds a JSONB column `master_models` to `model_config` so students can
-- configure a specific LLM model for each Master role (prescribe, evaluate,
-- update_model, compose_lesson, render_moment, live_meta, summarize_session,
-- vary_card). Roles without an entry inherit the main `chat_model`/
-- `chat_source` pair via `resolveMasterModel` (see
-- src/services/master/resolveMasterModel.ts).
--
-- Shape:
--   master_models JSONB NULL
--   = {
--       "prescribe":   { "model": "gemini-2.5-flash-lite", "source": "genai" },
--       "evaluate":    { "model": "gemini-2.5-flash",      "source": "genai" },
--       ...
--     }
--
-- Notes:
--   * Fully additive. Existing rows keep NULL → runtime falls back to chat.
--   * We deliberately do NOT validate the JSON shape in SQL. Validation lives
--     in `resolveMasterModel` (type-checked on the client) and the Settings UI
--     (`MasterModelSection.tsx`) only writes valid pairs. Garbage entries are
--     safely ignored by `isValidOverride(...)`.
--   * RLS policies already cover per-row access via `user_id`; the new column
--     inherits them — no policy changes needed.
-- =============================================================================

ALTER TABLE model_config
  ADD COLUMN IF NOT EXISTS master_models JSONB;

COMMENT ON COLUMN model_config.master_models IS
  'Phase 5: per-role Master model overrides. Shape: { [role]: { model, source } }. NULL = inherit chat_model/chat_source.';
