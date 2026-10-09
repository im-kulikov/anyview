import {
  ApiError,
  type CatalogInfo, type Episode, type Page, type RelatedTitles, type Season, type Source, type Title, type TitleDetails, type TitleSummary,
} from '../../contract';
import type { ContentProvider } from '../../provider';
import { https } from '../../../lib/https';
import { createClient, form } from './client';
import { lastPath, MAX_PAGE } from './urls';
import { ANILIST, ANILIST_QUERY, pickShikimori, SHIKIMORI, toDetails, type AniListMedia, type ShikiAnime, type ShikiListItem } from './details';
import { REQUEST_TIMEOUT_MS } from './client';
import { classifyRelated, normTitle, relatedQuery } from './related';
import {
  backdropOf, episodesOf, formatOf, genresOf, htmlToText, parseTitle, posterOf, ratingOf,
  sortPlaylist, statusOf,
  type RawItem, type RawPlaylistItem,
} from './parse';

interface ListResponse {
  state: { status: string; count?: number | string };
  data: RawItem[];
}

/** Кэш адаптера живёт не дольше staleTime ленты: дальше свежесть решает TanStack Query. */
export const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 500;

/** Map с TTL и лимитом размера (вытесняется самая старая вставка). */
class TtlCache<V> {
  private m = new Map<string, { t: number; v: V }>();
  get(key: string): V | undefined {
    const e = this.m.get(key);
    if (!e) return undefined;
    if (Date.now() - e.t > CACHE_TTL_MS) {
      this.m.delete(key);
      return undefined;
    }
    return e.v;
  }
  set(key: string, v: V) {
    this.m.delete(key);
    this.m.set(key, { t: Date.now(), v });
    if (this.m.size > CACHE_MAX) this.m.delete(this.m.keys().next().value as string);
  }
  delete(key: string) {
    this.m.delete(key);
  }
}

interface Shared<T> { ctrl: AbortController; subs: number; done: boolean; p: Promise<T> }

/** Элемент ленты пригоден для маппинга: иначе пропускаем его, а не роняем страницу. */
const usable = (r: unknown): r is RawItem =>
  typeof r === 'object' && r !== null && typeof (r as RawItem).title === 'string' && (r as RawItem).id != null;
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

