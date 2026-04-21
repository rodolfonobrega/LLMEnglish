# Pending operational TODOs

No pending operational TODOs remain in this file as of 2026-04-21.

## Closed items

- Supabase migrations verified on project `gpmjxqprknkqawlzhoku`:
  - `wave2_canonical_patterns_and_5d`
  - `wave3_learner_model_and_telemetry`
  - `wave6a_lessons_stage_a`
  - `wave6b_lessons_stage_b`
- Schema verified:
  - `public.lessons` exists with RLS enabled
  - `public.lesson_offers` exists with RLS enabled
  - `public.profiles.lessons_opt_in` exists with default `true`
  - `public.lesson_offers_user_status_idx` exists
  - `learner_model_history_source_chk` allows `lesson_boost` and `breakthrough_event`
- Lesson trigger go-live switch already flipped in code:
  - [`src/services/master/lessonTriggers.ts`](/projects/gemini_3/LLMEnglish/src/services/master/lessonTriggers.ts)
    now writes `dry_run: false`
- Current data state verified:
  - `lesson_offers` currently has `0` rows, so there was nothing to backfill from dry-run to live
- `ai-proxy` deployed on project `gpmjxqprknkqawlzhoku`:
  - active function version: `9`
  - hardened CORS preflight verified: `403` for `https://evil.example`
  - allowlisted preflight verified: `200` with echoed origin for `https://speaklab.app`
- Privacy/data-handling notes documented in:
  - [`README.md`](/projects/gemini_3/LLMEnglish/README.md)
