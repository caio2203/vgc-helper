import { expect, type Page, test } from '@playwright/test';
import { AUTH_STATE } from './instance';
import { expectNoA11yViolations, pasteOnPage, TEAM_WEAK_TO_GROUND } from './support';

test.use({ locale: 'en-US', storageState: AUTH_STATE });

async function openTeam(page: Page) {
  await page.goto('/');
  await page.getByLabel('Team name').waitFor();
  await pasteOnPage(page, TEAM_WEAK_TO_GROUND);
  await expect(page.getByText('Kingambit').first()).toBeVisible();
}

test('without a Gemini key the AI stays hidden and the analysis works', async ({ page }, info) => {
  // The test instance has no GEMINI_API_KEY.
  await openTeam(page);
  if (info.project.name === 'mobile') await page.getByRole('button', { name: /^Analysis/ }).click();
  await expect(page.getByText('Stacked weakness', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explain' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page.getByText('Off: this instance has no GEMINI_API_KEY.')).toBeVisible();
});

test('Explain and Ask show the answer with its model, and fall back when the AI fails', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile', 'The analysis tab layout is covered on desktop');
  let explainBody: Record<string, unknown> | null = null;
  await page.route('**/api/ai/status', (route) =>
    route.fulfill({ json: { enabled: true, model: 'gemini-test' } }),
  );
  await page.route('**/api/ai/explain', async (route) => {
    explainBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        text: 'Three members are weak to Ground.\n\n- Add a Flying type.\n- Keep Fake Out.',
        model: 'gemini-test',
        cached: false,
        createdAt: '2026-11-12T10:00:00.000Z',
      },
    });
  });
  await page.route('**/api/ai/chat', (route) =>
    route.fulfill({ status: 429, json: { reason: 'quota' } }),
  );

  await openTeam(page);
  const section = page.getByRole('region', { name: 'Analysis' });
  await section.getByRole('button', { name: 'Explain' }).click();
  await expect(section.getByText('Three members are weak to Ground.')).toBeVisible();
  await expect(
    section.getByRole('listitem').filter({ hasText: 'Add a Flying type.' }),
  ).toBeVisible();
  await expect(section.getByText(/Written by gemini-test from this analysis/)).toBeVisible();
  // The client sends the team and its rules, not an analysis.
  expect(explainBody).toMatchObject({
    locale: 'en',
    level: 'intermediate',
    team: { formatId: 'champions-vgc', regulationId: 'M-C' },
  });
  expect(Object.keys(explainBody ?? {}).sort()).toEqual(['level', 'locale', 'team']);

  await section.getByLabel('Ask about this team').fill('What do I change against Trick Room?');
  await section.getByRole('button', { name: 'Ask' }).click();
  await expect(section.getByText('The free Gemini quota is used up for now.')).toBeVisible();
  await expect(section.getByText('The analysis above is complete without it.')).toBeVisible();
  await expectNoA11yViolations(page);
});
