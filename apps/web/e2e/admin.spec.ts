import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

test('the admin page shows the data status, pipeline warnings and feedback', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Admin', exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible();

  const snapshot = page.getByRole('region', { name: 'Data snapshot' });
  await expect(snapshot).toContainText(/\d{4}-\d{2}-\d{2}\.[0-9a-f]{10}/);
  await expect(page.getByRole('region', { name: 'Pipeline warnings' })).toBeVisible();

  const regulation = page.getByRole('region', { name: /^Regulation Set/ }).first();
  await expect(regulation).toContainText(/battles at rating \d+\+/);
  await expect(regulation).toContainText(/tournaments with \d+\+ players/);

  await expect(page.getByRole('region', { name: 'Suggestion feedback' })).toContainText(
    /ratings|No suggestion rated yet/,
  );
  await expectNoA11yViolations(page);
});
