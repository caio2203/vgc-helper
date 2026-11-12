import { fileURLToPath } from 'node:url';
import { type Browser, type BrowserContextOptions, devices, expect, test } from '@playwright/test';
import { E2E_PASSWORD } from '../e2e/instance';
import { pasteOnPage, TEAM_WITH_ERROR } from '../e2e/support';

/**
 * README and docs images: every screen × device × theme × language, named
 * `<screen>-<device>-<theme>[-pt-BR].png`. Runs against the throwaway instance with demo data
 * only, never a real account or instance URL.
 */
const OUT_DIR = fileURLToPath(new URL('../../../docs/images/', import.meta.url));

const DEVICES = {
  desktop: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
  mobile: devices['Pixel 7'],
} as const;
type Device = keyof typeof DEVICES;
const THEMES = ['light', 'dark'] as const;
const LOCALES = [
  { locale: 'en-US', suffix: '' },
  { locale: 'pt-BR', suffix: '-pt-BR' },
] as const;

/** A second demo team for My teams. Only names and types show there. */
const RAIN_TEAM = `Pelipper
Ability: Drizzle
- Hurricane
- Weather Ball
- Tailwind
- Protect

Archaludon
- Electro Shot
- Draco Meteor
- Flash Cannon
- Protect

Sneasler
- Fake Out
- Dire Claw
- Close Combat
- Protect

Kingambit
- Kowtow Cleave
- Sucker Punch
- Swords Dance
- Protect`;

type Cookies = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['cookies']>>;

const BASE: BrowserContextOptions = {
  timezoneId: 'UTC',
  reducedMotion: 'reduce',
  // The service worker would serve the app shell from its cache between shots; keep it out.
  serviceWorkers: 'block',
};

/** Signs in once: the login is rate limited, so every shot reuses this session cookie. */
async function signIn(browser: Browser): Promise<Cookies> {
  const context = await browser.newContext({ ...BASE, locale: 'en-US' });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/');
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}

/** Saves the demo teams that My teams lists. */
async function seedTeams(browser: Browser, cookies: Cookies): Promise<void> {
  for (const [name, paste] of [
    ['Rain', RAIN_TEAM],
    ['Incineroar Garchomp', TEAM_WITH_ERROR],
  ] as const) {
    const context = await browser.newContext({ ...BASE, locale: 'en-US' });
    await context.addCookies(cookies);
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('#team-heading')).toContainText('0 / 6');
    await pasteOnPage(page, paste);
    await page.getByLabel('Team name').fill(name);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved')).toBeVisible();
    await context.close();
  }
}

async function shoot(
  browser: Browser,
  options: { device: Device; theme: (typeof THEMES)[number]; locale: string; suffix: string },
  cookies: Cookies,
): Promise<void> {
  const { device, theme, locale, suffix } = options;
  const contextOptions = { ...BASE, ...DEVICES[device], colorScheme: theme, locale };
  const path = (name: string) => `${OUT_DIR}${name}-${device}-${theme}${suffix}.png`;

  const signedOut = await browser.newContext(contextOptions);
  const login = await signedOut.newPage();
  await login.goto('/login');
  await login.locator('input[type="password"]').waitFor();
  await login.evaluate(() => document.fonts.ready);
  await login.screenshot({ path: path('login'), fullPage: device === 'desktop' });
  await signedOut.close();

  const signedIn = await browser.newContext(contextOptions);
  await signedIn.addCookies(cookies);
  const page = await signedIn.newPage();

  // The builder with one legality error: Incineroar cannot learn Knock Off.
  await page.goto('/');
  await expect(page.locator('#team-heading')).toContainText('0 / 6');
  await pasteOnPage(page, TEAM_WITH_ERROR);
  await expect(page.locator('#team-heading')).toContainText('2 / 6');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path('builder'), fullPage: device === 'desktop' });

  await page.goto('/teams');
  await expect(page.getByRole('link', { name: 'Rain', exact: true })).toBeVisible();
  await page.screenshot({ path: path('teams'), fullPage: device === 'desktop' });

  await page.goto('/settings');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.screenshot({ path: path('settings'), fullPage: device === 'desktop' });
  await signedIn.close();
}

test('README and docs screenshots', async ({ browser }) => {
  test.setTimeout(300_000);
  const cookies = await signIn(browser);
  await seedTeams(browser, cookies);
  for (const device of Object.keys(DEVICES) as Device[]) {
    for (const theme of THEMES) {
      for (const { locale, suffix } of LOCALES) {
        await shoot(browser, { device, theme, locale, suffix }, cookies);
      }
    }
  }
});
