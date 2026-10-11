import type { Page, Route } from '@playwright/test';
import last from './fixtures/last.json' with { type: 'json' };

/**
 * Герметичная сеть для e2e: страница не должна ходить никуда, кроме собственного preview. Известные хосты отвечают фикстурами,
 * Shikimori/AniList недоступны (блоки сведений скрыты, как при сбое), всё остальное отвечает 500 и попадает в `unexpected`.
 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const ANIME_HOSTS = ['api.animetop.info', 'api.animevost.org'];
const IMAGE_HOSTS = ['static.openni.ru', 'media.test'];

type Raw = { id: number; title: string };
const baseItems = last.data as unknown as Raw[];

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

export interface Net { unexpected: string[]; failures: Record<string, 'http500' | 'abort' | undefined> }

/** `failures.feed = 'http500'`: лента отвечает 500; 'abort' — обрыв соединения (как при отсутствии сети). */
export interface MockOpts {
  feed?: 'http500' | 'abort' | 'empty';
  /** Дополнительные (враждебные) элементы ленты и поиска — для фаззинга. */
  extraItems?: unknown[];
}

export async function mockApi(page: Page, opts: MockOpts = {}): Promise<Net> {
  const net: Net = { unexpected: [], failures: {} };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    // свой preview или (пост-деплой проверка) живой сайт из E2E_BASE_URL — пропускаем; всё остальное подменено
    if (url.hostname === '127.0.0.1' || url.origin === process.env.E2E_BASE_URL) return route.continue();
    if (ANIME_HOSTS.includes(url.hostname)) return animevost(route, url, opts);
    if (IMAGE_HOSTS.includes(url.hostname)) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (['shikimori.io', 'graphql.anilist.co'].includes(url.hostname)) return route.abort('failed');
    net.unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    return route.fulfill({ status: 500, body: 'unexpected request in e2e' });
  });
  return net;
}

async function animevost(route: Route, url: URL, opts: MockOpts) {
  const items = [...baseItems, ...((opts.extraItems ?? []) as Raw[])];
  const path = url.pathname.replace(/^\/v1/, '');
  const req = route.request();
  const form = new URLSearchParams(req.postData() ?? '');
  if (path === '/last') {
    if (opts.feed === 'abort') return route.abort('failed');
    if (opts.feed === 'http500') return json(route, {}, 500);
    if (opts.feed === 'empty') return json(route, { state: { status: 'ok', count: 0 }, data: [] });
    const page = Number(url.searchParams.get('page') ?? 1);
    // за концом списка API отвечает fail — штатный конец ленты (API_CONTRACT §5)
    if (page > 1) return json(route, { state: { status: 'fail' } });
    return json(route, { ...last, data: items });
  }
  if (path === '/search') {
    const q = (form.get('name') ?? '').toLowerCase();
    const hit = items.filter((i) => i.title.toLowerCase().includes(q));
    // «ничего не найдено»: 404 без CORS — в браузере это TypeError (правило поиска, API_CONTRACT §5.1)
    if (!hit.length) return route.abort('failed');
    return json(route, { state: { status: 'ok' }, data: hit });
  }
  if (path === '/info') {
    const hit = items.find((i) => String(i.id) === form.get('id'));
    return hit ? json(route, { state: { status: 'ok' }, data: [hit] }) : json(route, { state: { status: 'fail' } });
  }
  if (path === '/playlist') {
    return json(route, Array.from({ length: 14 }, (_, i) => ({ name: `${i + 1} серия`, std: 'https://media.test/s.mp4', hd: 'https://media.test/h.mp4', preview: 'https://media.test/p.png' })));
  }
  return json(route, {}, 404);
}
