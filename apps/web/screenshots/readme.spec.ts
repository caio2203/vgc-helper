import { fileURLToPath } from 'node:url';
import { type Browser, devices, test } from '@playwright/test';
import { E2E_PASSWORD } from '../e2e/instance';

/**
 * README and docs images: every page × device × theme × language, named
 * `<page>-<device>-<theme>[-pt-BR].png`. Runs against the throwaway instance with demo data
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

type Cookies = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['cookies']>>;

/** Signs in once: the login is rate limited, so every shot reuses this session cookie. */
async function signIn(browser: Browser): Promise<Cookies> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/');
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}

async function shoot(
  browser: Browser,
  options: { device: Device; theme: (typeof THEMES)[number]; locale: string; suffix: string },
  cookies: Cookies,
): Promise<void> {
  const { device, theme, locale, suffix } = options;
  const contextOptions = {
    ...DEVICES[device],
    colorScheme: theme,
    locale,
    timezoneId: 'UTC',
    reducedMotion: 'reduce' as const,
  };
  const path = (name: string) => `${OUT_DIR}${name}-${device}-${theme}${suffix}.png`;

  const signedOut = await browser.newContext(contextOptions);
  const login = await signedOut.newPage();
  await login.goto('/login');
  await login.locator('input[type="password"]').waitFor();
  await login.screenshot({ path: path('login'), fullPage: true });
  await signedOut.close();

  const signedIn = await browser.newContext(contextOptions);
  await signedIn.addCookies(cookies);
  const home = await signedIn.newPage();
  await home.goto('/');
  await home.getByRole('heading', { level: 2 }).waitFor();
  await home.screenshot({ path: path('home'), fullPage: true });
  await signedIn.close();
}

test('README and docs screenshots', async ({ browser }) => {
  test.setTimeout(120_000);
  const cookies = await signIn(browser);
  for (const device of Object.keys(DEVICES) as Device[]) {
    for (const theme of THEMES) {
      for (const { locale, suffix } of LOCALES) {
        await shoot(browser, { device, theme, locale, suffix }, cookies);
      }
    }
  }
});
