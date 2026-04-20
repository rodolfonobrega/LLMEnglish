-- =============================================================================
-- Wave 6 Stage A — Lessons data model + dry-run trigger evaluator
--
-- NON-DESTRUCTIVE, ADDITIVE ONLY.
-- Authored but NOT applied automatically. Apply via `supabase db push` or the
-- Supabase dashboard SQL editor when ready. Every change is idempotent so the
-- migration can be re-run safely.
--
-- Tables:
--   * lessons         — a composed lesson plan (Stage A only writes dry-run rows).
--   * lesson_offers   — candidate offers produced by the trigger evaluator.
-- Constraint extension:
--   * learner_model_history.source check extended with 'breakthrough_event'.
--
-- RLS: each table restricts access to the owning user.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- lessons
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lessons (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_plan              JSONB NOT NULL,
  target_canonical_pattern TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN (
    'planned', 'offered', 'active', 'completed', 'abandoned', 'dry_run'
  )),
  moment_signals           JSONB NOT NULL DEFAULT '[]'::jsonb,
  baseline_utterance       TEXT,
  final_utterance          TEXT,
  delta_score              NUMERIC,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

COMMENT ON TABLE lessons IS
  'A composed lesson (5-moment arc). In Stage A only rows with status=dry_run exist.';

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lessons" ON lessons;
CREATE POLICY "Users can view own lessons"
  ON lessons FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lessons" ON lessons;
CREATE POLICY "Users can insert own lessons"
  ON lessons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lessons" ON lessons;
CREATE POLICY "Users can update own lessons"
  ON lessons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lessons_user_status
  ON lessons(user_id, status);

-- -----------------------------------------------------------------------------
-- lesson_offers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lesson_offers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_pattern TEXT NOT NULL,
  trigger_type      TEXT NOT NULL CHECK (trigger_type IN (
    'chronic', 'stuck', 'breakthrough', 'cadence'
  )),
  status            TEXT NOT NULL CHECK (status IN (
    'would_offer', 'offered', 'accepted', 'dismissed', 'muted_week'
  )),
  dry_run           BOOLEAN NOT NULL DEFAULT TRUE,
  mute_until        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE lesson_offers IS
  'Candidate lesson offers produced by the trigger evaluator. Stage A only writes dry_run=true rows.';

ALTER TABLE lesson_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lesson offers" ON lesson_offers;
CREATE POLICY "Users can view own lesson offers"
  ON lesson_offers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lesson offers" ON lesson_offers;
CREATE POLICY "Users can insert own lesson offers"
  ON lesson_offers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lesson offers" ON lesson_offers;
CREATE POLICY "Users can update own lesson offers"
  ON lesson_offers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_offers_user_created
  ON lesson_offers(user_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- learner_model_history: extend source check for lesson-driven rows
-- -----------------------------------------------------------------------------
--
-- The Wave 3 check constraint is unnamed (it was inlined with CHECK (...)).
-- We drop-and-readd it with a stable name and the extended value list.
-- Safe to re-run: DROP IF EXISTS, ADD only if missing.

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'learner_model_history'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) LIKE '%source%'
   LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE learner_model_history DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE learner_model_history
  ADD CONSTRAINT learner_model_history_source_chk
  CHECK (source IN (
    'evaluate', 'update_model', 'reset', 'lesson_boost', 'breakthrough_event'
  ));

-- End of Wave 6 Stage A migration.
