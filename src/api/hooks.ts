import { queryOptions, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { provider } from './index';
import { FEED_PAGE_SIZE, keys, STALE } from './keys';
import type { TitleSummary } from './contract';

/** Параметры запросов — единственное место, где связаны ключ и queryFn: хуки, prefetch и main.tsx берут отсюда. */

/** Лента обновлений (общая для главной и `/anime`). */
export const updatesQuery = (type: 'anime' = 'anime') => ({
  queryKey: keys.updates(type),
  queryFn: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
    provider.updates({ type, page: pageParam, pageSize: FEED_PAGE_SIZE, signal }),
  initialPageParam: 1,
  getNextPageParam: (last: { hasMore: boolean; page: number }) => (last.hasMore ? last.page + 1 : undefined),
  staleTime: STALE.list,
  refetchOnMount: false as const,
});

export const titleQuery = (id: string) =>
  queryOptions({ queryKey: keys.title(id), queryFn: ({ signal }) => provider.title(id, signal), staleTime: STALE.item });

export const episodesQuery = (id: string) =>
  queryOptions({ queryKey: keys.episodes(id), queryFn: ({ signal }) => provider.episodes(id, signal), staleTime: STALE.item });

export const sourcesQuery = (episodeId: string) =>
  queryOptions({ queryKey: keys.sources(episodeId), queryFn: ({ signal }) => provider.sources(episodeId, signal), staleTime: STALE.item });

/** Сезоны и «Похожие»: адаптер не бросает ошибок, повторов нет; хук вызывают после появления тайтла. */
export const detailsQuery = (id: string) =>
  queryOptions({ queryKey: keys.details(id), queryFn: ({ signal }) => provider.details(id, signal), staleTime: STALE.item, retry: 0 });
export const relatedQuery = (id: string) =>
  queryOptions({ queryKey: keys.related(id), queryFn: ({ signal }) => provider.related(id, signal), staleTime: STALE.item, retry: 0 });

/** Ключ нормализован (регистр и пробелы по краям), в запрос уходит текст как набран. */
export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: keys.search(q.trim().toLowerCase()),
    queryFn: ({ signal }) => provider.search({ q: q.trim(), page: 1, pageSize: 50, signal }),
    staleTime: STALE.list,
  });

/** Живая лента даёт дубли между страницами — склеиваем по id. */
export function dedupe(pages: { items: TitleSummary[] }[]): TitleSummary[] {
  const seen = new Set<string>();
  return pages.flatMap((p) => p.items).filter((t) => !seen.has(t.id) && !!seen.add(t.id));
}

/** Вне компонента: стабильная ссылка, чтобы `select` не пересчитывался на каждом рендере. */
const selectFeed = <D extends { pages: { items: TitleSummary[] }[] }>(d: D) => ({ ...d, items: dedupe(d.pages) });

export const useUpdates = () => useInfiniteQuery({ ...updatesQuery(), select: selectFeed });

export const useTitle = (id: string) => useQuery(titleQuery(id));

export const useEpisodes = (id: string) => useQuery(episodesQuery(id));

export const useDetails = (id: string) => useQuery(detailsQuery(id));
export const useRelated = (id: string) => useQuery(relatedQuery(id));

export const useSources = (episodeId: string | undefined) =>
  useQuery({ ...sourcesQuery(episodeId ?? ''), enabled: !!episodeId });

export const useSearch = (q: string) => useQuery({ ...searchQuery(q), enabled: q.trim().length >= 2, retry: 0 });
