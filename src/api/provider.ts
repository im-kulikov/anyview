import type {
  CatalogInfo, ContentType, Page, Season, Source, Title, TitleSummary,
} from './contract';

export interface ContentProvider {
  catalog(): Promise<CatalogInfo>;
  updates(p: { type: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
  title(id: string, signal?: AbortSignal): Promise<Title>;
  episodes(titleId: string, signal?: AbortSignal): Promise<Season[]>;
  sources(episodeId: string, signal?: AbortSignal): Promise<Source[]>;
  search(p: { q: string; type?: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
}
