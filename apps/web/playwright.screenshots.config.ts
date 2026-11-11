import { defineConfig } from '@playwright/test';
import { E2E_ORIGIN, testInstance } from './e2e/instance';

// `pnpm --filter @vgc-helper/web screenshots` regenerates the images in docs/images.
export default defineConfig({
  testDir: './screenshots',
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: E2E_ORIGIN },
  webServer: testInstance,
});
