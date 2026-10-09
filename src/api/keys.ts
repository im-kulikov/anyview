import type { ContentType } from './contract';

export const FEED_PAGE_SIZE = 30;

export const keys = {
  updates: (type: ContentType = 'anime', pageSize = FEED_PAGE_SIZE) => ['updates', type, pageSize] as const,
  title: (id: string) => ['title', id] as const,
  episodes: (id: string) => ['episodes', id] as const,
  sources: (episodeId: string) => ['sources', episodeId] as const,
  search: (q: string) => ['search', q] as const,
};

const MIN = 60_000;
export const STALE = { list: 5 * MIN, item: 60 * MIN };
