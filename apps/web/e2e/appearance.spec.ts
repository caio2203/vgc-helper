import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage, TEAM_WITH_ERROR } from './support';

test.describe('dark theme', () => {
  test.use({ locale: 'en-US', colorScheme: 'dark', storageState: AUTH_STATE });

  test('every screen passes axe in dark mode', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.locator('#team-heading')).toContainText('0 / 6');
    await pasteOnPage(page, TEAM_WITH_ERROR);
    await expect(page.locator('#team-heading')).toContainText('2 / 6');
    await expectNoA11yViolations(page);
    if (info.project.name === 'mobile') {
      await page.getByRole('button', { name: /^Analysis/ }).click();
      await expect(page.getByText(/cannot learn Knock Off/)).toBeVisible();
      await expectNoA11yViolations(page);
    }

    await page.goto('/teams');
    await page.getByRole('heading', { level: 1, name: 'My teams' }).waitFor();
    await expectNoA11yViolations(page);

    await page.goto('/settings');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await expectNoA11yViolations(page);
  });
});

test.describe('dark theme, signed out', () => {
  test.use({ locale: 'en-US', colorScheme: 'dark' });

  test('the login screen passes axe in dark mode', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').waitFor();
    await expectNoA11yViolations(page);
  });
});

test('the app ships a manifest and a service worker that never caches the API', async ({
  request,
  page,
}) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'VGC Helper', display: 'standalone' });
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('denylist:[/^\\/api\\//]');
  // The only route is the navigation fallback: nothing else, /api above all, is cached.
  expect(sw.match(/registerRoute\(/g)).toHaveLength(1);

  await page.goto('/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'crossorigin',
    'use-credentials',
  );
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/favicon.svg');
});
