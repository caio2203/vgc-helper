import { type APIRequestContext, expect, type Page, test } from '@playwright/test';
import type { Changelog } from '@vgc-helper/data';
import { AUTH_STATE, E2E_ORIGIN } from './instance';
import { expectNoA11yViolations } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

const OLD = 'e2e-old-snapshot';
const at = { gameId: 'champions', regulationId: 'M-C' };
const ref = (id: string, name: string) => ({ id, name });

/** A history with one data update after `OLD`, ending at the snapshot the API serves. */
function history(current: string): Changelog {
  return {
    schemaVersion: 1,
    entries: [
      {
        version: current,
        previousVersion: OLD,
        generatedAt: '2026-11-12T07:23:00.000Z',
        warnings: [],
        changes: [
          {
            kind: 'regulationDates',
            ...at,
            field: 'endsAt',
            from: '2026-11-25T01:59:00.000Z',
            to: '2026-12-02T01:59:00.000Z',
          },
          {
            kind: 'dexEntries',
            ...at,
            list: 'megas',
            added: [ref('salamencemega', 'Salamence-Mega')],
            removed: [],
          },
          {
            kind: 'moveChanged',
            ...at,
            move: ref('protect', 'Protect'),
            field: 'maxPp',
            from: 16,
            to: 8,
          },
          {
            kind: 'learnset',
            ...at,
            species: ref('incineroar', 'Incineroar'),
            added: [],
            removed: [ref('partingshot', 'Parting Shot')],
          },
        ],
      },
      {
        version: OLD,
        previousVersion: null,
        generatedAt: '2026-11-01T07:23:00.000Z',
        warnings: [],
        changes: [],
      },
    ],
  };
}

async function api(
  request: APIRequestContext,
  method: 'PATCH' | 'POST',
  path: string,
  body: unknown,
) {
  const session = await (await request.get('/api/auth/session')).json();
  const response = await request.fetch(path, {
    method,
    data: body,
    headers: { Origin: E2E_ORIGIN, 'x-csrf-token': session.csrfToken },
  });
  expect(response.ok(), `${method} ${path}`).toBe(true);
  return response.json();
}

/** Serves the history above instead of the committed one, which has no update yet. */
async function useHistory(page: Page): Promise<string> {
  const manifest = await (await page.request.get('/api/snapshots/manifest')).json();
  await page.route('**/api/snapshots/changelog', (route) =>
    route.fulfill({ json: history(manifest.version) }),
  );
  return manifest.version;
}

test("What's new lists every change and marks it as read", async ({ page }) => {
  await api(page.request, 'PATCH', '/api/settings', { whatsNewSeenVersion: null });
  await useHistory(page);
  await page.goto('/teams');

  const link = page.getByRole('link', { name: /What's new/ });
  await expect(link).toContainText('1');
  await link.click();
  await expect(page.getByRole('heading', { name: "What's new", level: 1 })).toBeVisible();

  const main = page.locator('main');
  await expect(main).toContainText('New');
  await expect(main).toContainText('Megas now allowed: Salamence-Mega.');
  await expect(main).toContainText('Protect: PP 16 → 8.');
  await expect(main).toContainText('Incineroar no longer learns Parting Shot.');
  await expect(main).toContainText(/Regulation Set M-C end date: .+ → .+\./);
  await expect(main).toContainText('First snapshot in the history.');
  await expectNoA11yViolations(page);

  // Visiting saves the newest version as read: the count goes away.
  await expect(link).toHaveText("What's new");
  await page.reload();
  await expect(page.getByRole('link', { name: /What's new/ })).toHaveText("What's new");
});

test('saved teams are checked again when the data changes', async ({ page }) => {
  await useHistory(page);
  const slot = {
    species: 'incineroar',
    item: 'sitrusberry',
    ability: 'intimidate',
    // Spore was never legal here: the current data flags it as a problem.
    moves: ['fakeout', 'partingshot', 'flareblitz', 'spore'],
    nature: 'careful',
    spread: { hp: 32, atk: 0, def: 2, spa: 0, spd: 32, spe: 0 },
    ivs: null,
    mega: false,
    teraType: null,
    notes: '',
  };
  const name = `Old data ${test.info().project.name}`;
  const team = await api(page.request, 'POST', '/api/teams', {
    name,
    ...at,
    formatId: 'champions-vgc',
    snapshotVersion: OLD,
    slots: [slot],
    notes: '',
  });

  await page.goto('/teams');
  const row = page.getByRole('row').filter({ hasText: name }).first();
  await expect(row).toContainText('1 problem · 2 changes since saved');
  await page.getByText(`Details for ${name}`).click();
  const details = page.locator('details', { hasText: `Details for ${name}` });
  await expect(details).toContainText('Slot 1 (Incineroar): cannot learn Spore in this game.');
  await expect(details).toContainText('Incineroar no longer learns Parting Shot.');
  await expect(details).toContainText(/Regulation Set M-C end date: /);
  // Protect changed too, but this team does not use it.
  await expect(details).not.toContainText('Protect');
  await expectNoA11yViolations(page);

  await page.goto(`/teams/${team.id}`);
  await expect(page.getByText('The data changed since this team was saved')).toBeVisible();
  await expectNoA11yViolations(page);
});
