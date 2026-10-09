import {
  ApiError,
  type CatalogInfo, type Episode, type Page, type Season, type Source, type Title, type TitleSummary,
} from '../../contract';
import type { ContentProvider } from '../../provider';
import { https } from '../../../lib/https';
import { createClient, form } from './client';
import {
  backdropOf, episodeOf, formatOf, genresOf, htmlToText, parseTitle, posterOf, ratingOf,
  sortPlaylist, statusOf, videoIdOf,
  type RawItem, type RawPlaylistItem,
} from './parse';

interface ListResponse {
  state: { status: string; count?: number | string };
  data: RawItem[];
}

const MAX_PAGE = 40;
const rawIdOf = (id: string): string => {
  const m = /^av-(\d+)$/.exec(id);
  if (!m) throw new ApiError('not_found', 'Тайтл не найден');
  return m[1];
};

export function toSummary(raw: RawItem, now = new Date()): TitleSummary {
  const p = parseTitle(raw.title, now);
  const format = formatOf(raw.type);
  const status = statusOf(p.episodes);
  const year = Number(raw.year);
  const rating = ratingOf(raw.rating, raw.votes);
  const poster = posterOf(raw);
  return {
    id: `av-${raw.id}`,
    type: 'anime',
    format,
    name: p.name,
    ...(p.originalName && { originalName: p.originalName }),
    ...(Number.isFinite(year) && year > 0 && { year }),
    status,
    ...(poster && { poster }),
    ...(rating && { rating }),
    ...(p.episodes && { episodes: p.episodes }),
    ...(status === 'ongoing' && format !== 'movie' && p.episodes && p.episodes.released >= 1 && {
      latestEpisode: { number: p.episodes.released, label: `${p.episodes.released} серия` },
    }),
  };
}

export function toTitle(raw: RawItem, now = new Date()): Title {
  const summary = toSummary(raw, now);
  const p = parseTitle(raw.title, now);
  const description = raw.description ? htmlToText(raw.description) : '';
  const backdrop = backdropOf(raw);
  return {
    ...summary,
    altNames: [],
    ...(description && { description }),
    ...(backdrop && { backdrop }),
    genres: genresOf(raw.genre),
    tags: [],
    ratings: summary.rating ? [summary.rating] : [],
    credits: { directors: raw.director?.trim() ? [raw.director.trim()] : [], studios: [] },
    voiceovers: ['AnimeVost'],
    ...(p.nextEpisode && { nextEpisode: p.nextEpisode }),
    externalIds: { animevost: String(raw.id) },
    providers: ['animevost'],
  };
}

