import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

const REG_G = `Koraidon @ Choice Scarf
Ability: Orichalcum Pulse
Tera Type: Fire
EVs: 4 HP / 252 Atk / 252 Spe
Jolly Nature
- Flare Blitz
- Collision Course
- U-turn
- Close Combat

Incineroar @ Safety Goggles
Ability: Intimidate
Tera Type: Grass
EVs: 252 HP / 4 Atk / 252 SpD
Careful Nature
- Fake Out
- Knock Off
- Parting Shot
- Flare Blitz`;

test('Scarlet/Violet VGC uses EVs, Tera Types and the Reg G rules', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('Team name').waitFor();
  await page.getByLabel('Format').selectOption('sv-vgc');
  await expect(page.getByLabel('Regulation')).toHaveValue('G');
  await pasteOnPage(page, REG_G);
  // The Scarlet/Violet dex loads after the switch; the notice shows once its rules are in.
  // Reg G ended officially; no newer Scarlet/Violet regulation is in the data.
  await expect(page.getByText(/Regulation Set G ended on/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Koraidon', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/No newer regulation of this game is in the data/)).toBeVisible();

  await expect(page.getByLabel('Tera Type')).toHaveValue('Fire');
  await expect(page.getByText('EVs', { exact: false }).first()).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Analysis/ }).click();
  await expect(page.getByText('Legal in Regulation Set G')).toBeVisible();
  await expectNoA11yViolations(page);

  // Smogon OU moves the team to its own ruleset.
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Team/ }).click();
  await page.getByLabel('Format').selectOption('sv-ou');
  await expect(page.getByLabel('Regulation')).toHaveValue('OU');
});
