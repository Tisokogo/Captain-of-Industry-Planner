import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoSeriousViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const violations = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact || '')
  );
  expect(
    violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target),
    }))
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('planner has no serious automated WCAG violations', async ({ page }) => {
  await expect(page.locator('main')).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('recipe filter dialog has no serious automated WCAG violations', async ({ page }) => {
  await page.getByRole('button', { name: 'Rezeptfilter' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Rezepte, Maschinen oder Produkte suchen …').fill('sour water');
  await expect(dialog.locator('.recipe-filter-list > button').first()).toBeVisible();
  await expectNoSeriousViolations(page, '.filter-modal');
});
