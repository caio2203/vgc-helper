import { expect, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { api, expectNoA11yViolations } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

const slot = (species: string, item: string, ability: string, moves: string[], nature: string) => ({
  species,
  item,
  ability,
  moves,
  nature,
  spread: { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 },
  ivs: null,
  mega: false,
  teraType: null,
  notes: '',
});

const MY_TEAM = [
  slot(
    'incineroar',
    'sitrusberry',
    'intimidate',
    ['fakeout', 'partingshot', 'flareblitz', 'protect'],
    'adamant',
  ),
  slot(
    'garchomp',
    'choicescarf',
    'roughskin',
    ['earthquake', 'dragonclaw', 'rockslide', 'stompingtantrum'],
    'jolly',
  ),
  slot(
    'kingambit',
    'chopleberry',
    'defiant',
    ['kowtowcleave', 'suckerpunch', 'ironhead', 'protect'],
    'adamant',
  ),
  slot(
    'sneasler',
    'whiteherb',
    'unburden',
    ['closecombat', 'direclaw', 'protect', 'fakeout'],
    'jolly',
  ),
  slot(
    'whimsicott',
    'focussash',
    'prankster',
    ['tailwind', 'moonblast', 'encore', 'protect'],
    'timid',
  ),
  slot(
    'basculegion',
    'mysticwater',
    'adaptability',
    ['lastrespects', 'aquajet', 'wavecrash', 'protect'],
    'adamant',
  ),
];

/** An open team list as players share it: sets without spreads, and one bare name. */
const THEIR_LIST = `Charizard @ Charizardite Y
Ability: Blaze
- Heat Wave
- Solar Beam
- Weather Ball
- Protect

Rillaboom @ Miracle Seed
Ability: Grassy Surge
- Fake Out
- Grassy Glide
- Wood Hammer
- High Horsepower

Indeedee-F @ Rocky Helmet
Ability: Psychic Surge
- Follow Me
- Helping Hand
- Psychic
- Trick Room

Gholdengo
Archaludon
Farigiraf`;

test('team preview picks who to bring and who to lead, with the numbers behind it', async ({
  page,
}, info) => {
  const name = `Preview ${info.project.name}`;
  await api(page.request, 'POST', '/api/teams', {
    name,
    gameId: 'champions',
    formatId: 'champions-vgc',
    regulationId: 'M-C',
    snapshotVersion: 'e2e',
    slots: MY_TEAM,
    notes: '',
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Team preview' }).click();
  await expect(page.getByRole('heading', { name: 'Team preview', level: 1 })).toBeVisible();
  await expect(page.getByText('Paste their team list')).toBeVisible();

  await page.getByLabel('Team', { exact: true }).selectOption({ label: name });
  await page.getByLabel('Team list').fill(THEIR_LIST);

  const pick = page.getByRole('region', { name: 'Bring 4' });
  await expect(pick).toBeVisible();
  await expect(pick.getByText('Lead', { exact: true })).toBeVisible();
  await expect(pick.getByText('Stay home', { exact: true })).toBeVisible();
  await expect(pick).toContainText(/Score [\d.]+:/);

  const matrix = page.getByRole('region', { name: 'Matchups' });
  // Six of theirs as columns, with the Mega Evolution the stone triggers.
  await expect(matrix.getByRole('columnheader')).toHaveCount(7);
  await expect(matrix.getByRole('columnheader', { name: 'Charizard-Mega-Y' })).toBeVisible();
  await expect(matrix.getByRole('rowheader')).toHaveCount(6);

  const answers = page.getByRole('region', { name: 'How the pick handles each of theirs' });
  await expect(answers).toContainText(/Answered by \w+/);
  // The bare names were filled from the usage data, and say so.
  await expect(answers).toContainText('From the usage data: ability, item, moves, and spread.');
  await expect(page.getByText(/Damage from the data snapshot/)).toBeVisible();
  // The matrix scrolls inside its panel; the page itself never scrolls sideways.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoA11yViolations(page);

  // The list stays while the user checks another page.
  await page.goto('/teams');
  await page.goto('/preview');
  await expect(page.getByLabel('Team list')).toHaveValue(THEIR_LIST);
});
