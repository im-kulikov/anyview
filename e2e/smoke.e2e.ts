import { expect, test, type Page } from '@playwright/test';
import { mockApi } from './mockApi';
import { seeds } from './seeds';

/**
 * Smoke: каждый маршрут × наборы данных пользователя × телефон/десктоп. Критерий — экран отрисовался, экрана ошибки нет,
 * в консоли ни одной ошибки страницы. Это ровно та проверка, которой не было в релизе, сломавшем главную (ADR-32).
 */
const ROUTES = [
  '/', '/anime', '/library', '/library?tab=watching', '/library?tab=favorites',
  '/search?q=%D1%82%D0%BE%D0%BA%D0%B8%D0%B9', '/title/av-4000', '/sync', '/series', '/movies', '/no-such-route',
];
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
/** Все маршруты — на пустых и полных данных; остальные наборы — на маршрутах, которые читают локальные данные. */
const FULL_MATRIX = ['empty', 'full'] as const;
const DATA_SEEDS = ['history2', 'history50', 'legacyV1', 'corrupt', 'futureSchema', 'wrongFields', 'staleFeed'] as const;
const DATA_ROUTES = ['/', '/anime', '/library', '/title/av-4000', '/sync'];
const ERROR_TEXT = 'Что-то пошло не так';

async function open(page: Page, seed: Record<string, string>, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // сетевые обрывы Shikimori/AniList и «ничего не найдено» подменены намеренно и дают строку «Failed to load resource»
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(`console: ${m.text()}`));
  const net = await mockApi(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e-seeded')) return; // сид один раз: дальше приложение само владеет данными (перезагрузки, навигация)
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('e2e-seeded', '1');
  }, seed);
  await page.goto(`/anyview${path}`);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
  return { errors, net };
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`smoke · ${vpName}`, () => {
    test.use({ viewport, hasTouch: vpName === 'phone', isMobile: vpName === 'phone' });
    const cases = [
      ...FULL_MATRIX.flatMap((seed) => ROUTES.map((path) => [seed, path] as const)),
      ...DATA_SEEDS.flatMap((seed) => DATA_ROUTES.map((path) => [seed, path] as const)),
    ];
    for (const [seedName, path] of cases) {
      test(`${seedName} ${path}`, async ({ page }) => {
        const { errors, net } = await open(page, seeds[seedName], path);
        await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
        expect(errors).toEqual([]);
        expect(net.unexpected).toEqual([]);
      });
    }
  });
}

test.describe('данные на экранах', () => {
  const continueLinks = (page: Page) => page.locator('a[href*="?episode="]:visible');

  for (const seedName of ['history2', 'history50', 'legacyV1', 'full'] as const) {
    test(`главная показывает «Продолжить» (${seedName})`, async ({ page }) => {
      const { errors } = await open(page, seeds[seedName], '/');
      await expect(page.getByRole('heading', { name: 'Продолжить просмотр' })).toBeVisible();
      expect(await continueLinks(page).count()).toBeGreaterThanOrEqual(2); // инцидент: история из ≥ 2 записей
      expect(errors).toEqual([]);
    });
  }

  test('главная новичка: подсказка про «Моё», без «Продолжить»', async ({ page }) => {
    await open(page, seeds.empty, '/');
    await expect(page.getByText('Смотрите — мы запомним')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Продолжить просмотр' })).toHaveCount(0);
  });

  test('«Моё»: вкладки показывают свои записи, «надгробие» карточки не даёт', async ({ page }) => {
    await open(page, seeds.full, '/library?tab=watching');
    await expect(page.locator('main a[href^="/anyview/title/"]:visible')).toHaveCount(1);
    await page.goto('/anyview/library?tab=done');
    await expect(page.locator('main a[href^="/anyview/title/"]:visible')).toHaveCount(1);
    await page.goto('/anyview/library?tab=favorites');
    await expect(page.locator('main a[href^="/anyview/title/"]:visible')).toHaveCount(2);
    await page.goto('/anyview/library?tab=dropped');
    await expect(page.getByText('Брошенного пока нет.')).toBeVisible();
  });

  test('битое хранилище: данные не показываются, приложение работает', async ({ page }) => {
    await open(page, seeds.corrupt, '/library');
    await expect(page.getByRole('heading', { name: 'Моё' })).toBeVisible();
    await expect(page.getByText('Здесь появятся начатые серии.')).toBeVisible();
  });

  test('сбой ленты: экран ошибки с «Повторить», остальные секции живы', async ({ page }) => {
    const net = await mockApi(page, { feed: 'http500' });
    await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seeds.history2);
    await page.goto('/anyview/');
    await expect(page.getByText(ERROR_TEXT).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Продолжить просмотр' })).toBeVisible(); // история читается локально (SPEC §6)
    expect(net.unexpected).toEqual([]);
  });
});
