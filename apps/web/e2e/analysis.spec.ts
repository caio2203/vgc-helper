import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage, TEAM_WEAK_TO_GROUND } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

test('the analysis flags a stacked weakness, suggests a fix and takes feedback', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('#team-heading')).toContainText('0 / 6');
  await pasteOnPage(page, TEAM_WEAK_TO_GROUND);
  await expect(page.locator('#team-heading')).toContainText('3 / 6');
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /^Analysis/ }).click();
  }

  const panel = page.locator('section[aria-labelledby="analysis-heading"]');
  await expect(panel.getByText('3 members weak to Ground')).toBeVisible();
  await expect(panel.getByText('Adding Archaludon made it 3.').first()).toBeVisible();
  await expect(panel.getByRole('table', { name: /attacking type/ })).toBeVisible();
  await expect(panel.getByText('Calculating damage')).toHaveCount(0);
  await expect(panel.getByText(/Answered by|Nothing on the team answers it/).first()).toBeVisible();
  await expectNoA11yViolations(page);

  // The first suggestion covers the stacked weakness and can be rated and added.
  const first = panel.locator('ol').first().locator('li').first();
  await expect(first).toContainText('Resists');
  await first.getByRole('button', { name: 'Useful', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Useful', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await first.getByRole('button', { name: /^Add / }).click();
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Team', exact: true }).click();
  }
  await expect(page.locator('#team-heading')).toContainText('4 / 6');
});
