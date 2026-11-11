import { fileURLToPath } from 'node:url';
import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * The throwaway instance the browser tests and the README screenshots run against:
 * the built API serving the built web app, with an in-memory database and demo data only.
 */
const PORT = 4173;
export const E2E_ORIGIN = `http://localhost:${PORT}`;
/** Test-only password for that in-memory instance. */
export const E2E_PASSWORD = 'e2e-only-password-not-a-secret';

export const testInstance: NonNullable<PlaywrightTestConfig['webServer']> = {
  command: 'node e2e/server.mjs',
  url: `${E2E_ORIGIN}/api/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
  env: {
    NODE_ENV: 'development',
    PORT: String(PORT),
    APP_ORIGIN: E2E_ORIGIN,
    SESSION_SECRET: 'e2e-session-secret-only-for-local-tests',
    AUTH_MODE: 'local-password',
    E2E_PASSWORD,
    DATABASE_URL: ':memory:',
    MIGRATE_ON_BOOT: 'true',
    SERVE_WEB_DIR: fileURLToPath(new URL('../dist', import.meta.url)),
  },
};
