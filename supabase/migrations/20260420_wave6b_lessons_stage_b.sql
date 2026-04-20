-- Wave 6 Stage B — flip Lessons from dry-run telemetry to the full student-
-- visible stack. AUTHORED-ONLY; never applied automatically. Run manually
-- after Stage A signal review (≥ 2 weeks) passes.
--
-- What this migration does:
--   1. Adds `profiles.lessons_opt_in BOOLEAN DEFAULT TRUE` so users can
--      globally opt out of focused lessons from the Settings page (F31i).
--   2. Adds a covering index `lesson_offers(user_id, status)` used by both
--      the trigger evaluator (frequency caps) and the Practice Hub offer
--      card reader.
--   3. Documents a migration helper to flip existing `dry_run` offers to
--      user-visible. Kept as a commented block — ops decides when to run it.
--
-- Idempotent — safe to re-run.

BEGIN;

-- 1. Global opt-out on `profiles`.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS lessons_opt_in BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN profiles.lessons_opt_in IS
  'Wave 6 Stage B (F31i): when FALSE, suppresses all Master focused lesson offers globally for this user.';

-- 2. Offer reader + cap evaluator index.
CREATE INDEX IF NOT EXISTS lesson_offers_user_status_idx
  ON lesson_offers(user_id, status);

-- 3. (Optional, manual) Flip backlog dry-run offers to live. Commented by
--    default — ops should run this ONLY after the trigger signal review
--    confirms the generated `candidate_pattern` values are plausible.
--
--    UPDATE lesson_offers
--       SET dry_run = FALSE
--     WHERE dry_run = TRUE
--       AND status = 'would_offer'
--       AND created_at >= NOW() - INTERVAL '7 days';

COMMIT;
