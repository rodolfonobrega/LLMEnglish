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

Client-only data stays local on purpose:

- theme and UI preferences
- browser cache such as generated TTS audio

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
make supabase-start
make supabase-db-reset
make supabase-db-push
make supabase-functions-serve
make supabase-functions-deploy
```

## Verification

Before pushing changes, run:

```bash
npm run build
npm run lint
```
