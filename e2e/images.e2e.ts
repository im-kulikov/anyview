import { expect, test, type Page } from '@playwright/test';
import { mockApi, type MockOpts } from './mockApi';

/** Обложки идут через wsrv.nl, а при отказе — через зеркало и оригинал (imageUrls, ADR-40). Фикстура ленты ссылается на static.openni.ru. */
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const seenHosts = (page: Page) => {
  const hosts: string[] = [];
  page.on('request', (r) => { const u = new URL(r.url()); if (r.resourceType() === 'image' && u.hostname !== '127.0.0.1') hosts.push(u.hostname); });
  return hosts;
};
const shown = (page: Page) => page.waitForFunction(() => { const i = [...document.querySelectorAll('main img')]; return i.length > 0 && i.every((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0); });

async function open(page: Page, images: MockOpts['images'], clock = false) {
  if (clock) await page.clock.install();
  await mockApi(page, { images });
  const hosts = seenHosts(page);
  await page.goto('/anyview/');
  return hosts;
}

test('обычно обложки идут через wsrv.nl, без обращения к static.openni.ru', async ({ page }) => {
  const hosts = await open(page, undefined);
  await shown(page);
  expect(hosts.length).toBeGreaterThan(0);
  expect(new Set(hosts)).toEqual(new Set(['wsrv.nl']));
});

test('wsrv.nl отвечает 500: обложки берутся с зеркала', async ({ page }) => {
  const hosts = await open(page, (u) => (u.hostname === 'wsrv.nl' ? 500 : 'ok'));
  await shown(page);
  expect(hosts).toContain('v14.vost.pw');
});

test('wsrv.nl молчит: через 8 с обложки берутся с зеркала', async ({ page }) => {
  const hosts = await open(page, (u) => (u.hostname === 'wsrv.nl' ? 'hang' : 'ok'), true);
  await page.waitForFunction(() => document.querySelectorAll('main img').length > 0);
  await page.clock.fastForward(7000);
  expect(hosts).not.toContain('v14.vost.pw');
  await page.clock.fastForward(1500);
  await shown(page);
  expect(hosts).toContain('v14.vost.pw');
});

test('один 404 от wsrv.nl не отключает его для остальных обложек', async ({ page }) => {
  let first = true;
  const hosts = await open(page, (u) => {
    if (u.hostname !== 'wsrv.nl') return 'ok';
    if (first) { first = false; return 404; }
    return 'ok';
  });
  await shown(page);
  const ws = hosts.filter((h) => h === 'wsrv.nl').length;
  expect(hosts).toContain('v14.vost.pw'); // обложка с 404 ушла на зеркало
  expect(ws).toBeGreaterThan(1); // остальные идут через wsrv.nl
  expect(hosts.filter((h) => h === 'v14.vost.pw').length).toBe(1);
});

test('фон страницы тайтла берёт первый адрес (wsrv.nl)', async ({ page }) => {
  await mockApi(page);
  await page.goto('/anyview/title/av-4000');
  await expect(page.locator('main section img[src*="wsrv.nl"]').first()).toBeAttached();
});
