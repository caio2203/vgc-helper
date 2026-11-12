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
  `src/analysis` holds the team analysis and suggestions; `@vgc-helper/engine/damage` wraps
  `@smogon/calc` (Champions = generation 0) with numbers from the snapshot and is a separate
  entry so the web app loads it on demand.
- `packages/data` — zod schemas (`src/schemas`), Node loaders (`@vgc-helper/data/node`),
  generated `snapshots/`, hand-curated `manual/`, and `overrides/`. `manual/analysis.json`
  holds the analysis rules (ability matchups, roles, archetypes, thresholds, suggestion
  weights); the builder copies it into the manifest, so run `pnpm snapshot:build` after editing.
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
- The GitHub App (`BOT_APP_ID`, `BOT_APP_PRIVATE_KEY`) is installed: `Update data`,
  `Release Please` and `Screenshots` open pull requests that run CI.
- Vercel's function runtime cannot `require()` ES modules: never add a CommonJS dependency that
  requires an ESM-only package (Nest 12 is ESM-only). CI checks this.
- Phase 2 is done: `DESIGN.md` (approved), team builder, legality, Showdown paste
  import/export, search, shortcuts, My teams, settings, PWA (app shell only, `/api` is never
  cached), brand images (`pnpm --filter @vgc-helper/web brand`) and README screenshots
  (`pnpm --filter @vgc-helper/web screenshots`, after `pnpm build`).
- Phase 3 is done: analysis column (type matrix, stacked weaknesses, roles, archetypes, speed
  tiers, meta threats), suggestions with an explained score, experience levels, useful/not
  useful feedback (`/api/feedback`), damage calculator (`/calc`), the README GIFs in English and
  Portuguese (`screenshots/demo.spec.ts`), top-cut data from the Limitless API as a score bonus
  (`scripts/src/snapshot/limitless.ts`, config per regulation format in `manual/champions.json`)
  and the Admin page (`/admin`: data status, pipeline warnings saved in the manifest, feedback).
- Phase 4 is done: the builder diffs the new snapshot against the committed one
  (`scripts/src/snapshot/diff.ts`), refuses a legal species or move list that changes by more
  than 30% unless run with `--accept-large-changes`, and appends structured changes to
  `snapshots/changelog.json` (schema in `src/schemas/changelog.ts`, served at
  `/api/snapshots/changelog`). `--report <file>` writes the English Markdown report
  (`report.ts`) that `Update data` uses as the PR body. The web renders changes from i18n
  templates (`src/changes/describe.ts`) on `/whats-new`; the read state is the
  `whatsNewSeenVersion` setting. `@vgc-helper/engine` `revalidateTeam` checks saved teams
  (legality in their regulation and in the one in force, plus the history changes that touch
  them) on My teams and in the builder. The e2e tests stub the changelog with `page.route`.
- Phase 5 is done: `teamPreview` in `@vgc-helper/engine/damage` (`src/damage/preview.ts`;
  the calc itself moved to `damage/calc.ts`) scores every matchup (best hit both ways, speed
  with item multipliers) with the `preview` weights of each analysis profile, then every pick of
  `format.pickCount` members by coverage plus checklist roles, and its best lead by pressure plus
  `leadRoles`. Fields missing from the opponent's list come from the usage data (Megas looked up
  by their battle forme). The web page is `/preview`; the opponent's list stays in
  `sessionStorage`. Scroll containers with `sr-only` children need `relative`, or the hidden
  text widens the page on phones.
- Phase 6 is done: optional AI in `apps/api/src/ai` (`LlmProvider` interface in `llm.ts`,
  `GeminiProvider` on `@google/genai` 2.x with function calling, prompts in `prompts.ts`). The
  client sends only the team; the API runs `summarizeTeam` (`@vgc-helper/engine/damage`
  `summary.ts`) and gives the model that JSON plus the snapshot tools `getUsage`,
  `getCommonSet`, `checkLegality`. Answers are cached in `ai_responses` (key: kind, team,
  snapshot version, locale, level, model, messages), which also counts `AI_DAILY_LIMIT`.
  Without `GEMINI_API_KEY` the routes answer `disabled` and the web hides Explain and the chat;
  that is a feature switch, not an auth fallback. Tests pass a fake provider to `createApp`;
  e2e stubs `/api/ai/*` with `page.route`. Never paste or handle the key: the owner adds it with
  `vercel env add GEMINI_API_KEY` (docs/setup.md 2.8).
- Phase 7 is done: the Singles profile in `manual/analysis.json` checks hazards, removal, pivots,
  win conditions, wallbreakers, walls (reliable recovery) and priority. Role rules gained the
  `baseStat` kind (any listed sum of base stats reaches `min`); archetypes have `profiles`
  (Tailwind and Trick Room are Doubles only). The Singles usage cutoff is 3% (note in
  `manual/champions.json`).
- Next: Phase 8 — Scarlet/Violet and Smogon formats.
