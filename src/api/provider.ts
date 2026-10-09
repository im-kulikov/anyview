import type {
  CatalogInfo, ContentType, Page, RelatedTitles, Season, Source, Title, TitleSummary,
} from './contract';

export interface ContentProvider {
  catalog(): Promise<CatalogInfo>;
  updates(p: { type: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
  title(id: string, signal?: AbortSignal): Promise<Title>;
  episodes(titleId: string, signal?: AbortSignal): Promise<Season[]>;
  sources(episodeId: string, signal?: AbortSignal): Promise<Source[]>;
  related(id: string, signal?: AbortSignal): Promise<RelatedTitles>;
  search(p: { q: string; type?: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
}
