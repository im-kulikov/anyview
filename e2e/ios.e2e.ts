import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';
import { seeds } from './seeds';

/** Установка на экран «Домой» и «нативное» поведение (ADR-37). Режим приложения и iOS эмулируются: на устройстве проверяет владелец. */
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

async function seeded(page: import('@playwright/test').Page, seed: Record<string, string>, path: string) {
  await mockApi(page);
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem('e2e-seeded', '1');
  }, seed);
  await page.goto(`/anyview${path}`);
  await expect(page.locator('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

test.describe('разметка и манифест установленного приложения', () => {
  test('мета-теги iOS и поля манифеста', async ({ page, request }) => {
    await mockApi(page);
    await page.goto('/anyview/');
    const meta = (name: string) => page.locator(`meta[name="${name}"]`).getAttribute('content');
    expect(await meta('apple-mobile-web-app-capable')).toBe('yes');
    expect(await meta('apple-mobile-web-app-status-bar-style')).toBe('black-translucent');
    expect(await meta('apple-mobile-web-app-title')).toBe('anyview');
    expect(await meta('color-scheme')).toBe('dark');
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain('viewport-fit=cover');
    expect(await page.locator('link[rel="apple-touch-icon"]').getAttribute('sizes')).toBe('180x180');
    const m = await (await request.get('/anyview/manifest.webmanifest')).json();
    expect(m).toMatchObject({ id: './', display: 'standalone', scope: './', start_url: './', background_color: '#131416' });
    expect(m.display_override).toContain('standalone');
  });
});

test.describe('поведение как в приложении', () => {
  test.use(PHONE);

  test('повторный тап по текущей вкладке прокручивает наверх, без новой записи в истории', async ({ page }) => {
    await seeded(page, seeds.empty, '/');
    const key = () => page.evaluate(() => (history.state as { key?: string } | null)?.key);
    const before = await page.evaluate(() => history.length);
    const keyBefore = await key();
    await page.evaluate(() => window.scrollTo(0, 700));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: 'Главная' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(10);
    expect(await page.evaluate(() => history.length)).toBe(before);
    expect(await key()).toBe(keyBefore); // навигации не было вовсе (иначе react-router заменил бы запись с новым ключом)
  });

  test('прокрутка вкладки сохраняется при переходе на другую вкладку и обратно', async ({ page }) => {
    await seeded(page, seeds.empty, '/anime');
    await page.evaluate(() => window.scrollTo(0, 500));
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(200);
    const nav = page.getByRole('navigation', { name: 'Разделы' });
    await nav.getByRole('link', { name: 'Главная' }).click();
    await expect(page).toHaveURL(/\/anyview\/$/);
    await nav.getByRole('link', { name: 'Аниме' }).click();
    await expect(page).toHaveURL(/\/anyview\/anime$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 150);
  });

  test('точка «новые серии» на «Аккаунт»: есть у отслеживаемого тайтла с новой серией, нет у пустого профиля', async ({ page }) => {
    await seeded(page, seeds.newEpisode, '/');
    const account = page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: /Аккаунт/ });
    await expect(account).toContainText('новые серии: 1');
    await expect(account.locator('[aria-hidden="true"]', { hasText: '1' })).toBeVisible();
  });

  test('профиль без отслеживаемых тайтлов — без точки', async ({ page }) => {
    await seeded(page, seeds.empty, '/');
    await expect(page.getByRole('navigation', { name: 'Разделы' }).getByRole('link', { name: /Аккаунт/ })).not.toContainText('новые серии');
  });
});