export function createAnimevostProvider(bases: string[]): ContentProvider {
  const client = createClient(bases);
  const rawCache = new Map<string, RawItem>();
  const rawLoads = new Map<string, Promise<RawItem>>();
  const playlists = new Map<string, Promise<RawPlaylistItem[]>>();

  const remember = (items: RawItem[]) => items.forEach((r) => rawCache.set(String(r.id), r));

  const memo = <T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>) => {
    let p = map.get(key);
    if (!p) {
      p = load();
      map.set(key, p);
      p.catch(() => map.delete(key));
    }
    return p;
  };

  const loadRaw = (rawId: string): Promise<RawItem> => {
    const hit = rawCache.get(rawId);
    if (hit) return Promise.resolve(hit);
    return memo(rawLoads, rawId, async () => {
      const res = await client.request<ListResponse>('/info', form({ id: rawId }));
      const item = res.state?.status === 'ok' ? res.data?.[0] : undefined;
      if (!item) throw new ApiError('not_found', 'Тайтл не найден');
      remember([item]);
      return item;
    });
  };

  const loadPlaylist = (rawId: string) =>
    memo(playlists, rawId, async () => {
      const res = await client.request<unknown>('/playlist', form({ id: rawId }));
      if (!Array.isArray(res)) throw new ApiError('not_found', 'Тайтл не найден');
      return sortPlaylist(res as RawPlaylistItem[]);
    });

  return {
    async catalog(): Promise<CatalogInfo> {
      return {
        types: [
          { type: 'anime', label: 'Аниме', status: 'available' },
          { type: 'series', label: 'Сериалы', status: 'coming_soon' },
          { type: 'movie', label: 'Фильмы', status: 'coming_soon' },
        ],
      };
    },

    async updates({ page, pageSize, signal }): Promise<Page<TitleSummary>> {
      const size = Math.min(pageSize, MAX_PAGE);
      const res = await client.request<ListResponse>(`/last?page=${page}&quantity=${size}`, { signal });
      if (res.state?.status !== 'ok' || !Array.isArray(res.data)) {
        return { items: [], page, pageSize: size, hasMore: false };
      }
      remember(res.data);
      const total = Number(res.state.count);
      const now = new Date();
      return {
        items: res.data.map((r) => toSummary(r, now)),
        page,
        pageSize: size,
        total,
        hasMore: page * size < total,
      };
    },

    async title(id, signal) {
      const rawId = rawIdOf(id);
      const hit = rawCache.get(rawId);
      if (hit) return toTitle(hit);
      signal?.throwIfAborted();
      return toTitle(await loadRaw(rawId));
    },

    async episodes(titleId, signal): Promise<Season[]> {
      const rawId = rawIdOf(titleId);
      const [list, raw] = await Promise.all([loadPlaylist(rawId), loadRaw(rawId).catch(() => undefined)]);
      signal?.throwIfAborted();
      const episodes: Episode[] = list.map((p, i) => episodeOf(rawId, titleId, p, i));
      const next = raw && parseTitle(raw.title).nextEpisode;
      if (next && !episodes.some((e) => e.number === next.number)) {
        episodes.push({
          id: `av-${rawId}-next-${next.number}`,
          titleId,
          season: 1,
          number: next.number,
          name: `${next.number} серия`,
          ...(next.airDate && { airDate: next.airDate }),
          available: false,
        });
      }
      return [{ number: 1, episodes }];
    },

    async sources(episodeId, signal): Promise<Source[]> {
      const m = /^av-(\d+)-(.+)$/.exec(episodeId);
      if (!m) throw new ApiError('not_found', 'Серия не найдена');
      if (m[2].startsWith('next-')) return [];
      const list = await loadPlaylist(m[1]);
      signal?.throwIfAborted();
      const item = list.find((p, i) => (videoIdOf(p) ?? `i${i}`) === m[2]);
      if (!item) throw new ApiError('not_found', 'Серия не найдена');
      const make = (url: string, label: string, height: number): Source => ({
        id: `${episodeId}-${height}`,
        episodeId,
        provider: 'animevost',
        label: `${label} ${height}p · AnimeVost`,
        quality: { label, height },
        audio: [{ lang: 'ru', kind: 'dub', studio: 'AnimeVost' }],
        subtitles: [],
        stream: { kind: 'file', url: https(url), mime: 'video/mp4' },
      });
      return [
        ...(item.std ? [make(item.std, 'SD', 480)] : []),
        ...(item.hd ? [make(item.hd, 'HD', 720)] : []),
      ];
    },

    async search({ q, signal }): Promise<Page<TitleSummary>> {
      const empty: Page<TitleSummary> = { items: [], page: 1, pageSize: 0, total: 0, hasMore: false };
      let res: Response;
      try {
        res = await client.requestOnce('/search', { ...form({ name: q }), signal });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        // shortcut: 404 «ничего не найдено» приходит без CORS и неотличим от обрыва сети;
        // заменить прокси с CORS на всех ответах или своим сервером (RESEARCH.md §1.4).
        if (e instanceof TypeError && globalThis.navigator?.onLine !== false && client.baseWorked()) return empty;
        throw new ApiError('network', 'Нет соединения');
      }
      if (res.status === 404) return empty;
      if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`, res.status);
      let body: ListResponse;
      try {
        body = (await res.json()) as ListResponse;
      } catch {
        throw new ApiError('parse', 'Некорректный ответ API');
      }
      if (body.state?.status !== 'ok' || !Array.isArray(body.data)) return empty;
      remember(body.data);
      const now = new Date();
      const items = body.data.map((r) => toSummary(r, now));
      return { items, page: 1, pageSize: items.length, total: items.length, hasMore: false };
    },
  };
}
