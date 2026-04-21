# LLMEnglish

AI-powered English speaking practice app built with React, Vite, and Supabase.

## What is versioned

- Application code in `src/`
- Supabase schema in `supabase/migrations/`
- Supabase local config in `supabase/config.toml`
- Edge Function source in `supabase/functions/ai-proxy/`
- Example environment files only, never real secrets

The repo is the source of truth. Database changes belong in `supabase/migrations`, not in the Supabase SQL Editor.

## Quick start

### Dev mode (no Supabase needed)

To preview UI changes without a backend:

```bash
make install
npx vite --port 5173 --host
```

In dev mode (`npx vite`), the app skips authentication and shows the UI directly. No `.env.local` or Supabase connection required. This is meant for visual development and UI iteration only — features that depend on the backend (auth, database, AI) won't work.

### Frontend only against the hosted Supabase project

1. Install dependencies:

```bash
make install
```

2. Copy the frontend env file and fill in the hosted project values:

```bash
cp .env.local.example .env.local
```

3. Start the app:

```bash
make dev
```

The app runs on `http://localhost:5173` by default.

### Full local Supabase stack

1. Copy the local Auth env file and fill in your OAuth secrets:

```bash
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
```

2. Set a 32-byte hex `ENCRYPTION_KEY` in `supabase/functions/.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Start Supabase and reset the local database from migrations:

```bash
make supabase-start
make supabase-db-reset
```

4. Start the frontend:

```bash
make dev
```

Useful local commands:

```bash
make supabase-status
make supabase-functions-serve
make supabase-stop
```

## Hosted project workflow

The current hosted project ref is `gpmjxqprknkqawlzhoku`.

Link the CLI once on a new machine:

```bash
make supabase-link
```

Push versioned database changes:

```bash
make supabase-db-push
```

Deploy the Edge Function:

```bash
make supabase-functions-deploy
```

## Environment files

- `.env.local`: frontend-only Vite variables such as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `.env`: local Supabase CLI/Auth secrets referenced by `supabase/config.toml`
- `supabase/functions/.env`: local Edge Function secrets such as `ENCRYPTION_KEY`

Do not commit any of them.

## Data model

User data lives in Supabase:

- profiles and auth-linked preferences
- cards, reviews, evaluations, reports, trails, XP, badges
- live session history
- encrypted per-user provider keys
- error analytics snapshots and patterns
- learner adaptation state in `learner_models` and `learner_model_history`
- Master cost/latency telemetry in `master_usage`

Client-only data stays local on purpose:

- theme and UI preferences
- browser cache such as generated TTS audio

## Privacy notes

- `learner_models` stores pedagogical metadata only: CEFR estimate, strengths, recurring patterns, engagement signals, next-step plan, and related adaptation state. It is intended to personalize practice, not to store free-form user diaries or unrelated personal notes.
- `learner_model_history` is an audit trail of patch operations applied to that model. It stores patch metadata and reasons, not raw exercise transcripts by default.
- `master_usage` stores operational telemetry only: `role`, `tokens_in`, `tokens_out`, `model`, and `latency_ms`. It does not persist prompt bodies, chat transcripts, or audio payloads.
- RLS is enabled on these tables, so users can only read their own rows through the app.

## Lesson opt-out

Focused lesson offers from the Master can be disabled in `Configurações` via `Permitir atividades sugeridas pelo tutor`.

- Backing field: `profiles.lessons_opt_in`
- Default behavior: `true` for new rows; `null` is treated as opt-in for backward compatibility
- Effect when disabled: the app stops surfacing new `LessonOfferCard` suggestions, while the rest of the practice flows keep working

## Commands

```bash
make help
make dev
make build
make lint
make test
make test-coverage
make test-models-mock
make test-models-smoke
make test-models-matrix
make supabase-start
make supabase-db-reset
make supabase-db-push
make supabase-functions-serve
make supabase-functions-deploy
```

`make test` and `npm test` skip `*.smoke.test.ts` on purpose. The paid model checks only run through the explicit smoke commands above.

## Verification

Before pushing changes, run:

```bash
npm run build
npm run lint
```
