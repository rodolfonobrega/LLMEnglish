# Pending operational TODOs

Work that was authored in code but **intentionally not executed** in this
session — either because Supabase CLI/DB calls were disallowed, or because
it requires a real deploy. Run these in the order below when you're ready
to ship.

> Convention: everything here assumes repo root as CWD and that your local
> Supabase project is linked (`npx supabase link ...` already done).

---

## 1. Apply authored Supabase migrations

Two new migrations are on disk but have **not** been applied to any
environment:

| File | Wave | What it does |
| ---- | ---- | ------------ |
| `supabase/migrations/20260420_wave6a_lessons_stage_a.sql` | W6 Stage A | Creates `lessons` and `lesson_offers` tables (with RLS). Extends `learner_model_history.source` CHECK to allow `lesson_boost` and `breakthrough_event`. |
| `supabase/migrations/20260420_wave6b_lessons_stage_b.sql` | W6 Stage B | Adds `profiles.lessons_opt_in BOOLEAN DEFAULT TRUE`. Creates `lesson_offers(user_id, status)` index. Contains a commented block that flips recent `would_offer` rows to `dry_run=false` (see step 3). |

Also worth sanity-checking (authored earlier in this effort, apply if they
haven't been yet):

- `supabase/migrations/20260420_wave2_canonical_patterns_and_5d.sql`
- `supabase/migrations/20260420_wave3_learner_model_and_telemetry.sql`

### How to apply

```
npx supabase db push
```

Or, against a specific linked project:

```
npx supabase db push --linked
```

Verify in the Supabase dashboard:

- `lessons` table exists with RLS on.
- `lesson_offers` table exists with RLS on.
- `profiles.lessons_opt_in` column exists, defaults to `true`.
- `learner_model_history.source` CHECK now accepts `lesson_boost` and
  `breakthrough_event`.

### Backward-compat note

The app reads `profile.lessons_opt_in` with `!== false`, so both `null`
and `true` behave as opt-in. Existing rows get `true` from the
`DEFAULT TRUE`, so nothing to backfill.

---

## 2. Flip `lesson_offers` from dry-run to live (when you're ready)

While Stage A was silent, all trigger evaluations recorded
`lesson_offers` rows with `dry_run = true` and `status = 'would_offer'`.
Before Stage B can show offer cards to real users, you need to:

1. **Review the telemetry** — at least 2 weeks of dry-run data,
   qualitatively scan the rows (per §7.1 of
   `docs/feedback-redesign-implementation.md`). Look for false positives
   like "stuck" firing on single bad sessions, etc.

2. **Flip recent offers live** (optional; new offers created after
   step 3 will already be live):

   ```
   -- authored at the bottom of 20260420_wave6b_lessons_stage_b.sql,
   -- currently commented out.
   UPDATE lesson_offers
   SET dry_run = FALSE
   WHERE dry_run = TRUE
     AND status = 'would_offer'
     AND created_at >= NOW() - INTERVAL '7 days';
   ```

3. **Flip the client-side default**. In `src/services/master/lessonTriggers.ts`,
   `evaluateAndRecordTriggers` currently persists new rows with
   `dry_run: true`. Change it to `dry_run: false` when you're ready for
   the Practice Hub `LessonOfferCard` to surface them.

   > Today the UI is already wired: the card only shows rows with
   > `dry_run = false` AND `status = 'would_offer'`. So flipping the
   > client default is the actual "go-live" switch.

---

## 3. `ai-proxy` Edge Function — deploy checklist

Consolidated from `supabase/functions/ai-proxy/DEPLOY.md`. Code changes
in `index.ts` are on disk but **not** deployed.

### 3.1 Set the CORS allowlist (once per environment)

```
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,https://<your-prod-domain>"
```

- Comma-separated, no spaces, no trailing slashes.
- Include every origin the SPA calls from (local dev, preview URLs, prod).
- When unset, the function falls back to `http://localhost:5173` only.

### 3.2 Deploy the function

```
npm run supabase:functions:deploy
```

(Equivalent to `npx supabase functions deploy ai-proxy --no-verify-jwt`.)

### 3.3 Smoke test from the app

With a signed-in browser session, exercise each surface and confirm 200s:

- Chat (any exercise generation).
- TTS (card pronunciation).
- STT (any speaking drill — e.g. Oral Cloze, Active Shadowing).
- Image (chat-with-image).

### 3.4 Verify CORS is locked down

```
curl -I -X OPTIONS \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST" \
  https://<project>.supabase.co/functions/v1/ai-proxy
```

Expected: **403** with **no** `Access-Control-Allow-Origin` header.
Re-run with an allowlisted origin — should be 200/204 and echo that
origin back.

### 3.5 Verify image size cap (optional)

Point `imageUrl` at a >10 MB asset in a chat-with-image request. The
function should return an error mentioning "Image too large" rather
than OOM-ing.

### 3.6 Verify server-side fallback (G1 roll-out)

1. In Settings, set a fallback chat provider that works (e.g.
   primary=Gemini, fallback=OpenAI).
2. Temporarily break the primary by setting an invalid key.
3. Trigger any chat. It should succeed via the fallback, with no
   client-side retry log.
4. Restore the real primary key.

If the deploy hasn't happened yet, the client-side retry in
`src/services/openai.ts` still handles fallback — users won't notice
any degradation.

---

## 4. `ai-proxy` — future refactor (not blocking)

- **Move fallback retry logic server-side.** Today `src/services/openai.ts`
  retries on the client; the Edge Function could do it if the client
  just sent `preferred_fallback`. Requires a coordinated client
  refactor. There's a `TODO` near `CHAT_ENDPOINTS` in `index.ts`
  marking the intended location.

---

## 5. Privacy / data-handling review before Stage B goes live

Per §R-8 + §11 of `docs/feedback-redesign-implementation.md`, before
real users see `LessonOfferCard`:

- [ ] Short privacy review on `learner_models` content. RLS is necessary
      but not sufficient — confirm what an operator could see if they
      qualitatively reviewed rows.
- [ ] Confirm `master_usage` telemetry doesn't leak PII beyond what's
      already in stored chat logs.
- [ ] Document the opt-out (`profiles.lessons_opt_in`) in whatever
      user-facing policy doc you maintain.

---

## 6. Roll-back posture

If Stage B needs to be pulled after going live:

- Setting `lessons_opt_in = FALSE` globally (or per-user) immediately
  silences new offers and the `LessonOfferCard`.
- Reverting the `dry_run` default in `lessonTriggers.ts` stops new live
  offers from being written.
- Existing rows with `dry_run = false` can be flipped back with:

  ```
  UPDATE lesson_offers SET dry_run = TRUE
  WHERE status = 'would_offer';
  ```

- The `lessons` table can stay as-is; abandoned/completed rows are
  historical telemetry and safe to keep.

---

_Last updated: 2026-04-20 — Wave 6 Stage B implementation session._
