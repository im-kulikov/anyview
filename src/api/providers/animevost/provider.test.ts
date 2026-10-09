import { afterEach, describe, expect, test, vi } from 'vitest';
import { ApiError } from '../../contract';
import { CACHE_TTL_MS, createAnimevostProvider } from './index';

const BASE = 'https://api.test/v1';
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

const item = (id: number, title: string) => ({ id, title, type: 'ТВ', year: '2026', rating: 100, votes: 40 });

afterEach(() => vi.unstubAllGlobals());

describe('провайдер animevost', () => {
  test('updates: страница, total, hasMore', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'ok', count: 3603 }, data: [item(1, 'А / A [1 из 12+]')] })));
    const page = await createAnimevostProvider([BASE]).updates({ type: 'anime', page: 2, pageSize: 100 });
    expect(page).toMatchObject({ page: 2, pageSize: 40, total: 3603, hasMore: true });
    expect(page.items[0]).toMatchObject({ id: 'av-1', status: 'ongoing', rating: { value: 5 } });
  });

  test('updates: fail за концом списка → пусто', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'fail' }, data: [] })));
    const page = await createAnimevostProvider([BASE]).updates({ type: 'anime', page: 999, pageSize: 30 });
    expect(page).toMatchObject({ items: [], hasMore: false });
  });

  test('title: неизвестный id → not_found; не av-<цифры> — без запроса', async () => {
    const f = vi.fn(() => json({ state: { status: 'fail' }, data: [] }));
    vi.stubGlobal('fetch', f);
    const p = createAnimevostProvider([BASE]);
    await expect(p.title('av-999')).rejects.toMatchObject({ kind: 'not_found' });
    f.mockClear();
    await expect(p.title('xx-1')).rejects.toBeInstanceOf(ApiError);
    expect(f).not.toHaveBeenCalled();
  });

  test('playlist fail (объект) → not_found', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ status: 'fail', error: 'нет' })));
    await expect(createAnimevostProvider([BASE]).episodes('av-5')).rejects.toMatchObject({ kind: 'not_found' });
  });

  test('episodes + sources: одна загрузка плейлиста, next-серия, https', async () => {
    const f = vi.fn((url: string) =>
      url.endsWith('/playlist')
        ? json([
            { name: '2 серия', hd: 'http://v/720/222.mp4', std: 'http://v/222.mp4', preview: 'http://m/222.jpg' },
            { name: '1 серия', hd: '', std: 'http://v/111.mp4' },
          ])
        : json({ state: { status: 'ok' }, data: [item(5, 'А / A [2 из 12+] [3 серия - 15 октября]')] }),
    );
    vi.stubGlobal('fetch', f);
    const p = createAnimevostProvider([BASE]);
    const [season] = await p.episodes('av-5');
    expect(season.episodes.map((e) => [e.id, e.available])).toEqual([
      ['av-5-111', true], ['av-5-222', true], ['av-5-next-3', false],
    ]);
    expect(season.episodes[1].preview?.url).toBe('https://m/222.jpg');
    const src = await p.sources('av-5-222');
    expect(src.map((s) => [s.quality.height, s.stream?.url])).toEqual([[480, 'https://v/222.mp4'], [720, 'https://v/720/222.mp4']]);
    expect((await p.sources('av-5-111')).length).toBe(1);
    expect(await p.sources('av-5-next-3')).toEqual([]);
    expect(f.mock.calls.filter(([u]) => String(u).endsWith('/playlist')).length).toBe(1);
  });

  test('сеть: перебор баз', async () => {
    const f = vi.fn((url: string) =>
      url.startsWith(BASE) ? Promise.reject(new TypeError('fail')) : json({ state: { status: 'ok', count: 1 }, data: [item(1, 'А')] }),
    );
    vi.stubGlobal('fetch', f);
    const page = await createAnimevostProvider([BASE, 'https://b2.test/v1']).updates({ type: 'anime', page: 1, pageSize: 30 });
    expect(page.items).toHaveLength(1);
  });
});

