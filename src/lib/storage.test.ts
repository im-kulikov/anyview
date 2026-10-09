import { beforeEach, expect, test, vi } from 'vitest';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
});

const { saveProgress, historyStore, progressStore, toggleFavorite, favoritesStore, addRecentSearch, recentStore, resetProgress } = await import('./storage');

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
