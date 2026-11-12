# Contributing

Thanks for helping. Bug reports, data fixes and suggestions are all welcome.

## Before you start

- For a bug or an idea, [open an issue](https://github.com/caio2203/vgc-helper/issues/new/choose) first,
  so we can agree on the approach before you write code.
- For **wrong competitive data** (usage, sets, a move a Pokémon no longer learns) or a **new
  regulation**, use the matching issue template. Include a link to your source.
- For security problems, follow [SECURITY.md](SECURITY.md) instead of opening an issue.

## Setup

Requirements: Node.js 24 and pnpm 12 (`npm install -g pnpm@12`).

```bash
pnpm install
cp .env.example .env        # then fill it in, see docs/setup.md
pnpm hash-password          # paste the output into ADMIN_PASSWORD_HASH (PowerShell: pnpm.cmd hash-password)
pnpm dev                    # web on http://localhost:5173, API on :3000
```

## Project layout

| Path              | What it is                                                       |
| ----------------- | ---------------------------------------------------------------- |
| `apps/api`        | NestJS API: login, sessions, settings, teams, snapshot delivery  |
| `apps/web`        | React + Vite single-page app                                     |
| `packages/engine` | Pure analysis engine, no I/O. Runs in the browser and in the API |
| `packages/data`   | zod schemas, loaders and the versioned data snapshots            |
| `packages/shared` | DTOs shared by the API and the web app                           |
| `scripts`         | Data pipeline that builds the snapshots                          |

## Rules that keep the project working

1. **No competitive data in code.** Regulations, legality, usage, move changes and rule numbers
   live in `packages/data` (generated snapshots, `manual/` and `overrides/`). Code reads them.
2. **Every number shown in the app has a source and a date.** New data needs a `source` entry.
3. **Every API route needs a session** unless it is deliberately public. See
   [docs/security.md](docs/security.md). The CI fails if a route answers without one.
4. **Tests.** The engine must stay covered by unit tests. Add a test for every bug fix.

## Data changes

- Automatic data comes from `pnpm snapshot:build`. Do not edit files in
  `packages/data/snapshots` by hand.
- To correct the automatic data, add an entry to `packages/data/overrides/<game>.json` with a
  `reason` and a `source`. The builder fails if an override points at something that no longer
  exists, so stale fixes get noticed.
- Rule dates, timers and clauses are in `packages/data/manual/<game>.json`.

## Commits and pull requests

- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(web): …`,
  `fix(engine): …`, `docs: …`, `chore(data): …`. A commit hook checks the message.
- Keep pull requests small and focused. Fill in the template.
- Before pushing, run:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Forks

You are free to fork and run your own copy under the Apache 2.0 license. Please keep the
`NOTICE` file and the "Created by caio2203" credit in the app.
