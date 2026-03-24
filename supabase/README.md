# Supabase workflow

This directory contains the versioned Supabase setup for the app.

## Files

- `config.toml`: local Supabase CLI configuration
- `migrations/`: canonical database schema history
- `functions/ai-proxy/`: Edge Function used to proxy AI calls with server-side secrets

## Local workflow

1. Copy secrets:

```bash
cp .env.example .env
cp supabase/functions/.env.example supabase/functions/.env
```

2. Start the local stack:

```bash
npm run supabase:start
```

3. Apply migrations:

```bash
npm run supabase:db:reset
```

4. Serve the Edge Function locally when needed:

```bash
npm run supabase:functions:serve
```

## Hosted workflow

Link the CLI to the hosted project once per machine:

```bash
npm run supabase:link
```

Push schema changes from `supabase/migrations`:

```bash
npm run supabase:db:push
```

Deploy the Edge Function:

```bash
npm run supabase:functions:deploy
```

## Rules

- Do not edit the database in the SQL Editor and leave the repo behind.
- Add every schema change as a new file in `supabase/migrations/`.
- Keep secrets in `.env`, `.env.local`, or `supabase/functions/.env`, never in git.
- Use `supabase/config.toml` as the local source of truth for ports and OAuth provider config.
