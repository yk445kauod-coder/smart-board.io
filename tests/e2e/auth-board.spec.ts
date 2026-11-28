import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E');

test('sign in, create a project and board, autosave, and save to the library', async ({ page }) => {
  const projectTitle = `مشروع E2E ${Date.now()}`;
  const libraryTitle = `عنصر E2E ${Date.now()}`;
  page.on('dialog', (dialog) => void dialog.accept(libraryTitle));

  await page.goto('/login');
  await page.locator('input[type=email]').fill(email!);
  await page.locator('input[type=password]').fill(password!);
  await page.getByRole('button', { name: 'دخول' }).click();
  await page.waitForURL('**/app/projects');

  await page.getByRole('button', { name: 'مشروع جديد' }).click();
  await page.locator('input[placeholder="عنوان المشروع"]').fill(projectTitle);
  await page.getByRole('button', { name: 'إنشاء', exact: true }).click();
  await page.getByRole('link', { name: new RegExp(projectTitle) }).click();
  await page.waitForURL('**/app/projects/**');

  await page.getByRole('button', { name: 'سبورة جديدة' }).first().click();
  await page.waitForURL('**/app/boards/**');
  const canvas = page.locator('.konvajs-content canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');

  await page.getByRole('button', { name: 'قلم', exact: true }).click();
  await page.mouse.move(box.x + 280, box.y + 260);
  await page.mouse.down();
  await page.mouse.move(box.x + 430, box.y + 330, { steps: 10 });
  await page.mouse.up();

  const saved = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.url().includes('/boards/') && response.status() === 200,
  );
  await page.getByRole('button', { name: 'ملاحظة', exact: true }).click();
  await page.mouse.click(box.x + 600, box.y + 320);
  const note = page.locator('textarea');
  await expect(note).toBeVisible();
  await note.fill('Auth sticky');
  await note.press('Enter');
  await saved;

  const library = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/library') && response.status() === 201,
  );
  await page.getByRole('button', { name: 'حفظ في المكتبة' }).click();
  await library;

  await page.goto('/app/library');
  await expect(page.getByRole('heading', { name: 'المكتبة' })).toBeVisible();
  await expect(page.getByText(libraryTitle)).toBeVisible();
});