describe('надёжность адаптера', () => {
  const infoOrList = (list: unknown[], title = 'А / A [1 из 12+]') => (url: string) =>
    url.endsWith('/playlist') ? json(list) : json({ state: { status: 'ok' }, data: [item(5, title)] });

  test('дубли videoId → уникальные id серий, sources по своей записи (CODE-10)', async () => {
    vi.stubGlobal('fetch', vi.fn(infoOrList([
      { name: '1 серия', std: 'http://v/111.mp4' },
      { name: '2 серия', std: 'http://v/111.mp4' },
      { name: '3 серия', std: 'http://v/333.mp4' },
    ])));
    const p = createAnimevostProvider([BASE]);
    const [season] = await p.episodes('av-5');
    const ids = season.episodes.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(['av-5-111', 'av-5-111-2', 'av-5-333']);
    expect((await p.sources('av-5-111-2')).length).toBe(1);
  });

  test('анонс с пустым плейлистом: только недоступная синтетическая серия (CODE-01)', async () => {
    vi.stubGlobal('fetch', vi.fn(infoOrList([], 'А / A [0 из 12+] [1 серия - 15 октября]')));
    const [season] = await createAnimevostProvider([BASE]).episodes('av-5');
    expect(season.episodes.map((e) => [e.id, e.available])).toEqual([['av-5-next-1', false]]);
  });

  test('битый элемент ленты пропускается, страница не падает (CODE-12)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'ok', count: 2 }, data: [{ id: 1 }, item(2, 'Б / B [1 из 2]'), null] })));
    const page = await createAnimevostProvider([BASE]).updates({ type: 'anime', page: 1, pageSize: 30 });
    expect(page.items.map((t) => t.id)).toEqual(['av-2']);
  });

  test('нет state.count → total не задан, без NaN', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'ok' }, data: [item(1, 'А')] })));
    const page = await createAnimevostProvider([BASE]).updates({ type: 'anime', page: 1, pageSize: 30 });
    expect(page.total).toBeUndefined();
    expect(page.hasMore).toBe(false);
  });

  test('кэш с TTL: новая серия онгоинга появляется после истечения (ARCH-03)', async () => {
    vi.useFakeTimers();
    try {
      let list = [{ name: '1 серия', std: 'http://v/111.mp4' }];
      const f = vi.fn((url: string) => (url.endsWith('/playlist') ? json(list) : json({ state: { status: 'ok' }, data: [item(5, 'А / A [1 из 12+]')] })));
      vi.stubGlobal('fetch', f);
      const p = createAnimevostProvider([BASE]);
      expect((await p.episodes('av-5'))[0].episodes).toHaveLength(1);
      list = [...list, { name: '2 серия', std: 'http://v/222.mp4' }];
      expect((await p.episodes('av-5'))[0].episodes).toHaveLength(1); // ещё в TTL: дедуп запросов
      vi.advanceTimersByTime(CACHE_TTL_MS + 1000);
      expect((await p.episodes('av-5'))[0].episodes).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('поиск', () => {
  test('нашёл — кладёт тайтлы в кэш (title без /info)', async () => {
    const f = vi.fn(() => json({ state: { status: 'ok' }, data: [item(7, 'Наруто / Naruto [1-220 из 220]')] }));
    vi.stubGlobal('fetch', f);
    const p = createAnimevostProvider([BASE]);
    const page = await p.search({ q: 'нару', page: 1, pageSize: 50 });
    expect(page).toMatchObject({ total: 1, hasMore: false });
    await p.title('av-7');
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('поиск без CORS-404 (TypeError), но контрольный запрос отвечает → пусто, даже на холодном старте', async () => {
    const f = vi.fn((url: string) =>
      url.endsWith('/search') ? Promise.reject(new TypeError('cors')) : json({ state: { status: 'ok', count: 1 }, data: [item(1, 'А / A [1 из 12+]')] }),
    );
    vi.stubGlobal('fetch', f);
    const page = await createAnimevostProvider([BASE]).search({ q: 'zzzz', page: 1, pageSize: 50 });
    expect(page.items).toEqual([]);
    expect(f).toHaveBeenLastCalledWith(`${BASE}/last?page=1&quantity=1`, expect.anything());
  });

  test('TypeError и контрольный запрос тоже падает → network', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    await expect(createAnimevostProvider([BASE]).search({ q: 'zzzz', page: 1, pageSize: 50 })).rejects.toMatchObject({ kind: 'network' });
  });

  test('контрольный запрос с 5xx → network', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => (url.endsWith('/search') ? Promise.reject(new TypeError('x')) : json({}, 502))));
    await expect(createAnimevostProvider([BASE]).search({ q: 'zzzz', page: 1, pageSize: 50 })).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('отмена общих запросов (CODE-17)', () => {
  /** fetch, который висит до abort и запоминает сигнал. */
  const hanging = () => {
    const signals: AbortSignal[] = [];
    const f = vi.fn((_url: string, init?: RequestInit) => {
      signals.push(init!.signal!);
      return new Promise<Response>((_, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    });
    vi.stubGlobal('fetch', f);
    return { f, signals };
  };

  test('один из двух подписчиков ушёл — запрос живёт; ушли оба — fetch оборван', async () => {
    const { f, signals } = hanging();
    const p = createAnimevostProvider([BASE]);
    const a = new AbortController();
    const b = new AbortController();
    const pa = p.title('av-5', a.signal);
    const pb = p.title('av-5', b.signal);
    pa.catch(() => {});
    pb.catch(() => {});
    expect(f).toHaveBeenCalledTimes(1);
    a.abort();
    await expect(pa).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals[0].aborted).toBe(false);
    b.abort();
    await expect(pb).rejects.toMatchObject({ name: 'AbortError' });
    expect(signals[0].aborted).toBe(true);
  });

  test('после полной отмены следующий вызов делает новый запрос', async () => {
    const { f } = hanging();
    const p = createAnimevostProvider([BASE]);
    const a = new AbortController();
    const first = p.episodes('av-6', a.signal);
    first.catch(() => {});
    a.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    f.mockClear();
    void p.episodes('av-6', new AbortController().signal).catch(() => {});
    expect(f).toHaveBeenCalled();
  });

  test('отмена после завершения загрузки не стирает кэш', async () => {
    const f = vi.fn(() => json([{ name: '1 серия', std: 'http://v/111.mp4' }]));
    vi.stubGlobal('fetch', f);
    const p = createAnimevostProvider([BASE]);
    const a = new AbortController();
    await p.sources('av-9-111', a.signal);
    a.abort();
    await p.sources('av-9-111');
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('данные с чужих адресов', () => {
  test('/last с fail на первой странице — ошибка, не «конец ленты»', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'fail' }, data: [] })));
    await expect(createAnimevostProvider([BASE]).updates({ type: 'anime', page: 1, pageSize: 30 })).rejects.toMatchObject({ kind: 'network' });
  });

  test('относительный постер → https хоста постеров, чужая схема → без постера', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ state: { status: 'ok', count: 2 }, data: [
      { ...item(1, 'А / A [1 из 12+]'), urlImagePreview: '/uploads/a.jpg' },
      { ...item(2, 'Б / B [1 из 12+]'), urlImagePreview: 'javascript:alert(1)' },
    ] })));
    const page = await createAnimevostProvider([BASE]).updates({ type: 'anime', page: 1, pageSize: 30 });
    expect(page.items[0].poster).toEqual({ url: 'https://static.openni.ru/uploads/a.jpg' });
    expect(page.items[1].poster).toBeUndefined();
  });

  test('источник с негодным адресом пропускается', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json([{ name: '1 серия', std: 'javascript:1', hd: 'http://v/720/111.mp4' }])));
    const src = await createAnimevostProvider([BASE]).sources('av-9-111');
    expect(src.map((x) => x.stream)).toEqual([{ kind: 'file', url: 'https://v/720/111.mp4', mime: 'video/mp4' }]);
  });
});
