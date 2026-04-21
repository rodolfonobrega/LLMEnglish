# Pending operational TODOs

## Open — Phase 3 (End-of-session reflections) — 2026-04-21

### Supabase migration to run

- [ ] Apply `supabase/migrations/20260421_phase3_reflections.sql` on
      project `gpmjxqprknkqawlzhoku`. The migration does two things:
  - Adds a nullable `profiles.reflections_opt_in boolean` column with
    default `TRUE`. This gates end-of-session reflection cards and the
    cross-surface nudge engine (Phase 4).
  - Creates `public.session_reflections` with RLS scoped to
    `auth.uid() = user_id`, plus a unique `(user_id, session_key)`
    constraint and a `user_id, created_at DESC` index for the history
    page.
- [ ] Verify via `\d profiles` that `reflections_opt_in` exists with
      default `true`, and via `\d session_reflections` that the table,
      unique constraint, index, and two RLS policies exist.

### No action required, just awareness

- Until the migration runs:
  - Reads of `profiles.reflections_opt_in` resolve to `undefined` so
    `generateSessionReflection` treats the user as opted-in (matches
    the default behaviour the migration will install).
  - Writes to `session_reflections` fail with PostgREST table-not-found.
    `saveSessionReflection` swallows the error and returns `null`, so
    end-of-session UX degrades gracefully: the user finishes the session,
    no reflection card appears.
- The Settings toggle ("Receber reflexões ao fim da sessão") flips
  `profiles.reflections_opt_in` directly via `updateProfile`. After the
  migration lands it becomes authoritative; before that, the profile
  write still succeeds if the column is present.

## Open — Phase 5 (LLM cost tracking) — 2026-04-21

### Supabase migration to run

- [ ] Apply `supabase/migrations/20260421_phase5_llm_usage.sql` on
      project `gpmjxqprknkqawlzhoku`. This creates the unified
      `llm_usage` table consumed by `src/services/llmTelemetry.ts`
      (and mirrored automatically by `recordMasterUsage`). RLS is
      self-only, pattern-identical to `master_usage`.
- [ ] Verify with `\d llm_usage` that the new table, three indexes
      (`idx_llm_usage_user_created`, `idx_llm_usage_user_role`,
      `idx_llm_usage_user_surface`), and two RLS policies exist.

### ai-proxy follow-up (Edge Function redeploy)

- [ ] Update `supabase/functions/ai-proxy/index.ts` so every `chat` /
      `stt` / `tts` / `image` handler returns provider-native token
      usage (when the provider exposes it) alongside `content`. Shape:
      `{ content, usage: { tokens_in, tokens_out, seconds_used?,
      cost_usd_override? } }`.
  - genai: read `usageMetadata.{promptTokenCount, candidatesTokenCount}`
    from the `generateContent` response.
  - openai: read `usage.prompt_tokens` / `usage.completion_tokens`.
  - groq: same shape as openai.
  - openrouter: same shape as openai; some models also include a
    server-side `usage.total_cost`.
  - vertex: mirror the genai shape from the Vertex gateway.
- [ ] Update `src/services/supabase/aiProxy.ts` + `src/services/openai.ts`
      to forward the new `usage` payload into `recordLlmUsage` with the
      correct `surface`/`role`. Until this lands, `recordMasterUsage`
      falls back to a client-side char-based token estimate — the
      dashboard still works, it's just approximate.

### No action required, just awareness

- `recordLlmUsage` (client-side) and the `llm_usage` table are the
  source of truth for the Phase 5 cost dashboard. `master_usage` keeps
  flowing in parallel for back-compat with the Master-specific
  dashboards.

## Open — Phase 5 (Per-role Master model configuration) — 2026-04-21

### Supabase migration to run

- [ ] Apply `supabase/migrations/20260421_phase5_master_models.sql` on
      project `gpmjxqprknkqawlzhoku`. The migration adds a nullable
      JSONB column `model_config.master_models` so the Settings UI
      (`MasterModelSection.tsx`) can persist per-role LLM overrides for
      the Master (resolved by `src/services/master/resolveMasterModel.ts`).
- [ ] Verify with `\d model_config` that the `master_models` JSONB column
      exists (NULLable, no CHECK constraint — validation lives on the
      client in `resolveMasterModel`).

### No action required, just awareness

- Until the migration runs, writes from
  `supabase.saveModelConfig(config)` that include a non-null
  `master_models` value will fail with PostgREST column-not-found. The
  `MasterModelSection` UI defaults every role to "Inherit" (i.e. `null`),
  so saves keep working until the student actually configures an
  override.
- `resolveMasterModel` is safe-by-default: on a missing / malformed
  override it falls back to `chat_model`/`chat_source`.

## Open — Phase 9 (Review card variation) — 2026-04-21

### Supabase migration to run

- [ ] Apply `supabase/migrations/20260421_phase9_vary_card_role.sql` on
      project `gpmjxqprknkqawlzhoku`. The migration extends the
      `master_usage.role` CHECK constraint with `'vary_card'` so the
      variant generator (`src/services/master/varyCard.ts`) can persist
      its telemetry rows.
- [ ] Verify via `\d master_usage` that `'vary_card'` is present in the
      CHECK constraint (alongside the Phase 2 values).

### No action required, just awareness

- Until the migration runs, `recordMasterUsage({ role: 'vary_card' })`
  inserts fail the CHECK constraint. The telemetry helper swallows the
  error with a `console.warn` (see `src/services/masterTelemetry.ts`),
  so Review-surface variants still work end-to-end; only the usage row
  is dropped.

## Open — Phase 2 (Live & Paths) — 2026-04-21

### Supabase migration to run

- [ ] Apply `supabase/migrations/20260421_phase2_live_meta_roles.sql` on
      project `gpmjxqprknkqawlzhoku`. The migration extends two CHECK
      constraints:
  - `master_usage.role` — adds `'live_meta'` and `'summarize_session'`.
  - `learner_model_history.source` — adds `'live_meta'`.
- [ ] Verify via `\d master_usage` / `\d learner_model_history` that both
      new enum values are present in the CHECK constraints.

### Code follow-up after the migration lands

- [ ] Remove the temporary coercion in
      [`src/services/learnerModel.ts`](/projects/gemini_3/LLMEnglish/src/services/learnerModel.ts)
      (`savePatchedModel` → `persistedSource` / `persistedReason` branch)
      that currently maps `source: 'live_meta'` down to `'update_model'`
      with a `live_meta:` reason prefix. Once the migration is live this
      fallback is no longer necessary and the original source can be
      persisted directly.

### No action required, just awareness

- `masterEvaluateLive` already sends telemetry with `role: 'live_meta'`.
  Until the migration runs, those inserts fail the CHECK constraint and
  the telemetry call is swallowed (see `chatCompletion` error handling).
  User-facing Live flows are unaffected.

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
