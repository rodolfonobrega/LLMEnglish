-- =============================================================================
-- Master Integration — Phase 3 (Reflection surfaces)
--
-- Introduces the persistence layer for end-of-session reflections:
--
--   1. `profiles.reflections_opt_in` — per-user opt-in flag, mirrors the
--      existing `lessons_opt_in` UX. NULL is treated as "opted in" so rows
--      created before this migration continue to show reflections.
--
--   2. `session_reflections` table — one row per reflection the Master
--      produces at the end of a practice session. The row stores the
--      stealth-checked observation text + the `MetaAssessment`-style
--      evidence that backs it (salient patterns seen, themes, surface).
--
-- Shape of `session_reflections`:
--
--   id                  UUID PK
--   user_id             UUID FK → auth.users, RLS-scoped
--   session_key         TEXT  — stable key produced client-side (surface +
--                               timestamp bucket), used to deduplicate if the
--                               student refreshes mid-generation.
--   surface             TEXT  — 'live' / 'mini-live' / 'review' / 'lesson' /
--                               'exercises' / 'paths'.
--   strength_text       TEXT  NOT NULL — first-person stealth-compliant
--                               observation: "suas histórias estão ficando
--                               mais longas".
--   opportunity_text    TEXT  NOT NULL — same shape, describing what to
--                               practice next.
--   salient_patterns    TEXT[] — canonical pattern ids the reflection is
--                               anchored in. Never displayed verbatim.
--   themes_observed     TEXT[] — themes seen during the session.
--   dismissed_at        TIMESTAMPTZ — set when the student closes the card.
--   opted_out_at        TIMESTAMPTZ — set when the student clicks "desligar
--                               reflexões" (also flips profile flag).
--   created_at          TIMESTAMPTZ DEFAULT NOW()
--
-- Design decisions (see docs/master-integration-plan.md §6):
--   * Decision `reflections_storage = new_column_and_new_table`: we add a
--     NEW table rather than piggybacking on an existing one so the history
--     page can pull reflections independently of the session's raw
--     MetaAssessment. The `salient_patterns[]` duplication is deliberate.
--   * No CHECK on `surface` — same argument as `llm_usage.surface`.
--   * RLS: self-only read + insert + update. No DELETE policy: reflections
--     are append-only and dismissal is a soft update.
--   * An index on `(user_id, created_at DESC)` + one on `(user_id,
--     dismissed_at) WHERE dismissed_at IS NULL` so "show me the latest
--     undismissed reflection" is a one-row lookup.
-- =============================================================================

-- 1. Per-user opt-in flag for reflections.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reflections_opt_in BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.reflections_opt_in IS
  'Phase 3: per-user opt-in for end-of-session reflection cards. NULL is treated as opted-in for backward-compatibility with rows created before this migration.';

-- 2. The reflections table itself.
CREATE TABLE IF NOT EXISTS session_reflections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_key         TEXT NOT NULL,
  surface             TEXT NOT NULL,
  strength_text       TEXT NOT NULL,
  opportunity_text    TEXT NOT NULL,
  salient_patterns    TEXT[] NOT NULL DEFAULT '{}',
  themes_observed     TEXT[] NOT NULL DEFAULT '{}',
  dismissed_at        TIMESTAMPTZ,
  opted_out_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE session_reflections IS
  'Phase 3: end-of-session Master reflections. Append-only; dismissal and opt-out are soft updates.';

-- Deduplicate per-session: client supplies a stable `session_key`.
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_reflections_user_key
  ON session_reflections(user_id, session_key);

CREATE INDEX IF NOT EXISTS idx_session_reflections_user_created
  ON session_reflections(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_reflections_user_undismissed
  ON session_reflections(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE session_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reflections" ON session_reflections;
CREATE POLICY "Users can view own reflections"
  ON session_reflections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reflections" ON session_reflections;
CREATE POLICY "Users can insert own reflections"
  ON session_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reflections" ON session_reflections;
CREATE POLICY "Users can update own reflections"
  ON session_reflections FOR UPDATE
  USING (auth.uid() = user_id);