test.describe('подсказка «На экран Домой»', () => {
  test('iPhone Safari: показывается на «Аккаунте», закрытие запоминается', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, userAgent: IPHONE_SAFARI });
    const page = await ctx.newPage();
    await seeded(page, seeds.empty, '/sync');
    await expect(page.getByText('Установите anyview на экран «Домой»')).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть подсказку' }).click();
    await expect(page.getByText('Установите anyview на экран «Домой»')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('Установите anyview на экран «Домой»')).toHaveCount(0);
    await ctx.close();
  });

  test('установленное приложение: подсказки нет, есть предупреждение про отдельное хранилище', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, userAgent: IPHONE_SAFARI });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    const page = await ctx.newPage();
    await seeded(page, seeds.empty, '/sync');
    await expect(page.getByText('Установите anyview на экран «Домой»')).toHaveCount(0);
    await expect(page.getByText('хранит данные отдельно от Safari')).toBeVisible();
    await ctx.close();
  });

  test('десктопный Chromium: подсказки нет', async ({ page }) => {
    await seeded(page, seeds.empty, '/sync');
    await expect(page.getByText('Установите anyview на экран «Домой»')).toHaveCount(0);
    await expect(page.getByText('хранит данные отдельно от Safari')).toHaveCount(0);
  });
});

test.describe('плеер на телефоне', () => {
  test.use(PHONE);
  test('кнопка «Картинка в картинке» не скрыта на узком экране', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(document, 'pictureInPictureEnabled', { value: true }));
    await mockApi(page);
    await page.goto('/anyview/title/av-4000');
    await page.locator('main button[aria-label^="Смотреть"], main button:has-text("Смотреть")').first().click();
    await expect(page.getByRole('button', { name: 'Картинка в картинке' })).toBeVisible();
  });
});

test.describe('волна 2', () => {
  test.use(PHONE);
  const last = () => ({ 'anyview:last': JSON.stringify({ path: '/title/av-4000', ts: Date.now() }) });

  test('стартовые экраны подключены и файлы отдаются', async ({ page, request }) => {
    await mockApi(page);
    await page.goto('/anyview/');
    const hrefs = await page.locator('link[rel="apple-touch-startup-image"]').evaluateAll((l) => l.map((e) => e.getAttribute('href')!));
    expect(hrefs.length).toBeGreaterThanOrEqual(10);
    for (const h of hrefs) expect((await request.get(h)).ok()).toBe(true);
  });

  test('холодный запуск установленного приложения возвращает на последний тайтл, «Назад» ведёт на главную', async ({ browser }) => {
    const ctx = await browser.newContext({ ...PHONE, userAgent: IPHONE_SAFARI });
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { get: () => true }));
    const page = await ctx.newPage();
    await seeded(page, last(), '/');
    await expect(page).toHaveURL(/\/title\/av-4000$/);
    await page.getByRole('link', { name: 'Назад' }).click();
    await expect(page).toHaveURL(/\/anyview\/$/);
    await ctx.close();
  });

  test('в обычном браузере главная остаётся главной', async ({ page }) => {
    await seeded(page, last(), '/');
    await expect(page).toHaveURL(/\/anyview\/$/);
  });

  test('кнопка «Поделиться» есть, когда доступен navigator.share', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: () => Promise.resolve() }));
    await seeded(page, seeds.empty, '/title/av-4000');
    await expect(page.getByRole('button', { name: 'Поделиться' })).toBeVisible();
  });

  test('на /diagnostics есть кнопка «Назад» в шапке', async ({ page }) => {
    await seeded(page, seeds.empty, '/diagnostics');
    await page.getByRole('link', { name: 'Назад' }).click();
    await expect(page).toHaveURL(/\/anyview\/sync$/);
  });
});

test.describe('поле поиска', () => {
  test.use(PHONE);
  const field = (page: import('@playwright/test').Page) => page.locator('input[type="search"]').locator('xpath=ancestor::div[contains(@class,"field")][1]');

  test('на телефоне в режиме поиска одно кольцо фокуса (без белой обводки поверх акцентного) и плейсхолдер помещается', async ({ page }) => {
    await seeded(page, seeds.empty, '/search');
    await page.locator('input[type="search"]').focus();
    expect(await field(page).evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
    expect(await field(page).evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none'); // акцентное кольцо на месте
    await expect(page.locator('input[type="search"]')).toHaveAttribute('placeholder', 'Название или оригинал');
  });

  test('на десктопе вне режима поиска белая обводка фокуса сохраняется', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await seeded(page, seeds.empty, '/');
    await page.locator('input[type="search"]').focus();
    expect(await field(page).evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('solid');
  });
});
