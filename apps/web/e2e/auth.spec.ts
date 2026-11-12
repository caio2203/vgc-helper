import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, signIn } from './support';

test.use({ locale: 'en-US' });

test('a signed-out visitor only sees the login screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Created by')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('a wrong password shows an error that says what to do', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the login is rate limited; one project covers it');
  await signIn(page, 'not the password');
  await expect(page.getByRole('alert')).toHaveText('Wrong password. Try again.');
});

test('signing in opens the builder, the language follows the account and signing out locks again', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'the login is rate limited; one project covers it');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Team · 0 / 6' })).toBeVisible();
  await expect(page.getByLabel('Regulation')).toHaveValue(/M-C/);

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByLabel('Language').selectOption('pt-BR');
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await page.getByLabel('Idioma').selectOption('en');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page.getByRole('button', { name: /Sign out/ }).click();
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
