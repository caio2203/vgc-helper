import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pickSpecies } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

test('the calculator fills common sets and shows the damage range', async ({ page }) => {
  await page.goto('/calc');
  await expect(page.getByRole('heading', { name: 'Damage calculator' })).toBeVisible();
  await pickSpecies(page, 'Attacker', 'garch', 'Garchomp');
  await pickSpecies(page, 'Defender', 'incin', 'Incineroar');
  const attacker = page.getByRole('region', { name: 'Attacker' });
  await attacker.getByLabel('Move').selectOption({ label: 'Earthquake · Ground · 100' });

  const result = page.getByRole('region', { name: 'Result' });
  await expect(result).toContainText(/\d+(\.\d)?%–\d+(\.\d)?%/);
  await expect(result).toContainText('Garchomp Earthquake vs.');
  await expectNoA11yViolations(page);
});
