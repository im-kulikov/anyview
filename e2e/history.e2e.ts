import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';
import { seeds } from './seeds';

/** «Убрать из Продолжить» в «Аккаунте»: запись исчезает сразу и после перезагрузки (метка historyGone нужна синхронизации). */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('запись можно убрать из «Продолжить»; после перезагрузки она не возвращается', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('seeded')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('seeded', '1');
  }, seeds.history2);
  await page.goto('/anyview/sync?tab=continue');
  const items = page.locator('main ul li', { has: page.getByRole('button', { name: /^Убрать из «Продолжить»/ }) });
  await expect(items).toHaveCount(2);
  const first = await items.first().locator('b').textContent();
  await items.first().getByRole('button', { name: /^Убрать из «Продолжить»/ }).click();
  await expect(items).toHaveCount(1);
  await expect(page.locator('main').getByText(first!, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(items).toHaveCount(1);
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('anyview:v1:historyGone') ?? '{}')).length)).toBe(1);
});

test('кнопка «убрать» — отдельная от ссылки кнопка с зоной нажатия ≥ 44 px', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seeds.history2);
  await page.goto('/anyview/sync?tab=continue');
  const b = page.getByRole('button', { name: /^Убрать из «Продолжить»/ }).first();
  const box = (await b.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
});
