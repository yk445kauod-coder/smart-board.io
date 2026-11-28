import { expect, test } from '@playwright/test';

const GUEST_DOC_KEY = 'smartboard:guest-doc';

async function guestElements(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const doc = JSON.parse(raw) as { elements?: unknown[] };
    return doc.elements?.length ?? 0;
  }, GUEST_DOC_KEY);
}

test('landing page and guest board survive a reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page).toHaveTitle(/SmartBoard AI/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('سبورة');

  await page.goto('/board');
  const canvas = page.locator('.konvajs-content canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');

  await page.getByRole('button', { name: 'قلم', exact: true }).click();
  await page.mouse.move(box.x + 300, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 460, box.y + 340, { steps: 12 });
  await page.mouse.up();

  await page.getByRole('button', { name: 'ملاحظة', exact: true }).click();
  await page.mouse.click(box.x + 620, box.y + 320);
  const note = page.locator('textarea');
  await expect(note).toBeVisible();
  await note.fill('ملاحظة اختبار E2E');
  await note.press('Enter');

  await expect.poll(() => guestElements(page)).toBe(2);

  await page.reload();
  await expect(canvas).toBeVisible();
  expect(await guestElements(page)).toBe(2);
  expect(errors).toEqual([]);
});
