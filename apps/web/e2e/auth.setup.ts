import { expect, test as setup } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { signIn } from './support';

setup('sign in once', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await page.context().storageState({ path: AUTH_STATE });
});
