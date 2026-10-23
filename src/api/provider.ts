import type {
  CatalogInfo, ContentType, FranchiseRef, Page, RelatedTitles, Season, Source, Title, TitleDetails, TitleSummary,
} from './contract';

export interface ContentProvider {
  catalog(): Promise<CatalogInfo>;
  updates(p: { type: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
  title(id: string, signal?: AbortSignal): Promise<Title>;
  episodes(titleId: string, signal?: AbortSignal): Promise<Season[]>;
  sources(episodeId: string, signal?: AbortSignal): Promise<Source[]>;
  details(id: string, signal?: AbortSignal): Promise<TitleDetails>;
  /** Локально и синхронно, по полям карточки: к какой франшизе и какому сезону относится тайтл (без сети; у сервера — по его данным). */
  franchiseOf(t: TitleSummary): FranchiseRef | undefined;
  /** Локально и синхронно: адреса одной обложки по порядку предпочтения (зеркала, сжатие); первый — основной. Для чужих адресов — `[url]`. */
  imageUrls(url: string): string[];
  related(id: string, signal?: AbortSignal): Promise<RelatedTitles>;
  search(p: { q: string; type?: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
}
