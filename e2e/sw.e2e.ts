import { expect, test, type Page } from '@playwright/test';
import { KILLER } from '../config/swPlugin';
import { mockApi } from './mockApi';

/** Service worker оболочки (ADR-39). Остальные e2e идут с заблокированными воркерами. */
test.use({ serviceWorkers: 'allow' });

const controlled = (page: Page) => page.evaluate(async () => { await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller; });
const cacheKeys = (page: Page) => page.evaluate(async () => {
  const out: string[] = [];
  for (const n of await caches.keys()) out.push(...(await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname));
  return out;
});

test('воркер ставится, берёт страницу под контроль и кладёт оболочку в кеш; версия и sw.js в кеш не попадают', async ({ page }) => {
  await mockApi(page);
  await page.goto('/anyview/');
  await expect.poll(() => controlled(page)).toBe(true);
  const keys = await cacheKeys(page);
  expect(keys).toContain('/anyview/index.html');
  expect(keys.some((k) => /\/assets\/index-.*\.js$/.test(k))).toBe(true);
  expect(keys.some((k) => /version\.json|sw\.js/.test(k))).toBe(false);
});

test('офлайн: приложение открывается из кеша с плашкой «Нет подключения»', async ({ page, context }) => {
  await mockApi(page);
  await page.goto('/anyview/');
  await expect.poll(() => controlled(page)).toBe(true);
  await page.reload(); // второй заход догружает ассеты в кеш
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText('Нет подключения к интернету')).toBeVisible();
});

test('аварийный выход: «убивающий» sw.js снимает воркер и стирает кеши', async ({ page, context }) => {
  await mockApi(page);
  await page.goto('/anyview/');
  await expect.poll(() => controlled(page)).toBe(true);
  // Playwright не перехватывает фоновую проверку sw.js, поэтому «подмену на боевом сайте» воспроизводим регистрацией killer под тем же scope
  await context.route('**/anyview/sw.js', (r) => r.fulfill({ status: 404, body: '' })); // как в сборке VITE_SW=off: после очистки страница воркер заново не регистрирует
  await context.route('**/anyview/sw-kill.js', (r) => r.fulfill({ contentType: 'text/javascript', body: KILLER }));
  await page.evaluate(() => navigator.serviceWorker.register('/anyview/sw-kill.js', { scope: '/anyview/' }));
  // killer перезагружает страницу (client.navigate), поэтому evaluate в момент навигации падает — повторяем
  const left = () => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length + (await caches.keys()).length).catch(() => -1);
  await expect.poll(left, { timeout: 15_000 }).toBe(0);
});

test('сломанный sw.js: страница открывается как обычно, воркера нет', async ({ page, context }) => {
  await context.route('**/anyview/sw.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'this is not javascript (' }));
  await mockApi(page);
  await page.goto('/anyview/');
  await expect(page.locator('main')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});

test('«Сбросить кеш» в диагностике снимает воркер и очищает кеши', async ({ page }) => {
  await mockApi(page);
  await page.goto('/anyview/');
  await expect.poll(() => controlled(page)).toBe(true);
  await page.goto('/anyview/diagnostics');
  await page.getByRole('button', { name: 'Сбросить кеш' }).click();
  await expect(page.getByRole('button', { name: /Кеш сброшен/ })).toBeVisible();
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length + (await caches.keys()).length)).toBe(0);
});
