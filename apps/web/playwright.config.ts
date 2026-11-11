import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export const E2E_ORIGIN = `http://localhost:${PORT}`;
/** Test-only password for the throwaway in-memory instance the tests start. */
export const E2E_PASSWORD = 'e2e-only-password-not-a-secret';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
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
      SERVE_WEB_DIR: fileURLToPath(new URL('./dist', import.meta.url)),
    },
  },
});
