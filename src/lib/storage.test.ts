import { beforeEach, expect, test, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
});

const { migrate, SCHEMA_VERSION, feedStore, getPrefs, DEFAULT_PREFS, saveProgress,historyStore, progressStore, toggleFavorite, favoritesStore, addRecentSearch, recentStore, resetProgress } = await import('./storage');

const title = { id: 'av-1', type: 'anime', format: 'tv', name: 'T', status: 'ongoing' } as never;
const ep = (n: number) => ({ id: `e${n}`, titleId: 'av-1', season: 1, number: n, name: `${n} серия`, available: true });

beforeEach(() => mem.clear());

test('одна запись истории на тайтл, обновляется на месте', () => {
  saveProgress({ title, episode: ep(1), position: 10, duration: 100 });
  saveProgress({ title, episode: ep(2), position: 20, duration: 100 });
  expect(historyStore.get()).toHaveLength(1);
  expect(historyStore.get()[0]).toMatchObject({ episodeId: 'e2', position: 20 });
});

test('≥ 90 %: запись переходит на следующую серию, без следующей — удаляется', () => {
  saveProgress({ title, episode: ep(1), next: ep(2), position: 95, duration: 100 });
  expect(historyStore.get()[0]).toMatchObject({ episodeId: 'e2', position: 0 });
  saveProgress({ title, episode: ep(2), position: 99, duration: 100 });
  expect(historyStore.get()).toHaveLength(0);
  expect(progressStore.get().e2.position).toBe(99);
});

test('лимит progress 500 вытесняет старые', () => {
  for (let i = 0; i < 505; i++) saveProgress({ title, episode: ep(i), position: 1, duration: 100 });
  expect(Object.keys(progressStore.get())).toHaveLength(500);
});

test('избранное, недавние запросы, битые данные', () => {
  toggleFavorite(title);
  expect(favoritesStore.get()).toHaveLength(1);
  toggleFavorite(title);
  expect(favoritesStore.get()).toHaveLength(0);
  for (const q of ['a1', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'BB']) addRecentSearch(q);
  expect(recentStore.get()).toHaveLength(8);
  expect(recentStore.get()[0]).toBe('BB');
  mem.set('anyview:v1:history', '{broken');
  expect(historyStore.get()).toEqual([]);
  saveProgress({ title, episode: ep(1), position: 30, duration: 100 });
  resetProgress('e1');
  expect(progressStore.get().e1.position).toBe(0);
});

test('битые элементы отбрасываются по одному, валидные остаются (CODE-02)', () => {
  mem.set('anyview:v1:history', JSON.stringify([null, { foo: 1 }, { title: { id: 'av-1', name: 'T', type: 'anime', format: 'tv', status: 'ongoing' }, episodeId: 'e1', episodeName: '1', position: 1, duration: 2, updatedAt: 3 }]));
  expect(historyStore.get()).toHaveLength(1);
  saveProgress({ title, episode: ep(1), position: 5, duration: 100 }); // не падает на мусоре
  mem.set('anyview:v1:favorites', JSON.stringify([null, 5, { id: 'av-2' }, title]));
  expect(favoritesStore.get()).toHaveLength(1);
  mem.set('anyview:v1:progress', JSON.stringify({ a: null, b: { titleId: 't', position: 'x', duration: 1, updatedAt: 1 }, c: { titleId: 't', position: 1, duration: 2, updatedAt: 3 } }));
  expect(Object.keys(progressStore.get())).toEqual(['c']);
});

test('prefs: поля проверяются по одному, громкость в [0,1] (CODE-02)', () => {
  mem.set('anyview:v1:prefs', JSON.stringify({ volume: 5, muted: 'yes', quality: 'hd' }));
  expect(getPrefs()).toEqual({ quality: 'hd', autoNext: true, volume: 1, muted: false });
  mem.set('anyview:v1:prefs', JSON.stringify({ volume: -3 }));
  expect(getPrefs().volume).toBe(0);
  mem.set('anyview:v1:prefs', '[]');
  expect(getPrefs()).toEqual(DEFAULT_PREFS);
});

test('квота: сначала выбрасывается кэш ленты, пользовательская запись сохраняется в localStorage', () => {
  toggleFavorite(title);
  mem.set('anyview:v1:feed', JSON.stringify({ savedAt: 1, items: [title], hasMore: true }));
  const ls = localStorage as unknown as { setItem: (k: string, v: string) => void; removeItem?: (k: string) => void };
  const { setItem } = ls;
  ls.removeItem = (k) => void mem.delete(k);
  ls.setItem = (k, v) => {
    if (mem.has('anyview:v1:feed')) throw new DOMException('full', 'QuotaExceededError');
    mem.set(k, v);
  };
  try {
    toggleFavorite({ id: 'av-2', type: 'anime', format: 'tv', name: 'T', status: 'ongoing' } as never);
    expect(mem.has('anyview:v1:feed')).toBe(false);
    expect(JSON.parse(mem.get('anyview:v1:favorites')!)).toHaveLength(2);
    expect(feedStore.get()).toBeNull();
  } finally {
    ls.setItem = setItem;
    delete ls.removeItem;
  }
});

test('setItem бросает (квота): запись не откатывается, живём в памяти (CODE-06)', () => {
  toggleFavorite(title);
  const ls = localStorage as unknown as { setItem: unknown };
  const orig = ls.setItem;
  ls.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  try {
    toggleFavorite({ id: 'av-2', type: 'anime', format: 'tv', name: 'T', status: 'ongoing' } as never);
    expect(favoritesStore.get().map((t) => t.id)).toEqual(['av-2', 'av-1']);
    toggleFavorite({ id: 'av-3', type: 'anime', format: 'tv', name: 'T', status: 'ongoing' } as never);
    expect(favoritesStore.get()).toHaveLength(3);
  } finally {
    ls.setItem = orig;
  }
});

test('migrate: нет версии = v1, цепочка шагов, упавший шаг не повышает версию, новая версия не понижается', () => {
  const kv = new Map<string, string>();
  const api = { getItem: (k: string) => kv.get(k) ?? null, setItem: (k: string, v: string) => void kv.set(k, v) };
  const steps: number[] = [];
  const migrations = { 1: () => void steps.push(1), 2: () => void steps.push(2) };
  expect(migrate(api, migrations, 3)).toBe(3);
  expect(steps).toEqual([1, 2]);
  expect(kv.get('anyview:schema')).toBe('3');
  expect(migrate(api, migrations, 3)).toBe(3);
  expect(steps).toEqual([1, 2]); // повторно не выполняется
  expect(migrate(api, migrations, 2)).toBe(3); // откат деплоя: версия не понижается
  expect(kv.get('anyview:schema')).toBe('3');

  const kv2 = new Map<string, string>([['anyview:schema', '1']]);
  const api2 = { getItem: (k: string) => kv2.get(k) ?? null, setItem: (k: string, v: string) => void kv2.set(k, v) };
  migrate(api2, { 1: () => { throw new Error('boom'); } }, 2);
  expect(kv2.get('anyview:schema')).toBe('1');
  expect(SCHEMA_VERSION).toBe(1);
});
