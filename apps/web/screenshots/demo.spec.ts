import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { devices, expect, type Page, test } from '@playwright/test';
import { E2E_PASSWORD } from '../e2e/instance';
import { pasteOnPage } from '../e2e/support';

/**
 * The README GIF: add a Pokémon → the alert appears → accept a suggestion that covers it. Frames are
 * screenshots of the throwaway instance with demo data, encoded with gifenc in a blank page.
 */
const OUT = fileURLToPath(new URL('../../../docs/images/demo.gif', import.meta.url));
const GIFENC = createRequire(import.meta.url)
  .resolve('gifenc')
  .replace(/gifenc\.js$/, 'gifenc.esm.js');
const SCALE = 0.75;

const TWO = `Incineroar @ Sitrus Berry
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
- Protect`;

test.use({
  ...devices['Desktop Chrome'],
  viewport: { width: 1280, height: 800 },
  locale: 'en-US',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  serviceWorkers: 'block',
});

test('README demo GIF', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const frames: { png: string; delay: number }[] = [];
  const frame = async (p: Page, delay: number) => {
    await p.evaluate(() => document.fonts.ready);
    frames.push({ png: (await p.screenshot()).toString('base64'), delay });
  };

  await page.goto('/login');
  await page.locator('input[type="password"]').fill(E2E_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('#team-heading')).toContainText('0 / 6');
  await pasteOnPage(page, TWO);
  await expect(page.locator('#team-heading')).toContainText('2 / 6');
  await frame(page, 1600);

  // 1. Add a Pokémon.
  await page
    .getByRole('button', { name: /Add Pokémon/ })
    .first()
    .click();
  await page.getByLabel('Pokémon', { exact: true }).fill('archal');
  await frame(page, 1000);
  await page.getByRole('option', { name: /^Archaludon/ }).click();
  const panel = page.locator('section[aria-labelledby="analysis-heading"]');

  // 2. The alert appears.
  await expect(panel.getByText('3 members weak to Ground')).toBeVisible();
  await frame(page, 3200);

  // 3. Accept the first suggestion.
  const first = panel.locator('ol').first().locator('li').first();
  await first.getByRole('button', { name: /^Add / }).hover();
  await frame(page, 1400);
  await first.getByRole('button', { name: /^Add / }).click();
  await expect(page.locator('#team-heading')).toContainText('4 / 6');
  await expect(panel.getByText(/Covered by /).first()).toBeVisible();
  await frame(page, 3200);

  // Encode in a blank page: no CSP there, and the canvas does the PNG decoding.
  const encoder = await browser.newPage();
  const gif = await encoder.evaluate(
    async ({ esm, frames, scale }) => {
      const url = URL.createObjectURL(new Blob([esm], { type: 'text/javascript' }));
      const { GIFEncoder, quantize, applyPalette } = await import(url);
      const out = GIFEncoder();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No canvas');
      for (const f of frames) {
        const img = new Image();
        img.src = `data:image/png;base64,${f.png}`;
        await img.decode();
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = quantize(data, 256);
        out.writeFrame(applyPalette(data, palette), canvas.width, canvas.height, {
          palette,
          delay: f.delay,
        });
      }
      out.finish();
      const bytes: Uint8Array = out.bytes();
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    },
    { esm: readFileSync(GIFENC, 'utf8'), frames, scale: SCALE },
  );
  writeFileSync(OUT, Buffer.from(gif, 'base64'));
  await encoder.close();
});
