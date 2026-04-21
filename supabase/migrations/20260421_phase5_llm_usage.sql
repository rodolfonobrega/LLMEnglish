-- =============================================================================
-- Master Integration — Phase 5 (LLM cost tracking)
--
-- Introduces a single, generic `llm_usage` table that captures EVERY LLM
-- call in the app — Master roles, scenario generators, scripts drills,
-- Live meta evals, and whatever comes next. This is the underlying store
-- for the Phase 5 cost dashboard.
--
-- Design goals:
--   1. Unified schema across providers (genai, openai, groq, openrouter,
--      vertex). Provider-native token counts are stored alongside a
--      best-effort estimated USD cost computed by the ai-proxy.
--   2. Tagged by `surface` (where in the UI the call originated) and
--      `role` (the logical purpose — Master role or free-form label).
--      Surfaces are strings rather than an enum so adding new pages
--      doesn't require a migration.
--   3. Non-blocking telemetry: inserts are fired and forgotten by the
--      client (`recordLlmUsage`), and errors never break the user flow.
--
-- Relationship to `master_usage`:
--   * `master_usage` stays for backward compatibility with existing
--     dashboards/queries. For Phase 5 forward, new Master telemetry
--     also lands in `llm_usage` via `recordLlmUsage({ role: ..., ... })`.
--   * We deliberately do NOT mirror rows from `master_usage` into
--     `llm_usage` — the client writes to `llm_usage` directly once this
--     migration is deployed.
--
-- Columns:
--   id           UUID      PK.
--   user_id      UUID      FK → auth.users, RLS-scoped.
--   provider     TEXT      One of genai/openai/groq/openrouter/vertex.
--   model        TEXT      Provider-specific model id (e.g. 'gemini-2.5-flash').
--   surface      TEXT      Feature surface (e.g. 'review', 'paths', 'live').
--   role         TEXT      Logical purpose ('prescribe', 'evaluate', ...).
--   operation    TEXT      Kind of call — 'chat', 'stt', 'tts', 'image',
--                           'live' (duration-based), 'embed'. Used by the
--                           cost dashboard to bucket by modality.
--   tokens_in    INTEGER   Provider-native prompt token count. 0 when
--                           unavailable (TTS/image/live may fall back to
--                           seconds_used).
--   tokens_out   INTEGER   Provider-native completion token count.
--   seconds_used NUMERIC   For duration-billed operations (Live, TTS).
--                           NULL for pure token operations.
--   cost_usd     NUMERIC   Estimated cost in USD, computed by ai-proxy
--                           using a static price table. Client never
--                           computes this to keep the price table in one
--                           place.
--   latency_ms   INTEGER   Round-trip latency for the call, nullable.
--   created_at   TIMESTAMPTZ
--
-- Indexing:
--   * Per-user, time-descending primary index for the "last N calls" view.
--   * Per-user + role index to support the "cost by Master role" chart.
--
-- RLS:
--   * SELECT: self-only.
--   * INSERT: self-only. The client authenticates to Supabase with the
--     student's JWT and writes their own rows directly.
-- =============================================================================

CREATE TABLE IF NOT EXISTS llm_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (
    provider IN ('genai', 'openai', 'groq', 'openrouter', 'vertex')
  ),
  model         TEXT NOT NULL,
  surface       TEXT NOT NULL,
  role          TEXT NOT NULL,
  operation     TEXT NOT NULL CHECK (
    operation IN ('chat', 'stt', 'tts', 'image', 'live', 'embed')
  ),
  tokens_in     INTEGER NOT NULL DEFAULT 0,
  tokens_out    INTEGER NOT NULL DEFAULT 0,
  seconds_used  NUMERIC,
  cost_usd      NUMERIC,
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE llm_usage IS
  'Phase 5: unified per-call LLM telemetry (tokens + cost + latency), tagged by surface and role.';

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own llm usage" ON llm_usage;
CREATE POLICY "Users can view own llm usage"
  ON llm_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own llm usage" ON llm_usage;
CREATE POLICY "Users can insert own llm usage"
  ON llm_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_created
  ON llm_usage(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_role
  ON llm_usage(user_id, role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_surface
  ON llm_usage(user_id, surface, created_at DESC);
