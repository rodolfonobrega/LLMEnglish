# Repository Guidelines

## Project Structure & Module Organization
- Main application code lives in `src/`.
- UI pages/components are grouped by domain in `src/components/` (e.g., `discovery/`, `review/`, `live-roleplay/`, `library/`, `settings/`, `layout/`, `shared/`, `ui/`).
- Business logic and integrations are in `src/services/` (OpenAI/Gemini APIs, spaced repetition, storage, gamification).
- Reusable hooks are in `src/hooks/`; shared types in `src/types/`; helpers in `src/utils/`; app config in `src/config/`.
- Build output is generated in `dist/` (do not edit manually).

## Build, Test, and Development Commands
- `npm run dev`: starts Vite dev server.
- `npm run build`: type-checks (`tsc -b`) and creates production bundle.
- `npm run preview`: serves the production build locally.
- `npm run lint`: runs ESLint for `ts/tsx` files.
- `make dev | build | preview | lint`: preferred wrappers for local workflows.
- `make docker-build` and `make docker-run`: build and run container on `http://localhost:8888`.

## Coding Style & Naming Conventions
- Language: TypeScript + React (functional components).
- Indentation: 2 spaces; keep code `strict`-mode compatible (`tsconfig.app.json`).
- Components, pages, and types use `PascalCase` filenames (e.g., `PracticePage.tsx`, `card.ts` for domain models when already established).
- Hooks use `use*` naming (e.g., `useAudioRecorder.ts`).
- Run `npm run lint` before opening a PR; follow ESLint defaults in `eslint.config.js` (`@eslint/js`, `typescript-eslint`, `react-hooks`, `react-refresh`).

## Testing Guidelines
- Framework: `Vitest` (`jsdom` environment) with coverage via `@vitest/coverage-v8`.
- Run:
  - `npm run test` for the full suite
  - `npm run test:coverage` for coverage report
  - `npm run test:models:mock` for model integration tests using mocks
  - `npm run test:models:smoke` for real API smoke checks (requires `.env` keys)
- Keep tests near source files (e.g., `src/services/*.test.ts`) and prioritize service-level behavior (fallbacks, errors, provider routing).

## Commit & Pull Request Guidelines
- Follow Conventional Commit style seen in history: `feat: ...`, `fix: ...`, `refactor: ...`.
- Keep commits focused and atomic; use imperative summaries.
- PRs should include:
  - Clear scope and rationale
  - Linked issue/task when applicable
  - UI screenshots/GIFs for visual changes
  - Verification steps (commands run and manual scenarios tested)

## Security & Configuration Tips
- Never commit real API keys. Use `.env.example` as template.
- App settings/keys may be stored client-side; review changes that touch `storage.ts` and settings flows carefully.
