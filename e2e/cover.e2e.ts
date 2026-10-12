import { expect, test } from '@playwright/test';
import { mockApi } from './mockApi';

/** Обложки не мигают при возврате на экран: карточка монтируется заново, но показанные раньше картинки сразу видны (без «буквы» и fade-in). */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('вернувшись на экран, уже показанные обложки видны сразу', async ({ page }) => {
  await mockApi(page);
  await page.goto('/anyview/');
  await page.waitForFunction(() => { const i = [...document.querySelectorAll('main img')]; return i.length > 0 && i.every((e) => (e as HTMLImageElement).complete); });
  const noPoster = await page.locator('main [class*=letter]').count(); // карточки фикстуры без постера: заглушка у них штатная
  await page.getByRole('link', { name: 'Аниме' }).last().click();
  await expect(page).toHaveURL(/\/anyview\/anime$/);
  // с этого момента следим за каждой вставленной картинкой и «буквой»-заглушкой
  await page.evaluate(() => {
    const w = window as unknown as { __dim: number; __letters: number; __added: number };
    w.__dim = 0; w.__letters = 0; w.__added = 0;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        for (const e of [n, ...n.querySelectorAll('*')]) {
          if (e instanceof HTMLImageElement) { w.__added++; if (getComputedStyle(e).opacity !== '1') w.__dim++; }
          if (/letter/.test(e.className.toString())) w.__letters++;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('link', { name: 'Главная' }).last().click();
  await expect(page).toHaveURL(/\/anyview\/$/);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const w = window as unknown as { __dim: number; __letters: number; __added: number }; return { dim: w.__dim, letters: w.__letters, added: w.__added }; });
  expect(r.added).toBeGreaterThan(0);
  expect(r).toMatchObject({ dim: 0, letters: noPoster });
});
