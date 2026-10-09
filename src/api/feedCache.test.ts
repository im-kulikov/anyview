import { beforeEach, expect, test, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });

const { feedStore } = await import('../lib/storage');
const { FEED_MAX_AGE_MS, persistFeed, restoreFeed } = await import('./feedCache');
const { keys } = await import('./keys');

const t = (id: string) => ({ id, type: 'anime', format: 'tv', name: id, status: 'ongoing' }) as never;
const page = (...ids: string[]) => ({ items: ids.map(t), page: 1, pageSize: 30, total: 99, hasMore: true });

beforeEach(() => mem.clear());

test('сохранённая лента ложится в кэш как устаревшая: prefetch всё равно сходит в сеть', async () => {
  feedStore.set({ savedAt: 1000, items: [t('a'), t('b')], total: 99, hasMore: true });
  const qc = new QueryClient();
  restoreFeed(qc, 2000);
  const state = qc.getQueryState(keys.updates());
  expect(state?.dataUpdatedAt).toBe(0);
  expect(qc.getQueryData<{ pages: { items: unknown[] }[] }>(keys.updates())?.pages[0].items).toHaveLength(2);
  await qc.prefetchInfiniteQuery({ queryKey: keys.updates(), queryFn: () => page('c'), initialPageParam: 1, staleTime: 5 * 60_000 });
  expect(qc.getQueryData<{ pages: { items: { id: string }[] }[] }>(keys.updates())?.pages[0].items[0].id).toBe('c');
});

test('слишком старый снимок и битые элементы не используются', () => {
  feedStore.set({ savedAt: 0, items: [t('a')], hasMore: true });
  const qc = new QueryClient();
  restoreFeed(qc, FEED_MAX_AGE_MS + 1);
  expect(qc.getQueryData(keys.updates())).toBeUndefined();
  mem.set('anyview:v1:feed', JSON.stringify({ savedAt: 5, items: [{ nope: 1 }], hasMore: true }));
  restoreFeed(qc, 6);
  expect(qc.getQueryData(keys.updates())).toBeUndefined();
});

test('успешная загрузка ленты обновляет снимок', async () => {
  const qc = new QueryClient();
  const stop = persistFeed(qc, () => 42);
  await qc.prefetchInfiniteQuery({ queryKey: keys.updates(), queryFn: () => page('x', 'y'), initialPageParam: 1 });
  stop();
  expect(feedStore.get()).toMatchObject({ savedAt: 42, total: 99, items: [{ id: 'x' }, { id: 'y' }] });
});
