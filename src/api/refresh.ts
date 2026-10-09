import type { QueryClient } from '@tanstack/react-query';
import { provider } from './index';
import { FEED_PAGE_SIZE, keys, STALE } from './keys';
import type { Page, TitleSummary } from './contract';

/** Вкладка вернулась на экран, а данным ленты больше этого — обновляем первую страницу. */
export const FEED_REFRESH_AFTER_MS = 3 * STALE.list;

type Feed = { pages: Page<TitleSummary>[]; pageParams: number[] };

/**
 * Освежает только первую страницу ленты и оставляет остальные загруженные страницы на месте
 * (полный refetch бесконечного запроса перезагрузил бы их все, а возврат на `/anime` не должен терять прокрутку).
 * Дубли на стыке страниц склеивает `dedupe`. Ошибка сети молча оставляет прежние данные.
 */
export async function refreshFeed(
  qc: QueryClient,
  load: () => Promise<Page<TitleSummary>> = () => provider.updates({ type: 'anime', page: 1, pageSize: FEED_PAGE_SIZE }),
): Promise<void> {
  let first: Page<TitleSummary>;
  try {
    first = await load();
  } catch {
    return;
  }
  qc.setQueryData<Feed>(keys.updates(), (old) => (old ? { ...old, pages: [first, ...old.pages.slice(1)] } : old));
}

/** Лента не обновлялась в рамках сессии (CODE-35): при возврате на вкладку проверяем возраст данных. */
export function watchFeedFreshness(qc: QueryClient, now = Date.now): () => void {
  const check = () => {
    if (document.visibilityState !== 'visible' || navigator.onLine === false) return;
    const state = qc.getQueryState(keys.updates());
    if (!state?.data || state.fetchStatus !== 'idle' || now() - state.dataUpdatedAt < FEED_REFRESH_AFTER_MS) return;
    void refreshFeed(qc);
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('pageshow', check);
  return () => {
    document.removeEventListener('visibilitychange', check);
    window.removeEventListener('pageshow', check);
  };
}
