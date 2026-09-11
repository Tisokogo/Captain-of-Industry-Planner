import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('creates a plan, switches language, and restores a saved plan', async ({ page }) => {
  await expect(page.getByText('Produktionsziele', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByText('Production goals', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByPlaceholder('Search products …').fill('water');
  await dialog.getByRole('button').filter({ hasText: /Water/i }).first().click();
  await expect(page.locator('.goal-card')).toHaveCount(2);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('E2E plan');
  await page.getByRole('dialog').getByRole('button', { name: 'Save plan', exact: true }).click();
  const savedTab = page.getByRole('button', { name: 'Saved' });
  if (!(await savedTab.isVisible())) await page.getByRole('button', { name: 'Menü' }).click();
  await savedTab.click();
  await expect(page.getByText('E2E plan')).toBeVisible();
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.getByText('Production goals', { exact: true })).toBeVisible();
});

test('undoes and redoes planner changes', async ({ page }) => {
  const rate = page.locator('.goal-card input[type="number"]').first();
  await rate.fill('21');
  await expect(rate).toHaveValue('21');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(rate).toHaveValue('12');
  await page.getByRole('button', { name: 'Wiederholen' }).click();
  await expect(rate).toHaveValue('21');
});

test('uses progressive result views and compact diagram details', async ({ page }) => {
  await expect(page.locator('.diagram-node.route')).toHaveCount(0);
  await expect(page.locator('.diagram-endpoint').first()).toBeVisible();
  await expect(page.locator('.settings-card')).toHaveCount(0);
  await expect.poll(() => page.locator('.diagram-node').count()).toBeLessThan(40);
  await expect.poll(() => page.locator('.diagram-edge').count()).toBeLessThan(68);

  await page.getByRole('button', { name: /Erweiterte Einstellungen/ }).click();
  await expect(page.locator('.settings-card')).toBeVisible();

  const recipe = page.locator('.diagram-node.recipe').first();
  const compactWidth = (await recipe.boundingBox())!.width;
  await recipe.getByRole('button', { name: 'Gebäudedetails anzeigen' }).click();
  await expect
    .poll(async () => (await recipe.boundingBox())?.width || 0)
    .toBeGreaterThan(compactWidth);

  await page.getByRole('tab', { name: 'Materialien' }).click();
  await expect(page.locator('.result-group')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Gebäude' }).click();
  await expect(page.locator('.result-group')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Bilanz' }).click();
  await expect(page.locator('.balance-kpis')).toBeVisible();
});

test('runs automatic optimization in an on-demand worker', async ({ page }) => {
  await page.getByRole('button', { name: /Erweiterte Einstellungen/ }).click();
  const workerRequest = page.waitForRequest((request) =>
    request.url().includes('calculation.worker')
  );
  await page.getByLabel('Automatische Optimierung').check();
  await workerRequest;
  await expect(page.getByText('Optimierung läuft …')).toBeHidden({ timeout: 15_000 });
});

test('shows edge labels contextually and simplifies cards at low zoom', async ({ page }) => {
  await expect(page.locator('.diagram-edge text')).toHaveCount(0);

  await page.locator('.diagram-node.recipe').first().focus();
  await expect(page.locator('.diagram-edge.is-focused text').first()).toHaveCSS('opacity', '1');

  await page.getByRole('button', { name: 'Verkleinern' }).click();
  await page.getByRole('button', { name: 'Verkleinern' }).click();
  await expect(page.locator('.diagram-zoom-summary').first()).toBeVisible();
});

test('allows every I/O setup section to be collapsed', async ({ page }) => {
  await page.getByRole('tab', { name: 'Ein-/Ausgänge' }).click();
  const sections = page.locator('.summary-section > button');
  await expect(sections).toHaveCount(3);
  await expect(sections.first()).toHaveAttribute('aria-expanded', 'true');
  await sections.first().click();
  for (let index = 0; index < 3; index += 1)
    await expect(sections.nth(index)).toHaveAttribute('aria-expanded', 'false');
});

test('zooms the diagram with the mouse wheel without scrolling the page', async ({ page }) => {
  const viewport = page.locator('.diagram-viewport');
  await viewport.scrollIntoViewIfNeeded();
  const beforeScroll = await page.evaluate(() => window.scrollY),
    beforeTransform = await page.locator('.diagram-world').getAttribute('style');
  await viewport.hover();
  await page.mouse.wheel(0, -240);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(beforeScroll);
  await expect
    .poll(() => page.locator('.diagram-world').getAttribute('style'))
    .not.toBe(beforeTransform);
});

test('pans the diagram without a pointer-state crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const viewport = page.locator('.diagram-viewport');
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 80, box!.y + box!.height / 2 + 40, {
    steps: 8,
  });
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test('lets users drag and persist individual building cards', async ({ page }) => {
  await page.locator('.diagram-viewport').scrollIntoViewIfNeeded();
  const viewportBox = await page.locator('.diagram-viewport').boundingBox();
  const buildings = page.locator('.diagram-node.recipe');
  let before = await buildings.first().boundingBox();
  for (let index = 0; index < (await buildings.count()); index += 1) {
    const candidate = buildings.nth(index),
      box = await candidate.boundingBox();
    if (
      box &&
      viewportBox &&
      box.x + box.width > viewportBox.x + 20 &&
      box.x < viewportBox.x + viewportBox.width - 20 &&
      box.y >= viewportBox.y + 12 &&
      box.y + Math.min(box.height, 40) <= viewportBox.y + viewportBox.height - 12
    ) {
      before = box;
      break;
    }
  }
  expect(before).not.toBeNull();
  const startX = Math.max(before!.x + 25, viewportBox!.x + 25);
  const startY = Math.max(before!.y + before!.height / 2, viewportBox!.y + 30);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 70, startY + 45, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Object.keys(
            JSON.parse(localStorage.getItem('harbor-plan') || '{}').diagramPositions || {}
          ).length
      )
    )
    .toBeGreaterThan(0);
});

test('lets users drag and persist semantic disposal endpoints', async ({ page }) => {
  await page.locator('.diagram-viewport').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Verkleinern' }).click();
  const viewport = await page.locator('.diagram-viewport').boundingBox();
  const endpoints = page.locator('.diagram-endpoint');
  let endpoint = endpoints.first();
  let before = await endpoint.boundingBox();
  for (let index = 0; index < (await endpoints.count()); index += 1) {
    const candidate = endpoints.nth(index);
    const box = await candidate.boundingBox();
    if (
      box &&
      viewport &&
      box.x >= viewport.x &&
      box.y >= viewport.y &&
      box.x + box.width <= viewport.x + viewport.width &&
      box.y + box.height <= viewport.y + viewport.height
    ) {
      endpoint = candidate;
      before = box;
      break;
    }
  }
  expect(before).not.toBeNull();
  const endpointId = await endpoint.getAttribute('data-node-id');
  expect(endpointId).toBeTruthy();
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
  await page.mouse.down();
  await page.mouse.move(before!.x + before!.width / 2 + 55, before!.y + before!.height / 2 + 30, {
    steps: 6,
  });
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const positions =
          JSON.parse(localStorage.getItem('harbor-plan') || '{}').diagramPositions || {};
        return Object.prototype.hasOwnProperty.call(positions, id);
      }, endpointId)
    )
    .toBe(true);
});

test('supports diagram keyboard navigation', async ({ page }) => {
  const node = page.locator('.diagram-node').first();
  await node.focus();
  await expect(node).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.diagram-node:focus')).toHaveCount(1);
});
