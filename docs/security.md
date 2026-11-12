# How the instance stays private

The online instance must be reachable only by its owner. The protections are layered, so one
mistake does not open everything.

| Layer                   | Where                                             | What it does                                                                                                                                                            |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Authentication   | Vercel project settings                           | "All Deployments" scope: production and every preview need a Vercel login with access to the project before any request reaches the app.                                |
| Deny by default         | `apps/api/src/auth/session.guard.ts`              | A global guard. Every route needs a valid session unless it is marked `@Public()` or `@CronOnly()`.                                                                     |
| Allowlist by numeric id | `apps/api/src/auth/auth.service.ts`               | Only GitHub ids in `AUTH_ALLOWED_GITHUB_IDS` get a session. Other accounts are sent back to the login screen and nothing is stored for them.                            |
| No setup screen         | —                                                 | The owner is defined only by environment variables. There is no "create the admin" step that someone else could reach first.                                            |
| Fail closed             | `apps/api/src/config/env.ts`                      | The API refuses to start if the login method, its secrets or the session secret are missing. On Vercel it answers 503 instead of running unprotected.                   |
| Sessions                | `apps/api/src/auth/session.service.ts`            | Random 256-bit token in an `httpOnly`, `Secure`, `SameSite=Lax` cookie with the `__Host-` prefix. Only its SHA-256 hash is stored. Logout deletes it from the database. |
| CSRF                    | `session.guard.ts`                                | Writes need a matching `Origin` and an `x-csrf-token` header tied to the session (HMAC of the session id).                                                              |
| Rate limit              | `apps/api/src/security/rate-limit.ts`             | 120 requests per minute per IP overall; 5 per minute on the password login; 10 per minute on the GitHub login.                                                          |
| Headers                 | `apps/api/src/security/headers.ts`, `vercel.json` | CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, and a `robots.txt` that disallows everything.                    |
| Data                    | `apps/api/src/snapshots`                          | Competitive data reaches the browser only through authenticated API routes, never as public static files.                                                               |
| CI check                | `apps/api/test/routes-require-auth.test.ts`       | Calls every registered route without a session and fails unless it answers 401. A new unprotected route breaks the build.                                               |

## Public routes

These are the only routes that answer without a session. Adding one means updating the
allowlist in the CI test and this table.

| Route                           | Why it is public                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /api/health`               | Liveness check. Returns `{"status":"ok"}` and nothing else.                                     |
| `GET /api/auth/methods`         | The login screen needs to know whether to show the GitHub button or the password field.         |
| `GET /api/auth/github`          | Starts the GitHub OAuth flow.                                                                   |
| `GET /api/auth/github/callback` | GitHub sends the browser back here. The `state` cookie is checked before anything else.         |
| `POST /api/auth/login`          | Password login for self-hosted copies. Needs a same-origin `Origin` header and is rate limited. |

`GET /api/internal/keepalive` is not public: it needs `Authorization: Bearer $CRON_SECRET`,
which Vercel Cron sends. Its daily read keeps a free Turso database from being archived after
10 days without use.

## AI (optional)

`/api/ai/status`, `/api/ai/explain` and `/api/ai/chat` need a session like every other route,
and the two POSTs need `Origin` + `x-csrf-token`. Without `GEMINI_API_KEY` they answer
`disabled`; that only hides a feature and does not touch authentication.

- The browser sends the team (slots, format, regulation) and the questions. The API runs the
  engine itself and sends Gemini that analysis, never data the browser computed, and never
  account or session data.
- The key lives only in the API's environment. Error messages from the SDK are not returned to
  the browser.
- Abuse limits: 6 calls per minute per route and IP, `AI_DAILY_LIMIT` answers per user per 24
  hours (cached answers are free). The tools the model can call only read the snapshot.
- The system prompt tells the model to ignore instructions inside the questions; the answer is
  shown as plain text (no HTML), so it cannot inject markup.

## Things to keep in mind

- The in-memory rate limiter is per serverless instance. Vercel Authentication in front of the
  app is what stops strangers from reaching the login at all.
- Never put the instance URL in the repository, issues or screenshots.
