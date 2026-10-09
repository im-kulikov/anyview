import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { provider } from './index';
import { FEED_PAGE_SIZE, keys, STALE } from './keys';
import type { TitleSummary } from './contract';

/** Параметры ленты — общие для хука и prefetch в main.tsx. */
export const updatesQuery = () => ({
  queryKey: keys.updates(),
  queryFn: ({ pageParam, signal }: { pageParam: number; signal: AbortSignal }) =>
    provider.updates({ type: 'anime', page: pageParam, pageSize: FEED_PAGE_SIZE, signal }),
  initialPageParam: 1,
  getNextPageParam: (last: { hasMore: boolean; page: number }) => (last.hasMore ? last.page + 1 : undefined),
  staleTime: STALE.list,
  refetchOnMount: false as const,
});

/** Живая лента даёт дубли между страницами — склеиваем по id. */
export function dedupe(pages: { items: TitleSummary[] }[]): TitleSummary[] {
  const seen = new Set<string>();
  return pages.flatMap((p) => p.items).filter((t) => !seen.has(t.id) && !!seen.add(t.id));
}

export const useUpdates = () => useInfiniteQuery({ ...updatesQuery(), select: (d) => ({ ...d, items: dedupe(d.pages) }) });

export const useTitle = (id: string) =>
  useQuery({ queryKey: keys.title(id), queryFn: ({ signal }) => provider.title(id, signal), staleTime: STALE.item });

export const useEpisodes = (id: string) =>
  useQuery({ queryKey: keys.episodes(id), queryFn: ({ signal }) => provider.episodes(id, signal), staleTime: STALE.item });

export const useSources = (episodeId: string | undefined) =>
  useQuery({
    queryKey: keys.sources(episodeId ?? ''),
    queryFn: ({ signal }) => provider.sources(episodeId!, signal),
    enabled: !!episodeId,
    staleTime: STALE.item,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: keys.search(q),
    queryFn: ({ signal }) => provider.search({ q, page: 1, pageSize: 50, signal }),
    enabled: q.trim().length >= 2,
    staleTime: STALE.list,
    retry: 0,
  });
