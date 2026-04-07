-- Align remote schema with source-based model routing and OpenRouter key storage.

ALTER TABLE model_config
  ADD COLUMN IF NOT EXISTS chat_source TEXT,
  ADD COLUMN IF NOT EXISTS stt_source TEXT,
  ADD COLUMN IF NOT EXISTS tts_source TEXT,
  ADD COLUMN IF NOT EXISTS image_source TEXT,
  ADD COLUMN IF NOT EXISTS live_source TEXT,
  ADD COLUMN IF NOT EXISTS chat_fallback_source TEXT,
  ADD COLUMN IF NOT EXISTS stt_fallback_source TEXT,
  ADD COLUMN IF NOT EXISTS tts_fallback_source TEXT;

UPDATE model_config
SET
  chat_source = COALESCE(chat_source, CASE chat_provider WHEN 'gemini' THEN 'genai' ELSE chat_provider END),
  stt_source = COALESCE(stt_source, CASE stt_provider WHEN 'gemini' THEN 'genai' ELSE stt_provider END),
  tts_source = COALESCE(tts_source, CASE tts_provider WHEN 'gemini' THEN 'genai' ELSE tts_provider END),
  image_source = COALESCE(image_source, CASE image_provider WHEN 'gemini' THEN 'genai' ELSE image_provider END),
  live_source = COALESCE(live_source, CASE live_provider WHEN 'gemini' THEN 'genai' ELSE live_provider END),
  chat_fallback_source = COALESCE(chat_fallback_source, CASE chat_fallback_provider WHEN 'gemini' THEN 'genai' ELSE chat_fallback_provider END),
  stt_fallback_source = COALESCE(stt_fallback_source, CASE stt_fallback_provider WHEN 'gemini' THEN 'genai' ELSE stt_fallback_provider END),
  tts_fallback_source = COALESCE(tts_fallback_source, CASE tts_fallback_provider WHEN 'gemini' THEN 'genai' ELSE tts_fallback_provider END);

ALTER TABLE model_config
  ALTER COLUMN chat_source SET DEFAULT 'genai',
  ALTER COLUMN stt_source SET DEFAULT 'genai',
  ALTER COLUMN tts_source SET DEFAULT 'genai',
  ALTER COLUMN image_source SET DEFAULT 'genai',
  ALTER COLUMN live_source SET DEFAULT 'genai';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_chat_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_chat_source_check
      CHECK (chat_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_stt_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_stt_source_check
      CHECK (stt_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_tts_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_tts_source_check
      CHECK (tts_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_image_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_image_source_check
      CHECK (image_source IN ('genai', 'vertex', 'openai', 'openrouter'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_live_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_live_source_check
      CHECK (live_source IN ('genai', 'vertex', 'openai'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_chat_fallback_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_chat_fallback_source_check
      CHECK (chat_fallback_source IS NULL OR chat_fallback_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_stt_fallback_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_stt_fallback_source_check
      CHECK (stt_fallback_source IS NULL OR stt_fallback_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'model_config_tts_fallback_source_check'
  ) THEN
    ALTER TABLE model_config
      ADD CONSTRAINT model_config_tts_fallback_source_check
      CHECK (tts_fallback_source IS NULL OR tts_fallback_source IN ('genai', 'vertex', 'openrouter', 'openai', 'groq'));
  END IF;
END $$;

ALTER TABLE encrypted_api_keys
  ADD COLUMN IF NOT EXISTS openrouter_key TEXT,
  ADD COLUMN IF NOT EXISTS openrouter_key_updated_at TIMESTAMPTZ;
