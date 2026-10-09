import { ApiError, type CatalogInfo, type Page, type TitleSummary } from '../contract';
import type { ContentProvider } from '../provider';

const empty = <T>(): Page<T> => ({ items: [], page: 1, pageSize: 0, total: 0, hasMore: false });
const notFound = () => Promise.reject(new ApiError('not_found', 'Раздел в разработке'));

/** Сериалы и фильмы в MVP: каталог помечен coming_soon, данных нет. */
export const comingSoonProvider: ContentProvider = {
  catalog: async (): Promise<CatalogInfo> => ({
    types: [
      { type: 'series', label: 'Сериалы', status: 'coming_soon' },
      { type: 'movie', label: 'Фильмы', status: 'coming_soon' },
    ],
  }),
  updates: async () => empty<TitleSummary>(),
  search: async () => empty<TitleSummary>(),
  title: notFound,
  episodes: notFound,
  sources: notFound,
  related: async () => ({ seasons: [], similar: [] }),
};
