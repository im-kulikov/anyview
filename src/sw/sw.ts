import { cacheable, pickStrategy, staleCaches } from './logic';

// Подставляются сборкой (config/swPlugin.ts).
declare const __VERSION__: string;
declare const __BASE__: string;
declare const __PRECACHE__: string[];

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `anyview-${__VERSION__}`;
const SHELL = `${__BASE__}index.html`;
const NAV_TIMEOUT_MS = 3000;

async function precache(): Promise<void> {
  const cache = await caches.open(CACHE);
  await Promise.all(__PRECACHE__.map(async (url) => {
    // index.html — в обход HTTP-кеша Pages (max-age=600), иначе оболочка может оказаться старше сборки
    const res = await fetch(url, { cache: url === SHELL ? 'reload' : 'default' });
    if (!cacheable(res.status, res.type)) throw new Error(`precache: ${url} ${res.status}`); // не установится — останется прежний воркер
    await cache.put(url, res);
  }));
}

/** Сеть в приоритете (свежий документ), оболочка из кеша — только если сети нет или она не ответила за 3 с. */
async function navigate(req: Request): Promise<Response> {
  try {
    return await Promise.race([fetch(req), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS))]);
  } catch {
    return (await (await caches.open(CACHE)).match(SHELL)) ?? fetch(req);
  }
}

async function asset(req: Request): Promise<Response> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (cacheable(res.status, res.type)) await cache.put(req, res.clone()).catch(() => {}); // квота — не повод ронять ответ
    return res;
  } catch {
    return fetch(req);
  }
}

sw.addEventListener('install', (e) => e.waitUntil(precache().then(() => sw.skipWaiting()))); // страницу перезагружает src/lib/update.ts (ADR-38); без skipWaiting reload не освобождает ожидающий воркер
sw.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((names) => Promise.all(staleCaches(names, CACHE).map((n) => caches.delete(n)))).then(() => sw.clients.claim()),
));
sw.addEventListener('fetch', (e) => {
  const r = e.request;
  const s = pickStrategy({ url: r.url, method: r.method, mode: r.mode, range: r.headers.has('range') }, sw.location.origin, __BASE__);
  if (s === 'shell') e.respondWith(navigate(r));
  else if (s === 'asset') e.respondWith(asset(r));
});
