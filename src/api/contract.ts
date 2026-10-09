// Источник истины — docs/API_CONTRACT.md §2. Менять только вместе с документом.

export type ContentType = 'anime' | 'series' | 'movie';
export type TitleFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'short' | 'unknown';
export type TitleStatus = 'announced' | 'ongoing' | 'released' | 'unknown';

export interface Image {
  url: string;                                  // всегда абсолютный https
  width?: number;
  height?: number;
  srcset?: { url: string; width: number }[];    // если источник даёт размеры
}

export interface Rating {
  source: string;        // 'animevost' | 'shikimori' | 'kinopoisk' | 'imdb' | 'tmdb' | ...
  value: number;         // нормализовано к 0–10, одна цифра после точки
  votes?: number;
}

export interface Tag { id: string; name: string }

export interface EpisodeCounter {
  released: number;             // сколько серий вышло
  total?: number;               // сколько запланировано, если известно
  totalIsEstimate?: boolean;    // «12+» у animevost
}

/** Карточка в сетке/ленте. Минимум полей — быстрые списки. */
export interface TitleSummary {
  id: string;                   // непрозрачная строка; фронтенд не разбирает её
  type: ContentType;
  format: TitleFormat;
  name: string;                 // RU
  originalName?: string;
  year?: number;
  status: TitleStatus;
  poster?: Image;
  rating?: Rating;              // основной рейтинг для карточки
  episodes?: EpisodeCounter;
  latestEpisode?: { number: number; label: string };  // бейдж «7 серия»; только у онгоингов
  updatedAt?: string;           // ISO 8601
}

/** Страница тайтла. */
export interface Title extends TitleSummary {
  altNames: string[];
  description?: string;         // ПЛОСКИЙ текст, абзацы через \n. HTML источника не пропускаем.
  backdrop?: Image;
  genres: Tag[];
  tags: Tag[];
  ratings: Rating[];
  ageRating?: string;           // '16+'
  credits: { directors: string[]; studios: string[] };
  voiceovers: string[];         // команды озвучки, напр. ['AnimeVost']
  nextEpisode?: { number: number; airDate?: string /* YYYY-MM-DD */ };
  externalIds: ExternalIds;
  providers: string[];          // откуда собраны данные
}

export interface ExternalIds {
  shikimori?: string; mal?: string; anilist?: string; anidb?: string;
  kinopoisk?: string; imdb?: string; tmdb?: string; tmdbType?: 'movie' | 'tv';
  tvmaze?: string; myshows?: string; wikidata?: string;
  animevost?: string; aniliberty?: string;
}

export interface Season {
  number: number;               // 1 по умолчанию; у фильма всегда 1
  name?: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;                   // непрозрачная строка
  titleId: string;
  season: number;
  number?: number;              // номер в сезоне; нет у спецвыпусков и фильмов
  absoluteNumber?: number;      // сквозной номер (аниме)
  name: string;                 // '7 серия' | 'Фильм' | 'OVA'
  airDate?: string;             // YYYY-MM-DD
  durationSec?: number;
  preview?: Image;              // кадр 16:9
  available: boolean;           // false = анонсирована, ещё не вышла
}

/** Вариант просмотра одной серии: конкретный файл, поток, плеер-iframe или торрент-релиз. */
export interface Source {
  id: string;
  episodeId: string;
  provider: string;             // 'animevost' | 'aniliberty' | 'torrent:rutor' | 'kodik' | ...
  label: string;                // что показать в выборе: 'HD 720p · AnimeVost'
  quality: { label: string; height?: number };   // 'SD'/'HD'/'1080p'; выбор качества — по height
  audio: AudioTrack[];
  subtitles: SubtitleTrack[];
  release?: string;             // сырое имя релиза (торренты)
  sizeBytes?: number;
  seeders?: number;
  /** Готовый поток, если источник играбелен сразу (animevost, AniLiberty, iframe). */
  stream?: Stream;
  /** Нет stream → нужен POST /v1/playback (торренты, перекодирование). */
  needsPlaybackSession?: boolean;
}

export interface Stream {
  kind: 'file' | 'hls' | 'dash' | 'iframe';
  url: string;                  // всегда https
  mime?: string;                // 'video/mp4', 'application/vnd.apple.mpegurl'
  expiresAt?: string;
}

export interface AudioTrack {
  lang: string;                 // BCP 47: 'ru', 'ja', 'en'
  kind: 'dub' | 'mvo' | 'avo' | 'original';
  studio?: string;              // 'AnimeVost', 'LostFilm'
  codec?: string;
  channels?: number;
}

export interface SubtitleTrack {
  lang: string;
  label?: string;
  format: 'vtt' | 'srt' | 'ass' | 'pgs';
  url?: string;
}

export interface Page<T> {
  items: T[];
  page: number;                 // с 1
  pageSize: number;
  total?: number;
  hasMore: boolean;
}

/** Ссылка на сезон франшизы (блок «Сезоны» на странице тайтла). */
export interface SeasonLink {
  id: string;                   // id тайтла-сезона; переход — обычная навигация
  number: number;               // номер сезона
  label: string;                // '2 сезон'
  year?: number;
  current: boolean;             // это открытый сейчас тайтл
}

/** Связи тайтла. Пустые списки — штатный ответ (связей нет или не удалось определить). */
export interface RelatedTitles {
  seasons: SeasonLink[];        // по возрастанию номера; UI показывает блок при ≥ 2
  similar: TitleSummary[];      // OVA, фильмы, спэшлы, спин-оффы, ремейки; без самого тайтла, по году; ≤ 40
}

/** Главный герой и его японский сейю. */
export interface CharacterInfo {
  name: string;
  voiceActor?: string;
}

/**
 * Дополнительные сведения о тайтле из внешних баз (отдельно от `Title`: грузятся вторым запросом, страницу не задерживают).
 * Пустой результат — штатный ответ: тайтл в базах не найден или сведений нет.
 */
export interface TitleDetails {
  genres: string[];             // RU, жанры и темы
  source?: string;              // первоисточник: 'Ранобэ', 'Манга'
  author?: string;              // автор оригинала
  ageRating?: string;           // 'PG-13', 'R-17'
  studios: string[];
  characters: CharacterInfo[];  // главные герои, ≤ 6
  providers: string[];          // откуда сведения: ['shikimori', 'anilist']
}

/** Что умеет бэкенд: фронтенд рисует «скоро» по status, а не по хардкоду. */
export interface CatalogInfo {
  types: { type: ContentType; label: string; status: 'available' | 'coming_soon' }[];
}

/** Единственный тип ошибки, который провайдер отдаёт наружу. */
export type ApiErrorKind = 'network' | 'http' | 'parse' | 'not_found';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}
