import type { QueryClient } from '@tanstack/react-query';
import { feedStore } from '../lib/storage';
import { FEED_PAGE_SIZE, keys } from './keys';
import type { Page, TitleSummary } from './contract';

/** Старше — не показываем даже временно. */
export const FEED_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

type Feed = { pages: Page<TitleSummary>[]; pageParams: number[] };

/**
 * Повторный визит: первая страница ленты из localStorage ложится в кэш Query как устаревшая (updatedAt 0),
 * поэтому prefetch в main.tsx всё равно идёт в сеть (один запрос, как и раньше), а экран рисуется без ожидания API.
 * Никогда не подменяет уже загруженные данные.
 */
export function restoreFeed(qc: QueryClient, now = Date.now()): void {
  const snap = feedStore.get();
  const key = keys.updates();
  if (!snap || now - snap.savedAt > FEED_MAX_AGE_MS || qc.getQueryData(key)) return;
  const page: Page<TitleSummary> = {
    items: snap.items,
    page: 1,
    pageSize: FEED_PAGE_SIZE,
    ...(snap.total !== undefined && { total: snap.total }),
    hasMore: snap.hasMore,
  };
  qc.setQueryData<Feed>(key, { pages: [page], pageParams: [1] }, { updatedAt: 0 });
}

/** Каждая успешная загрузка ленты обновляет снимок первой страницы. */
export function persistFeed(qc: QueryClient, now = Date.now): () => void {
  const key = JSON.stringify(keys.updates());
  return qc.getQueryCache().subscribe((e) => {
    if (e.type !== 'updated' || e.action.type !== 'success' || JSON.stringify(e.query.queryKey) !== key) return;
    const first = (e.query.state.data as Feed | undefined)?.pages[0];
    if (first?.items.length) feedStore.set({ savedAt: now(), items: first.items, ...(first.total !== undefined && { total: first.total }), hasMore: first.hasMore });
  });
}
