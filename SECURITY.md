# Security policy

VGC Helper is built to run as a **private, single-owner instance**: every route needs a
session, only allowlisted GitHub accounts (or the local admin password) can sign in, and the
API refuses to start when authentication is not configured. A flaw that lets someone else in
is the most serious kind of bug this project can have.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting instead:

1. Open the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Describe what you found, how to reproduce it and what an attacker could do with it.

Only the maintainer can see these reports. You should get a first answer within a week.

Things that are in scope:

- reaching any page or API route without a valid session;
- signing in with an account that is not on `AUTH_ALLOWED_GITHUB_IDS`;
- CSRF, session fixation, or a way to steal or reuse a session cookie;
- leaking secrets, tokens or data through responses, logs, headers or the build output;
- spending someone's Gemini quota without being signed in.

## Supported versions

Only the latest commit on `main` is supported. If you run your own copy, keep it updated.

## Running your own instance safely

- Never commit `.env` files. Put secrets in your host's environment settings.
- Use the numeric GitHub id in `AUTH_ALLOWED_GITHUB_IDS`, not your username.
- Keep Vercel Authentication on for all deployments if you host on Vercel.

See [docs/security.md](docs/security.md) for how the protections work.
