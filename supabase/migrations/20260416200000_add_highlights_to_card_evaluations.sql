ALTER TABLE card_evaluations
  ADD COLUMN IF NOT EXISTS highlights jsonb DEFAULT NULL;
