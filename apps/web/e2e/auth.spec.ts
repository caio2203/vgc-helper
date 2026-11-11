import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { E2E_PASSWORD } from './instance';

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

async function signIn(page: Page, password = E2E_PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.use({ locale: 'en-US' });

test('a signed-out visitor only sees the login screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Created by')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('a wrong password shows an error that says what to do', async ({ page }) => {
  await signIn(page, 'not the password');
  await expect(page.getByRole('alert')).toHaveText('Wrong password. Try again.');
});

test('signing in shows the snapshot, switching language works and signing out locks again', async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByText('Signed in as admin')).toBeVisible();
  await expect(page.getByText(/Data snapshot \d{4}-\d{2}-\d{2}\./)).toBeVisible();
  await expect(page.getByText('Regulation Set M-C', { exact: true })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByLabel('Language').selectOption('pt-BR');
  await expect(page.getByText('Conectado como admin')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  await page.reload();
  await expect(page.getByText('Conectado como admin')).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});

test('pages carry the security headers and robots.txt blocks crawlers', async ({ request }) => {
  const page = await request.get('/login');
  const headers = page.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['content-security-policy']).toContain("default-src 'self'");

  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');

  const api = await request.get('/api/settings');
  expect(api.status()).toBe(401);
});
