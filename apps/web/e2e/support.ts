import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { E2E_PASSWORD } from './instance';

export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

export async function signIn(page: Page, password = E2E_PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Dispatches a paste event outside any text field, as Ctrl+V on the page would. */
export async function pasteOnPage(page: Page, text: string) {
  await page.evaluate((value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
  }, text);
}

/** A Showdown paste with one move Incineroar cannot learn in Champions (Knock Off). */
export const TEAM_WITH_ERROR = `Incineroar @ Sitrus Berry
Ability: Intimidate
Level: 50
EVs: 32 HP / 2 Atk / 16 Def / 16 SpD
Careful Nature
- Fake Out
- Flare Blitz
- Parting Shot
- Knock Off

Garchomp @ Choice Scarf
Ability: Rough Skin
EVs: 32 Atk / 32 Spe / 2 HP
Jolly Nature
- Earthquake
- Dragon Claw
- Rock Slide
- Protect`;

/** Three members weak to Ground (and Fighting), for the stacked-weakness alert. */
export const TEAM_WEAK_TO_GROUND = `Incineroar @ Sitrus Berry
Ability: Intimidate
EVs: 32 HP / 2 Def / 32 SpD
Careful Nature
- Fake Out
- Flare Blitz
- Parting Shot
- Protect

Kingambit @ Black Glasses
Ability: Defiant
EVs: 32 HP / 32 Atk / 2 SpD
Adamant Nature
- Kowtow Cleave
- Sucker Punch
- Iron Head
- Protect

Archaludon @ Leftovers
Ability: Stamina
EVs: 32 HP / 32 SpA / 2 SpD
Modest Nature
- Electro Shot
- Draco Meteor
- Flash Cannon
- Protect`;
