# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# SpeakLab / LLMEnglish

AI-powered English speaking practice SPA. React 19 + Vite 6 + Tailwind v4 on the client; Supabase (remote) for auth, Postgres, and the `ai-proxy` Edge Function. No SSR.

## Running the app

```bash
npx vite --port 5173 --host     # hosted Supabase (reads .env.local)
make dev                         # same, via scripts/serve-dev.js (opens firewall on Win)
```

- **Port 5173 is not optional** — `supabase/config.toml` pins it as `site_url` and the OAuth redirect. Changing ports breaks Supabase Auth locally.
- `--host` is required inside devcontainers so the host browser can reach Vite.
- **Dev-only UI mode:** if `VITE_SUPABASE_URL` is absent, `AuthContext` skips auth and renders the UI directly. Use this to iterate on visuals without a backend; AI/DB/auth features will not work.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npx vite --port 5173 --host` (or `make dev`) |
| Build (type-check + bundle) | `npm run build` |
| Lint | `npm run lint` |
| Unit tests (skips smoke) | `npm test` / `npm run test:watch` |
| Single test file | `npx vitest run src/services/openai.test.ts` |
| Single test by name | `npx vitest run -t "fallback chat provider"` |
| Coverage (v8, thresholds in `vite.config.ts`) | `npm run test:coverage` |
| Smoke tests (real API keys, costs money) | `npm run test:models:smoke` / `test:models:matrix` / `test:api:complete` |
| Supabase: link / db push / deploy fn | `make supabase-link` / `supabase-db-push` / `supabase-functions-deploy` |

`npm test` **intentionally excludes** `**/*.smoke.test.ts` (see `vite.config.ts`). Smoke suites live under a separate config (`vitest.smoke.config.ts`) and require real provider keys in `.env`.

Hosted Supabase project ref: `gpmjxqprknkqawlzhoku`. Three env files, none committed: `.env.local` (Vite `VITE_*`), `.env` (Supabase CLI/Auth), `supabase/functions/.env` (Edge Function, needs 32-byte hex `ENCRYPTION_KEY`).

## Architecture worth knowing before editing

These patterns span multiple files and will bite if you don't know they exist:

- **Dual AI transport.** Every AI call (chat, STT, TTS, image) can go two routes: direct from the browser using a user-supplied key, or through the `supabase/functions/ai-proxy/` Edge Function which holds encrypted per-user keys. Provider fallback retry lives client-side in `src/services/openai.ts` (primary → secondary on error). Don't add a third path — extend these. (The server-side fallback is a planned follow-up.)
- **Runtime config = Context + snapshot pub/sub.** `src/contexts/RuntimeConfigContext.tsx` is the source of truth (model config, conversation tone, gamification, decrypted API keys). React code uses `useRuntimeConfig()`. Non-React services read `src/services/runtimeConfigSnapshot.ts` via `getSnapshot()` / `getModelConfig()` / `getApiKey(...)` and write via `patchSnapshot(...)`. Writers notify subscribers, and the Provider subscribes via `useSyncExternalStore` — no window events, no singletons.
- **API key resolution order.** Snapshot credentials (hydrated from Supabase encrypted storage) → `VITE_*_API_KEY` env (only in `import.meta.env.DEV`) → throw with "Go to Settings" message. Respect this precedence when adding providers.
- **Storage facade.** `src/services/storage.ts` is a thin facade: sync reads pull from the snapshot; async writes delegate to `src/services/supabase/storage.ts`. In dev mode (no `VITE_SUPABASE_URL`) writes are no-ops. There's no active localStorage layer — `/migrate` is a one-way legacy migration path only.
- **Session revoked = redirect.** `edgeFunctionFetch` in `src/services/supabase/storage.ts` throws `SessionRevokedError` and calls `supabase.auth.signOut()` when refresh fails. `AuthContext` listens to `SIGNED_OUT` and hard-redirects to `/login` unless already on a public path.
- **Live session strategy.** `GeminiLiveSession` and `OpenAIRealtimeLiveSession` implement the same informal interface (`connect/startMicrophone/stopMicrophone/sendTextMessage/disconnect`) consumed by `src/services/liveSession.ts`. Keep them symmetric.
- **Groq dev proxy.** `vite.config.ts` rewrites `/api/groq/*` → `https://api.groq.com/openai/v1/*` to dodge CORS in dev. Production must not rely on this; it goes through `ai-proxy` instead.
- **Styling is token-driven.** All colors live as HSL CSS variables in `src/index.css` (including mode-specific `--mode-*` / `--mode-*-soft`). Never hardcode hex; use `text-foreground`, `bg-card`, or `hsl(var(--mode-phrases))` inline.
- **TS strictness:** `verbatimModuleSyntax` + `erasableSyntaxOnly` are on. Type-only imports **must** use `import type`; no enums, no namespaces, no parameter properties.
- **Node 20+ required.** `engines.node >= 20` in `package.json` and `.nvmrc` pin it. Lower versions trip `ERR_REQUIRE_ESM` in jsdom's transitive deps — `npm test` just won't boot. Husky pre-commit runs `lint-staged`; full lint + build + test run in CI (`.github/workflows/ci.yml`, node 20).

## GSD Workflow Enforcement (top-level rule)

Before using Edit/Write tools, enter work through a GSD command so `.planning/` artifacts stay in sync: `/gsd:quick` (small fixes), `/gsd:debug` (bugs), `/gsd:execute-phase` (planned work). Bypass only if the user explicitly asks.
