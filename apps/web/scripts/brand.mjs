// Generates the brand images: the favicon, the PWA and Apple icons and the GitHub social preview.
// `pnpm --filter @vgc-helper/web brand`. Everything is drawn from the DESIGN.md tokens, the
// LogoMark in src/components/Logo.tsx and the species types in the data snapshot.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const web = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const read = (path) => readFileSync(web(path), 'utf8');

const tokensCss = read('src/styles/tokens.css');
const typeColorsCss = read('src/styles/type-colors.css');

/** Light and dark values of one token, in the order tokens.css defines them. */
function token(name) {
  const values = [...tokensCss.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'gi'))];
  if (values.length < 2) throw new Error(`tokens.css needs a light and a dark --${name}`);
  return { light: values[0][1], dark: values[1][1] };
}
const ink = token('ink');

// The mark is read from the component, so the icons cannot drift from the logo in the app.
const logo = read('src/components/Logo.tsx');
const viewBox = logo.match(/viewBox="([^"]+)"/)?.[1];
const paths = [...logo.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
if (!viewBox || paths.length !== 2) throw new Error('LogoMark not found in Logo.tsx');
const markSvg = (fill, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}" fill="${fill}" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;

const require = createRequire(import.meta.url);
const fontFile = require.resolve(
  '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2',
);
const fontBase64 = readFileSync(fontFile).toString('base64');

const dex = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../packages/data/snapshots/champions/M-C/dex.json', import.meta.url),
    ),
    'utf8',
  ),
);
/** A few common VGC picks for the preview; their types always come from the snapshot. */
const team = ['incineroar', 'rillaboom', 'garchomp', 'pelipper'].map((id) => {
  const species = dex.species.find((s) => s.id === id);
  if (!species) throw new Error(`${id} is not in the snapshot`);
  return species;
});

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`wrote ${path}`);
}

// 1. Favicon: the mark in ink, switching with the system theme.
write(
  web('public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
<title>VGC Helper</title>
<style>path{fill:${ink.light}}@media (prefers-color-scheme:dark){path{fill:${ink.dark}}}</style>
${paths.map((d) => `<path d="${d}"/>`).join('\n')}
</svg>
`,
);

const browser = await chromium.launch();

/** Renders an HTML body of the given size to a PNG file. */
async function render(path, { width, height }, body, css = '') {
  const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'light' });
  await page.setContent(
    `<!doctype html><html><head><style>
@font-face { font-family: 'Archivo'; src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
  font-weight: 100 900; font-stretch: 62% 125%; }
${tokensCss}
${typeColorsCss}
html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
body { background: var(--bg); color: var(--ink); font-family: 'Archivo', sans-serif;
  font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
${css}
</style></head><body>${body}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, omitBackground: false });
  await page.close();
  console.log(`wrote ${path}`);
}

// 2. App icons: the ink mark on paper. `scale` is the share of the side the mark takes.
const icon = (size, scale) => [
  { width: size, height: size },
  `<div class="icon">${markSvg(ink.light, Math.round(size * scale))}</div>`,
  '.icon { width: 100%; height: 100%; display: grid; place-items: center; }',
];
await render(web('public/icons/icon-192.png'), ...icon(192, 0.72));
await render(web('public/icons/icon-512.png'), ...icon(512, 0.72));
// Maskable: the mark stays inside the 80% safe-zone circle (its corners at most 40% from center).
await render(web('public/icons/maskable-512.png'), ...icon(512, 0.5));
await render(web('public/icons/apple-touch-icon.png'), ...icon(180, 0.62));

// 3. GitHub social preview, 1280 × 640.
const chip = (type) =>
  `<span class="chip" style="background: var(--type-${type.toLowerCase()}-fill)">${type}</span>`;
const edge = ([a, b]) =>
  b
    ? `linear-gradient(var(--type-${a.toLowerCase()}-fill) 50%, var(--type-${b.toLowerCase()}-fill) 50%)`
    : `var(--type-${a.toLowerCase()}-fill)`;
const rows = team
  .map(
    (s, i) => `<li>
  <span class="edge" style="background: ${edge(s.types)}"></span>
  <span class="kbd">${i + 1}</span>
  <span class="slot"><span class="name">${s.name}</span><span class="chips">${s.types.map(chip).join('')}</span></span>
</li>`,
  )
  .join('');

await render(
  fileURLToPath(new URL('../../../docs/images/social-preview.png', import.meta.url)),
  { width: 1280, height: 640 },
  `<main>
  <section class="intro">
    <div class="logo">${markSvg('currentColor', 72)}<span>VGC Helper</span></div>
    <p class="tagline">Build competitive Pokémon teams and see what the team is weak to,
      what it is missing and what the meta is running.</p>
    <p class="label">Open source · VGC Doubles first · English and Português</p>
  </section>
  <section class="panel" aria-label="Team">
    <h2 class="label">Team · ${team.length} / 6</h2>
    <ol>${rows}</ol>
  </section>
</main>`,
  `
main { box-sizing: border-box; height: 100%; padding: 80px; display: grid;
  grid-template-columns: 1fr 440px; gap: 64px; align-items: center; }
.logo { display: flex; align-items: center; gap: 16px; font-size: 64px; line-height: 72px;
  font-weight: 750; font-stretch: 112%; letter-spacing: -0.01em; }
.tagline { margin: 32px 0 0; max-width: 34ch; font-size: 28px; line-height: 38px; }
.label { margin: 0; font-size: 16px; line-height: 20px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted); }
.intro .label { margin-top: 32px; }
.panel { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
.panel h2 { padding: 16px 20px; border-bottom: 1px solid var(--line); }
ol { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: center; gap: 16px; min-height: 84px;
  border-bottom: 1px solid var(--line); padding-right: 20px; }
li:last-child { border-bottom: 0; }
.edge { align-self: stretch; width: 6px; flex-shrink: 0; }
.kbd { margin-left: 10px; min-width: 28px; height: 28px; display: inline-grid; place-items: center;
  border: 1px solid var(--line-strong); border-radius: 4px; font-size: 15px; font-weight: 600;
  color: var(--muted); }
.slot { display: flex; flex-direction: column; gap: 6px; }
.name { font-size: 22px; line-height: 28px; font-weight: 650; }
.chips { display: flex; gap: 6px; }
.chip { border-radius: 4px; padding: 1px 9px; font-size: 16px; line-height: 22px; font-weight: 600; }
`,
);

await browser.close();
