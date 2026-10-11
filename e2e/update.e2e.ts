import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

/** Обновление установленного приложения: сверка версии с version.json (src/lib/update.ts). */
test('version.json лежит рядом со сборкой', async ({ request }) => {
  const body = await (await request.get('/anyview/version.json')).json();
  expect(typeof body.sha).toBe('string');
});

test('новая версия на сервере: страница перезагружается один раз, без цикла', async ({ page }) => {
  await mockApi(page);
  await page.route('**/version.json*', (r) => r.fulfill({ json: { sha: 'bbbbbbb' } }));
  let loads = 0;
  page.on('load', () => loads++);
  await page.goto('/anyview/');
  await expect.poll(() => loads).toBe(2);
  await page.waitForTimeout(1500);
  expect(loads).toBe(2);
});

test('та же версия: перезагрузки нет', async ({ page }) => {
  await mockApi(page);
  let loads = 0;
  page.on('load', () => loads++);
  await page.goto('/anyview/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  expect(loads).toBe(1);
});
