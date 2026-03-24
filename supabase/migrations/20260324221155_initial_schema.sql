-- LLMEnglish initial Supabase schema
-- Source of truth: versioned migrations in supabase/migrations

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- PROFILES
-- Extends auth.users with user profile data
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  profile TEXT DEFAULT '',
  interests TEXT DEFAULT '',
  goals TEXT DEFAULT '',
  current_level TEXT DEFAULT 'Intermediate',
  conversation_tone TEXT DEFAULT 'balanced' CHECK (conversation_tone IN ('casual', 'balanced', 'formal')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- CARDS
-- Flashcards with SM-2 spaced repetition data
-- ============================================================================
CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('phrase', 'text', 'roleplay', 'image')),
  prompt TEXT NOT NULL,
  expected_context TEXT,
  image_url TEXT,
  target_vocabulary TEXT[],
  context TEXT,
  theme TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  ease_factor NUMERIC(3, 2) DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own cards" ON cards;
CREATE POLICY "Users can view own cards"
  ON cards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cards" ON cards;
CREATE POLICY "Users can insert own cards"
  ON cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cards" ON cards;
CREATE POLICY "Users can update own cards"
  ON cards FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cards" ON cards;
CREATE POLICY "Users can delete own cards"
  ON cards FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(user_id, next_review_at) WHERE next_review_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(user_id, type);

-- ============================================================================
-- CARD REVIEWS
-- Historical review data for cards
-- ============================================================================
CREATE TABLE IF NOT EXISTS card_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score NUMERIC(3, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  user_transcription TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE card_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own card reviews" ON card_reviews;
CREATE POLICY "Users can view own card reviews"
  ON card_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own card reviews" ON card_reviews;
CREATE POLICY "Users can insert own card reviews"
  ON card_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_card_reviews_card_id ON card_reviews(card_id);

-- ============================================================================
-- CARD EVALUATIONS
-- Latest evaluation for each card
-- ============================================================================
CREATE TABLE IF NOT EXISTS card_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score NUMERIC(3, 2) NOT NULL,
  user_transcription TEXT NOT NULL,
  corrected_version TEXT NOT NULL,
  better_alternatives TEXT[],
  corrections TEXT[],
  overall_feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(card_id) -- Only one latest evaluation per card
);

-- Enable RLS
ALTER TABLE card_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own card evaluations" ON card_evaluations;
CREATE POLICY "Users can view own card evaluations"
  ON card_evaluations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own card evaluations" ON card_evaluations;
CREATE POLICY "Users can insert own card evaluations"
  ON card_evaluations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own card evaluations" ON card_evaluations;
CREATE POLICY "Users can update own card evaluations"
  ON card_evaluations FOR UPDATE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_card_evaluations_card_id ON card_evaluations(card_id);

-- ============================================================================
-- GAMIFICATION
-- XP, level, streaks, and overall stats
-- ============================================================================
CREATE TABLE IF NOT EXISTS gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  total_sessions INTEGER DEFAULT 0,
  total_cards INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE gamification ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own gamification" ON gamification;
CREATE POLICY "Users can view own gamification"
  ON gamification FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own gamification" ON gamification;
CREATE POLICY "Users can insert own gamification"
  ON gamification FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own gamification" ON gamification;
CREATE POLICY "Users can update own gamification"
  ON gamification FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_gamification_updated_at ON gamification;
CREATE TRIGGER update_gamification_updated_at
  BEFORE UPDATE ON gamification
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- BADGES
-- User achievement badges
-- ============================================================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own badges" ON badges;
CREATE POLICY "Users can view own badges"
  ON badges FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own badges" ON badges;
CREATE POLICY "Users can insert own badges"
  ON badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_badges_user_id ON badges(user_id);

-- ============================================================================
-- LIVE SESSIONS
-- Real-time audio roleplay sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scenario JSONB NOT NULL,
  turn_count INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own live sessions" ON live_sessions;
CREATE POLICY "Users can view own live sessions"
  ON live_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own live sessions" ON live_sessions;
CREATE POLICY "Users can insert own live sessions"
  ON live_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own live sessions" ON live_sessions;
CREATE POLICY "Users can update own live sessions"
  ON live_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_id ON live_sessions(user_id);

