import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage, TEAM_WITH_ERROR } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Team · 0 / 6' })).toBeVisible();
});

test('adding a Pokémon by typing shows its types and level 50 stats', async ({ page }) => {
  await page.getByLabel('Pokémon').fill('incin');
  await page.getByRole('option', { name: /Incineroar/ }).click();

  await expect(page.getByRole('heading', { name: 'Team · 1 / 6' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Incineroar/ })).toBeVisible();
  // Base HP 95, no Stat Points, IVs 31: 95 + 75 + 60 = 170 at level 50.
  await expect(page.getByRole('row', { name: /^HP/ })).toContainText('170');
  await expectNoA11yViolations(page);
});

test('a pasted team is checked against the regulation and Ctrl+Z undoes it', async ({
  page,
}, info) => {
  await pasteOnPage(page, TEAM_WITH_ERROR);
  await expect(page.getByRole('heading', { name: 'Team · 2 / 6' })).toBeVisible();
  // Phones show the analysis in its own tab.
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: /^Analysis/ }).click();
  }

  await expect(
    page.getByText('Slot 1 (Incineroar): cannot learn Knock Off in this game.'),
  ).toBeVisible();
  await expectNoA11yViolations(page);

  await page.keyboard.press('Control+z');
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Team', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Team · 0 / 6' })).toBeVisible();
});

test('number keys select slots and the palette places a Pokémon', async ({ page }) => {
  await pasteOnPage(page, TEAM_WITH_ERROR);
  await expect(page.getByRole('heading', { name: 'Team · 2 / 6' })).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.getByRole('heading', { name: /^Garchomp/ })).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search and commands' }).fill('rillaboom');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /^Rillaboom/ })).toBeVisible();

  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a saved team appears in My teams and can be duplicated', async ({ page }, info) => {
  // Both projects share one in-memory database, so each saves its own team.
  const name = `Sun test ${info.project.name}`;
  await pasteOnPage(page, TEAM_WITH_ERROR);
  await page.getByLabel('Team name').fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved')).toBeVisible();
  await expect(page).toHaveURL(/\/teams\/[\w-]+$/);

  await page.getByRole('link', { name: 'My teams' }).click();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Duplicate ${name}` }).click();
  await expect(page.getByRole('link', { name: `${name} (copy)` })).toBeVisible();
  await expectNoA11yViolations(page);
});
