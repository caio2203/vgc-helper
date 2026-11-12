import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

const SINGLES_TEAM = `Dragonite @ Lum Berry
Ability: Multiscale
EVs: 2 HP / 32 Atk / 32 Spe
Adamant Nature
- Dragon Dance
- Extreme Speed
- Earthquake
- Fire Punch

Hippowdon @ Leftovers
Ability: Sand Stream
EVs: 32 HP / 32 Def / 2 SpD
Impish Nature
- Slack Off
- Earthquake
- Whirlwind
- Yawn

Gholdengo @ Choice Scarf
Ability: Good as Gold
EVs: 2 HP / 32 SpA / 32 Spe
Timid Nature
- Make It Rain
- Shadow Ball
- Trick
- Focus Blast`;

test('Ranked Singles checks hazards, win conditions, wallbreakers and walls', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByLabel('Team name').waitFor();
  await page.getByLabel('Format').selectOption({ label: 'Ranked Singles' });
  await pasteOnPage(page, SINGLES_TEAM);
  await expect(page.getByText('Hippowdon').first()).toBeVisible();
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Analysis/ }).click();

  const analysis = page.getByRole('region', { name: 'Analysis' });
  await expect(analysis.getByText('Win condition', { exact: true })).toBeVisible();
  await expect(analysis.getByText('Wallbreaker', { exact: true })).toBeVisible();
  await expect(analysis.getByText('Wall', { exact: true })).toBeVisible();
  await expect(analysis.getByText('Entry hazards', { exact: true })).toBeVisible();
  // Doubles roles are not part of the Singles checklist.
  await expect(analysis.getByText('Fake Out', { exact: true })).toHaveCount(0);
  await expectNoA11yViolations(page);
});