-- ============================================================================
-- CONVERSATION TURNS
-- Individual turns in live sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  text TEXT NOT NULL,
  audio_path TEXT,
  timestamp NUMERIC NOT NULL
);

-- Enable RLS
ALTER TABLE conversation_turns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own conversation turns" ON conversation_turns;
CREATE POLICY "Users can view own conversation turns"
  ON conversation_turns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversation turns" ON conversation_turns;
CREATE POLICY "Users can insert own conversation turns"
  ON conversation_turns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_conversation_turns_session_id ON conversation_turns(live_session_id);

-- ============================================================================
-- CONVERSATION ANALYSES
-- Post-session analysis of conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL UNIQUE REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  improvements TEXT[],
  clean_dialogue JSONB,
  overall_feedback TEXT,
  dialogue_audio_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE conversation_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own conversation analyses" ON conversation_analyses;
CREATE POLICY "Users can view own conversation analyses"
  ON conversation_analyses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversation analyses" ON conversation_analyses;
CREATE POLICY "Users can insert own conversation analyses"
  ON conversation_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- SESSION REPORTS
-- Daily/session reports for progress tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('exercise', 'review', 'live-roleplay')),
  exercises_completed INTEGER DEFAULT 0,
  scores NUMERIC(3, 2)[],
  average_score NUMERIC(3, 2),
  errors_found INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  improvements TEXT[]
);

-- Enable RLS
ALTER TABLE session_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own session reports" ON session_reports;
CREATE POLICY "Users can view own session reports"
  ON session_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own session reports" ON session_reports;
CREATE POLICY "Users can insert own session reports"
  ON session_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_session_reports_user_id_date ON session_reports(user_id, date);

-- ============================================================================
-- PATH PROGRESS
-- Progress in roleplay trails
-- ============================================================================
CREATE TABLE IF NOT EXISTS path_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trail_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, trail_id, step_id)
);

-- Enable RLS
ALTER TABLE path_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own path progress" ON path_progress;
CREATE POLICY "Users can view own path progress"
  ON path_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own path progress" ON path_progress;
CREATE POLICY "Users can insert own path progress"
  ON path_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_path_progress_user_id ON path_progress(user_id);

-- ============================================================================
-- MODEL CONFIG
-- User's AI model configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  chat_model TEXT DEFAULT 'gemini-2.5-flash',
  chat_provider TEXT DEFAULT 'gemini' CHECK (chat_provider IN ('openai', 'gemini', 'groq')),
  stt_model TEXT DEFAULT 'gemini-2.5-flash',
  stt_provider TEXT DEFAULT 'gemini' CHECK (stt_provider IN ('openai', 'gemini', 'groq')),
  tts_model TEXT DEFAULT 'gemini-2.5-flash-preview-tts',
  tts_voice TEXT DEFAULT 'Kore',
  tts_provider TEXT DEFAULT 'gemini' CHECK (tts_provider IN ('openai', 'gemini', 'groq')),
  image_model TEXT DEFAULT 'gemini-2.5-flash-image',
  image_provider TEXT DEFAULT 'gemini' CHECK (image_provider IN ('openai', 'gemini')),
  live_model TEXT DEFAULT 'gemini-2.5-flash-native-audio-preview-12-2025',
  live_voice TEXT DEFAULT 'Puck',
  live_provider TEXT DEFAULT 'gemini' CHECK (live_provider IN ('openai', 'gemini')),
  chat_fallback_model TEXT,
  chat_fallback_provider TEXT CHECK (chat_fallback_provider IN ('openai', 'gemini', 'groq')),
  stt_fallback_model TEXT,
  stt_fallback_provider TEXT CHECK (stt_fallback_provider IN ('openai', 'gemini', 'groq')),
  tts_fallback_model TEXT,
  tts_fallback_provider TEXT CHECK (tts_fallback_provider IN ('openai', 'gemini', 'groq')),
  tts_fallback_voice TEXT
);

-- Enable RLS
ALTER TABLE model_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own model config" ON model_config;
CREATE POLICY "Users can view own model config"
  ON model_config FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own model config" ON model_config;
CREATE POLICY "Users can insert own model config"
  ON model_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own model config" ON model_config;
CREATE POLICY "Users can update own model config"
  ON model_config FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- ENCRYPTED API KEYS
