-- =============================================================================
-- Wave 3 — Learner model, patch history, Master telemetry, feature flag
--
-- NON-DESTRUCTIVE, ADDITIVE ONLY.
-- Authored but NOT applied automatically. Apply via `supabase db push` or the
-- Supabase dashboard SQL editor when ready. Every change is idempotent so the
-- migration can be re-run safely.
--
-- Tables:
--   * learner_models          — per-user pedagogical portrait (JSONB).
--   * learner_model_history   — append-only audit of every patch applied.
--   * master_usage            — per-call telemetry (tokens + latency).
-- Column:
--   * profiles.master_enabled — per-user feature override.
--
-- RLS: each table restricts access to the owning user. `learner_model_history`
-- denies UPDATE/DELETE so the audit trail cannot be tampered with.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- learner_models
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS learner_models (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  model      JSONB NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE learner_models IS
  'Per-user pedagogical portrait maintained by the Master. One row per user.';

ALTER TABLE learner_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learner model" ON learner_models;
CREATE POLICY "Users can view own learner model"
  ON learner_models FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own learner model" ON learner_models;
CREATE POLICY "Users can insert own learner model"
  ON learner_models FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own learner model" ON learner_models;
CREATE POLICY "Users can update own learner model"
  ON learner_models FOR UPDATE
  USING (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- learner_model_history
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS learner_model_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patch_ops  JSONB NOT NULL,
  reason     TEXT,
  source     TEXT CHECK (source IN ('evaluate', 'update_model', 'reset', 'lesson_boost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE learner_model_history IS
  'Append-only audit trail of every patch applied to a learner_models row. UPDATE/DELETE denied by RLS.';

ALTER TABLE learner_model_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own learner history" ON learner_model_history;
CREATE POLICY "Users can view own learner history"
  ON learner_model_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own learner history" ON learner_model_history;
CREATE POLICY "Users can insert own learner history"
  ON learner_model_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Intentionally NO UPDATE/DELETE policies — the trail is immutable.

CREATE INDEX IF NOT EXISTS idx_learner_model_history_user_created
  ON learner_model_history(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- master_usage
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS master_usage (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (
    role IN ('prescribe', 'evaluate', 'update_model', 'compose_lesson', 'render_moment')
  ),
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  model      TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE master_usage IS
  'Per-call Master telemetry. Non-blocking; telemetry failures never break user flows.';

ALTER TABLE master_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own master usage" ON master_usage;
CREATE POLICY "Users can view own master usage"
  ON master_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own master usage" ON master_usage;
CREATE POLICY "Users can insert own master usage"
  ON master_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_master_usage_user_created
  ON master_usage(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- profiles.master_enabled
-- -----------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS master_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN profiles.master_enabled IS
  'Per-user override for the Master feature. Takes precedence over VITE_MASTER_ENABLED.';

-- End of Wave 3 migration.
