# VGC Helper — guide for coding agents

Open-source team builder for competitive Pokémon. VGC (Doubles) first, Singles second.
The app analyses a team against the current meta with a deterministic rule engine and explains
every suggestion with data, a source and a date. Pokémon Champions is the first game; the data
model is open for Scarlet/Violet and Smogon formats later.

## Commands

```bash
pnpm install
pnpm dev               # web :5173 (proxies /api) + API :3000; needs .env (see .env.example)
pnpm build             # all packages and apps (turbo)
pnpm lint              # biome check
pnpm format            # biome check --write
pnpm typecheck
pnpm test              # vitest in every package
pnpm --filter @vgc-helper/web e2e    # Playwright + axe; run `pnpm build` first
pnpm snapshot:build    # rebuild packages/data/snapshots from Showdown + Smogon
pnpm db:generate       # new Drizzle migration after editing apps/api/src/db/schema.ts
pnpm hash-password     # ADMIN_PASSWORD_HASH for AUTH_MODE=local-password
```

## Layout

- `apps/api` — NestJS 12 (ESM). `src/app.factory.ts` builds the app for local runs (`main.ts`),
  Vercel (`vercel.ts`, called from `/api/index.js`) and tests. Drizzle + libSQL; migrations in
  `apps/api/drizzle`, applied at boot for local files and in the Vercel build for Turso.
- `apps/web` — React 19 + Vite SPA, TanStack Router (code-based routes in `src/router.tsx`) and
  Query, react-i18next (`src/i18n/locales/{en,pt-BR}.json`).
- `packages/engine` — pure analysis code. No I/O, no fetch, no Node APIs: it runs in the browser.
- `packages/data` — zod schemas (`src/schemas`), Node loaders (`@vgc-helper/data/node`),
  generated `snapshots/`, hand-curated `manual/`, and `overrides/`.
- `packages/shared` — zod DTOs shared by API and web.
- `scripts` — the data pipeline (`src/snapshot/build.ts`).
- One Vercel project: static web from `apps/web/dist`, NestJS as the function in `/api`,
  config in `vercel.json`.

## Rules

1. **No competitive data in code.** Legality, usage, mechanics numbers (Stat Points, PP formula,
   status chances), dates and bans come from `packages/data`. If you need a number, add it to
   `manual/*.json` or a schema, with a `source`.
2. **Every number shown in the UI has a source and a date** taken from the snapshot.
3. **Deny by default.** Every API route needs a session. `@Public()` / `@CronOnly()` routes must
   be added to the allowlist in `apps/api/test/routes-require-auth.test.ts` and to
   `docs/security.md`. Writes need `Origin` + the `x-csrf-token` header.
4. **Fail closed.** Never add a fallback that starts the API without auth configured.
5. Snapshots are generated: change the builder or add an override, never hand-edit snapshot JSON.
6. Imports in Node packages use `.js` extensions (ESM, `module: nodenext`). The web app uses
   extensionless imports (`moduleResolution: bundler`).
7. In `apps/api`, keep class imports used for dependency injection as value imports
   (decorator metadata needs them). Inject config and the database with `@Inject(APP_CONFIG)` /
   `@Inject(DB)`.
8. UI text goes through i18n in both languages. No exclamation marks, no marketing words.
   Pokémon, move, item and ability names stay in English (Showdown paste compatible).
9. Before any new screen, follow `DESIGN.md` (Phase 2). Take Playwright screenshots (desktop and
   mobile, light and dark) and run axe.
10. Commits: small, English, Conventional Commits. Commits and PRs carry no AI-assistant
    attribution or co-author trailers. Push only after the owner approves the phase.
11. Update `README.md`, `README.pt-BR.md` and this file when a change affects what they describe.

## Status

- Phase 0 (research) and Phase 1 (foundation) are done: monorepo, auth, database, i18n,
  Champions Reg M-C snapshot, CI, and the production deploy on Vercel + Turso with GitHub login.
- Preview deployments are set up (password login, separate preview database).
- Setup still open (owner): the GitHub App for data and release pull requests
  (`docs/setup.md`, step 3).
- Vercel's function runtime cannot `require()` ES modules: never add a CommonJS dependency that
  requires an ESM-only package (Nest 12 is ESM-only). CI checks this.
- Next: Phase 2 — `DESIGN.md` (wait for the owner's approval), team builder, legality,
  Showdown paste import/export, search, shortcuts.