/** Запрос к внешней базе: таймаут + сигнал страницы; любой сбой — ApiError (Query не кэширует его как «данных нет»). */
async function extJson<T>(url: string, init: RequestInit | undefined, signal?: AbortSignal): Promise<T> {
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: sig });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError('network', 'Нет соединения');
  }
  if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`, res.status);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('parse', 'Некорректный ответ API');
  }
}

export function createAnimevostProvider(bases: string[]): ContentProvider {
  const client = createClient(bases);
  const rawCache = new TtlCache<RawItem>();
  const rawLoads = new TtlCache<Shared<RawItem>>();
  const playlists = new TtlCache<Shared<RawPlaylistItem[]>>();
  // Выдача поиска по франшизе: один запрос на нормализованный ключ для всех сезонов (related).
  const franchises = new TtlCache<Shared<TitleSummary[]>>();

  const remember = (items: RawItem[]) => items.forEach((r) => rawCache.set(String(r.id), r));

  /**
   * Один запрос на ключ для всех вызывающих. У запроса свой AbortController: он срабатывает, только когда
   * отменили ВСЕ подписчики (иначе уход одной страницы оборвал бы запрос другой); оборванный запрос из кэша удаляется.
   */
  const memo = <T>(cache: TtlCache<Shared<T>>, key: string, load: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> => {
    let e = cache.get(key);
    if (!e) {
      const ctrl = new AbortController();
      const created: Shared<T> = { ctrl, subs: 0, done: false, p: load(ctrl.signal) };
      e = created;
      cache.set(key, created);
      created.p.then(
        () => void (created.done = true),
        () => {
          created.done = true;
          if (cache.get(key) === created) cache.delete(key);
        },
      );
    }
    const shared = e;
    shared.subs++;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
        if (--shared.subs === 0 && !shared.done) {
          shared.ctrl.abort();
          if (cache.get(key) === shared) cache.delete(key);
        }
      };
      if (signal?.aborted) return onAbort();
      signal?.addEventListener('abort', onAbort, { once: true });
      shared.p.then(resolve, reject).finally(() => signal?.removeEventListener('abort', onAbort));
    });
  };

  const loadRaw = (rawId: string, signal?: AbortSignal): Promise<RawItem> => {
    const hit = rawCache.get(rawId);
    if (hit) return Promise.resolve(hit);
    return memo(rawLoads, rawId, async (sig) => {
      const res = await client.request<ListResponse>('/info', { ...form({ id: rawId }), signal: sig });
      const item = res.state?.status === 'ok' ? res.data?.[0] : undefined;
      if (!usable(item)) throw new ApiError('not_found', 'Тайтл не найден');
      remember([item]);
      return item;
    }, signal);
  };

  const loadPlaylist = (rawId: string, signal?: AbortSignal) =>
    memo(playlists, rawId, async (sig) => {
      const res = await client.request<unknown>('/playlist', { ...form({ id: rawId }), signal: sig });
      if (!Array.isArray(res)) throw new ApiError('not_found', 'Тайтл не найден');
      return sortPlaylist(res.filter((p): p is RawPlaylistItem => typeof p?.name === 'string'));
    }, signal);

  const self: ContentProvider = {
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
      const res = await client.request<ListResponse>(lastPath(page, size), { signal });
      if (res.state?.status !== 'ok' || !Array.isArray(res.data)) {
        // fail за концом списка — штатный конец; на первой странице это сбой API (повторяется как сетевой)
        if (page === 1) throw new ApiError('network', 'Лента временно недоступна');
        return { items: [], page, pageSize: size, hasMore: false };
      }
      const data = res.data.filter(usable);
      remember(data);
      const count = Number(res.state.count);
      const total = Number.isFinite(count) ? count : undefined;
      const now = new Date();
      return {
        items: data.map((r) => toSummary(r, now)),
        page,
        pageSize: size,
        ...(total !== undefined && { total }),
        hasMore: total !== undefined ? page * size < total : res.data.length >= size,
      };
    },

    async title(id, signal) {
      const rawId = rawIdOf(id);
      const hit = rawCache.get(rawId);
      if (hit) return toTitle(hit);
      return toTitle(await loadRaw(rawId, signal));
    },

    async episodes(titleId, signal): Promise<Season[]> {
      const rawId = rawIdOf(titleId);
      const [list, raw] = await Promise.all([loadPlaylist(rawId, signal), loadRaw(rawId, signal).catch(() => undefined)]);
      signal?.throwIfAborted();
      const episodes: Episode[] = episodesOf(rawId, titleId, list);
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
      const list = await loadPlaylist(m[1], signal);
      signal?.throwIfAborted();
      const item = list[episodesOf(m[1], '', list).findIndex((e) => e.id === episodeId)];
      if (!item) throw new ApiError('not_found', 'Серия не найдена');
      const make = (raw: string, label: string, height: number): Source[] => {
        const url = https(raw);
        return url ? [{
        id: `${episodeId}-${height}`,
        episodeId,
        provider: 'animevost',
        label: `${label} ${height}p · AnimeVost`,
        quality: { label, height },
        audio: [{ lang: 'ru', kind: 'dub', studio: 'AnimeVost' }],
        subtitles: [],
        stream: { kind: 'file', url, mime: 'video/mp4' },
      }] : [];
      };
      return [
        ...(item.std ? make(item.std, 'SD', 480) : []),
        ...(item.hd ? make(item.hd, 'HD', 720) : []),
      ];
    },

    async search({ q, signal }): Promise<Page<TitleSummary>> {
      const empty: Page<TitleSummary> = { items: [], page: 1, pageSize: 0, total: 0, hasMore: false };
      let res: Response;
      try {
        res = await client.requestOnce('/search', { ...form({ name: q }), signal });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        // shortcut: 404 «ничего не найдено» приходит без CORS и неотличим от обрыва сети. Различаем контрольным
        // запросом (лента, 1 элемент, CORS открыт): отвечает — значит поиск ничего не нашёл. Заменить прокси с CORS
        // на всех ответах или своим сервером (RESEARCH.md §1.4).
        if (!(e instanceof TypeError) || globalThis.navigator?.onLine === false) throw new ApiError('network', 'Нет соединения');
        try {
          const probe = await client.requestOnce(lastPath(1, 1), { signal });
          if (probe.ok) return empty;
        } catch (e2) {
          if (e2 instanceof DOMException && e2.name === 'AbortError') throw e2;
        }
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
      const data = body.data.filter(usable);
      remember(data);
      const now = new Date();
      const items = data.map((r) => toSummary(r, now));
      return { items, page: 1, pageSize: items.length, total: items.length, hasMore: false };
    },

    /**
     * Жанры, первоисточник, автор, герои с сейю из Shikimori и AniList (ADR-30). Нет строгого совпадения — пусто.
     * Сбой Shikimori бросается (не кэшируется как «данных нет»); сбой AniList лишь убирает его поля.
     */
    async details(id, signal): Promise<TitleDetails> {
      const cur = await self.title(id, signal);
      const names = [cur.originalName, cur.name].filter((n): n is string => !!n);
      const none: TitleDetails = { genres: [], studios: [], characters: [], providers: [] };
      const list = await extJson<ShikiListItem[]>(`${SHIKIMORI}/animes?limit=10&search=${encodeURIComponent(names[0])}`, undefined, signal);
      const hit = Array.isArray(list) ? pickShikimori(list, names, cur.year) : undefined;
      if (!hit) return none;
      const shiki = await extJson<ShikiAnime>(`${SHIKIMORI}/animes/${hit.id}`, undefined, signal);
      let ani: AniListMedia | undefined;
      if (shiki.myanimelist_id) {
        try {
          const r = await extJson<{ data?: { Media?: AniListMedia } }>(ANILIST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: ANILIST_QUERY, variables: { mal: shiki.myanimelist_id } }),
          }, signal);
          ani = r.data?.Media ?? undefined;
        } catch (e) {
          if (signal?.aborted) throw e;
        }
      }
      return toDetails(shiki, ani);
    },

    /**
     * «Ничего не найдено» (404 без CORS, правило поиска §5.1) = пустой результат. Сетевой сбой бросается как ApiError,
     * чтобы Query не закэшировал «связей нет» на час: интерфейс ошибку молча игнорирует. Правила — related.ts, ADR-29.
     */
    async related(id, signal): Promise<RelatedTitles> {
      const none: RelatedTitles = { seasons: [], similar: [] };
      try {
        const cur = await self.title(id, signal);
        const q = relatedQuery(cur.name);
        if (!q) return none;
        const items = await memo(franchises, normTitle(q), async (sig) => (await self.search({ q, page: 1, pageSize: 50, signal: sig })).items, signal);
        return classifyRelated(cur, items);
      } catch (e) {
        if (e instanceof ApiError && e.kind === 'not_found') return none;
        throw e;
      }
    },
  };
  return self;
}
