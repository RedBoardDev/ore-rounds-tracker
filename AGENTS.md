# Repository Guidelines

Practical guide for contributors maintaining the ORE historical rounds collector; aim for reliable, deterministic runs.

## Project Structure & Module Organization
- `src/config`: env schema/loader; update `.env.example` when adding variables.
- `src/shared`: logger, retry helpers; keep pure utilities.
- `src/domain`: entities/interfaces/errors for rounds, tiles, prices.
- `src/application`: orchestrator, use-cases, EV/rng services coordinating domain + infra.
- `src/infrastructure`: SQLite client/repository + `schema.sql`, Solana connection/decoders/fetchers, Discord notifier.
- `src/presentation`: board watcher slot triggers; `scripts/` manage DB init/check/reset; build emits `dist/`, default data path `./data/`.

## Build, Test, and Development Commands
- `yarn install` once, then `yarn dev` (tsx watch `src/index.ts`) with a valid `.env`; `yarn build` -> `dist/`, `yarn start` runs compiled bundle.
- `yarn lint` for ESLint, `yarn typecheck` for strict TS validation; treat both as pre-PR gates.
- `yarn db:init` create schema, `yarn db:check` sanity check state, `yarn db:reset` drops/recreates (destructive—back up `data/` first).

## Coding Style & Naming Conventions
- TypeScript strict + ESM with `.js` import suffixes; 2-space indentation and semicolons.
- Keep side effects in `infrastructure`/`presentation`; keep `domain`/`application` logic pure and composable.
- Prefer `import type` for type-only deps, explicit return types, and `bigint` for slots/IDs.
- Naming: PascalCase classes, camelCase functions/variables, UPPER_SNAKE for shared constants.
- Log via `shared/logger` with structured data; avoid logging secrets or raw env values.

## Testing Guidelines
- No automated suite yet; add focused Node/TS tests for new logic (`*.test.ts` near the module or in `__tests__/`), runnable via `node --test` or `tsx`.
- Always run `yarn lint` + `yarn typecheck`; for functional checks run `yarn db:check` and a short `yarn dev` session against a non-production RPC to confirm startup, notifications, and DB writes.

## Commit & Pull Request Guidelines
- Use concise, present-tense commit messages; prefer Conventional Commit prefixes with a scope (e.g., `feat: infra`, `fix: application`).
- One logical change per commit; update `.env.example` and `schema.sql` (plus relevant scripts) when changing config or DB shape.
- PRs should include intent, env/schema impact, and verification steps (commands run, key logs). Add screenshots or sample log lines when touching notifier output or orchestrator timing.

## Security & Configuration Tips
- Keep secrets in `.env` (already gitignored) and mask RPC or webhook tokens in logs.
- Default database lives at `./data/rounds.db`; prefer `yarn db:check` over `db:reset` on shared environments.
