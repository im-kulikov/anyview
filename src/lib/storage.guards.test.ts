import { beforeEach, expect, test, vi } from 'vitest';

/** Защита чтения: что бы ни лежало в localStorage (старая версия, ручная правка, облако), экраны получают только годные данные. */
const data = new Map<string, string>();
const api = {
  getItem: (k: string) => data.get(k) ?? null,
  setItem: (k: string, v: string) => void data.set(k, v),
  removeItem: (k: string) => void data.delete(k),
};
// Object.keys(localStorage) в браузере отдаёт сохранённые ключи — повторяем это
vi.stubGlobal('localStorage', new Proxy(api, {
  ownKeys: () => [...data.keys()],
  getOwnPropertyDescriptor: (_t, k) => (data.has(String(k)) ? { enumerable: true, configurable: true, value: data.get(String(k)) } : undefined),
}));

const { favoritesStore, historyStore, statusesStore, migrate, parseLocalData, resetLocalData, SCHEMA_VERSION } = await import('./storage');

const base = { id: 'av-1', type: 'anime', format: 'tv', name: 'Ок', status: 'ongoing' };
beforeEach(() => data.clear());

test('вложенные поля снимка проверяются: rating без value, poster без url, latestEpisode не числом — запись отбрасывается', () => {
  data.set('anyview:v1:favorites', JSON.stringify([
    { ...base, id: 'a', rating: {} },
    { ...base, id: 'b', poster: { url: 5 } },
    { ...base, id: 'c', latestEpisode: { number: '3' } },
    { ...base, id: 'd', year: '2020' },
    { ...base, id: 'e', episodes: {} },
    { ...base, id: 'good', rating: { source: 'x', value: 7.5 }, poster: { url: 'https://x/p.jpg' }, latestEpisode: { number: 3, label: '3 серия' } },
  ]));
  expect(favoritesStore.get().map((t) => t.id)).toEqual(['good']);
});

test('история и статусы: снимок с негодным rating отбрасывает запись, остальные живы', () => {
  const entry = (title: object) => ({ title, episodeId: 'e', episodeName: '1 серия', position: 1, duration: 10, updatedAt: 1 });
  data.set('anyview:v1:history', JSON.stringify([entry({ ...base, rating: { value: 'x' } }), entry({ ...base, id: 'ok' })]));
  expect(historyStore.get().map((h) => h.title.id)).toEqual(['ok']);
  data.set('anyview:v1:statuses', JSON.stringify({ a: { s: 'done', at: 1, t: { ...base, rating: {} } }, b: { s: 'done', at: 1, t: base }, c: { s: null, at: 2 } }));
  expect(Object.keys(statusesStore.get()).sort()).toEqual(['b', 'c']);
});

test('битый ключ не задевает соседние', () => {
  data.set('anyview:v1:history', '{не json');
  data.set('anyview:v1:favorites', JSON.stringify([base]));
  expect(historyStore.get()).toEqual([]);
  expect(favoritesStore.get()).toHaveLength(1);
});

test('схема «abc» и будущая «99»: данные не удаляются, версия не понижается', () => {
  data.set('anyview:v1:favorites', JSON.stringify([base]));
  data.set('anyview:schema', 'abc');
  expect(() => migrate(localStorage)).not.toThrow();
  expect(data.get('anyview:v1:favorites')).toBeDefined();
  data.set('anyview:schema', '99');
  expect(migrate(localStorage)).toBe(99);
  expect(data.get('anyview:schema')).toBe('99');
  expect(SCHEMA_VERSION).toBeLessThan(99);
});

test('parseLocalData: чужие формы и неверные типы не бросают', () => {
  expect(parseLocalData(null)).toBeNull();
  expect(parseLocalData([])).toBeNull();
  const d = parseLocalData({ progress: { e: { titleId: 't', position: '1', duration: 5, updatedAt: 1 } }, history: 'x', favorites: [5, null], favMeta: [], statuses: { x: { s: 'bogus', at: 1 } } });
  expect(d).toEqual({ progress: {}, history: [], favorites: [], favMeta: {}, statuses: {} });
});

test('resetLocalData: убирает данные приложения, ключ схемы и флаг синхронизации остаются', () => {
  data.set('anyview:v1:history', '[]');
  data.set('anyview:v1:favorites', '[]');
  data.set('anyview:v1:prefs', '{}');
  data.set('anyview:schema', '2');
  data.set('anyview:sync', '1');
  data.set('other:key', 'x');
  resetLocalData();
  expect([...data.keys()].sort()).toEqual(['anyview:schema', 'anyview:sync', 'other:key']);
});