-- User's API keys, encrypted before storage
-- SELECT is blocked - only accessible via Edge Function
-- ============================================================================
CREATE TABLE IF NOT EXISTS encrypted_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  openai_key TEXT,
  gemini_key TEXT,
  groq_key TEXT,
  openai_key_updated_at TIMESTAMPTZ,
  gemini_key_updated_at TIMESTAMPTZ,
  groq_key_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE encrypted_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- IMPORTANT: Direct SELECT is blocked for security
DROP POLICY IF EXISTS "Users cannot directly view encrypted keys" ON encrypted_api_keys;
CREATE POLICY "Users cannot directly view encrypted keys"
  ON encrypted_api_keys FOR SELECT
  USING (false);

DROP POLICY IF EXISTS "Users can insert own encrypted keys" ON encrypted_api_keys;
CREATE POLICY "Users can insert own encrypted keys"
  ON encrypted_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own encrypted keys" ON encrypted_api_keys;
CREATE POLICY "Users can update own encrypted keys"
  ON encrypted_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
DROP TRIGGER IF EXISTS update_encrypted_api_keys_updated_at ON encrypted_api_keys;
CREATE TRIGGER update_encrypted_api_keys_updated_at
  BEFORE UPDATE ON encrypted_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ERROR PATTERNS
-- Persisted error analytics for review prioritization and dashboard insights
-- ============================================================================
CREATE TABLE IF NOT EXISTS error_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pattern_key TEXT NOT NULL,
  pattern TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'grammar', 'pronunciation', 'vocabulary', 'fluency', 'syntax',
    'preposition', 'verb-tense', 'article', 'word-order', 'other'
  )),
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  trend TEXT NOT NULL DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'worsening')),
  recent_scores NUMERIC(4, 2)[] NOT NULL DEFAULT '{}'::NUMERIC[],
  UNIQUE(user_id, pattern_key)
);

ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own error patterns" ON error_patterns;
CREATE POLICY "Users can view own error patterns"
  ON error_patterns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own error patterns" ON error_patterns;
CREATE POLICY "Users can insert own error patterns"
  ON error_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own error patterns" ON error_patterns;
CREATE POLICY "Users can update own error patterns"
  ON error_patterns FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own error patterns" ON error_patterns;
CREATE POLICY "Users can delete own error patterns"
  ON error_patterns FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_error_patterns_user_key ON error_patterns(user_id, pattern_key);
CREATE INDEX IF NOT EXISTS idx_error_patterns_user_category ON error_patterns(user_id, category);
CREATE INDEX IF NOT EXISTS idx_error_patterns_user_last_seen ON error_patterns(user_id, last_seen DESC);

-- ============================================================================
-- ERROR SNAPSHOTS
-- Periodic snapshots of the user's error state over time
-- ============================================================================
CREATE TABLE IF NOT EXISTS error_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_errors INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(4, 2) NOT NULL DEFAULT 0,
  by_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_patterns INTEGER NOT NULL DEFAULT 0,
  resolved_patterns INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE error_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own error snapshots" ON error_snapshots;
CREATE POLICY "Users can view own error snapshots"
  ON error_snapshots FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own error snapshots" ON error_snapshots;
CREATE POLICY "Users can insert own error snapshots"
  ON error_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own error snapshots" ON error_snapshots;
CREATE POLICY "Users can delete own error snapshots"
  ON error_snapshots FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_error_snapshots_user_date ON error_snapshots(user_id, date DESC);

-- ============================================================================
-- FUNCTIONS
-- Helper functions for common queries
-- ============================================================================

-- Get cards due for review for a user
CREATE OR REPLACE FUNCTION get_cards_due_for_review(user_param UUID)
RETURNS SETOF cards AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM cards c
  WHERE c.user_id = user_param
    AND c.next_review_at IS NOT NULL
    AND c.next_review_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get or create gamification record for a user
CREATE OR REPLACE FUNCTION get_or_create_gamification(user_param UUID)
RETURNS gamification AS $$
DECLARE
  result gamification;
BEGIN
  SELECT * INTO result FROM gamification WHERE user_id = user_param;
  IF NOT FOUND THEN
    INSERT INTO gamification (user_id)
    VALUES (user_param)
    RETURNING * INTO result;
  END IF;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
