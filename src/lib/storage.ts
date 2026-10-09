import { useSyncExternalStore } from 'react';
import type { Episode, Title, TitleSummary } from '../api/contract';

/** Локальные данные (SPEC §7): ключи с версией, чтение в try/catch, битое сбрасывается, лимиты по размеру. */

interface Store<T> {
  get(): T;
  set(v: T): void;
  subscribe(cb: () => void): () => void;
}

/** parse: недоверенный JSON → валидное значение (негодные элементы отбрасываются по одному) или undefined. */
function createStore<T>(key: string, fallback: T, parse: (v: unknown) => T | undefined): Store<T> {
  const fullKey = `anyview:v1:${key}`;
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | undefined;
  // localStorage недоступен или переполнен — после первой ошибки записи живём в памяти.
  const memory: { raw: string | null; degraded: boolean } = { raw: null, degraded: false };

  const readRaw = (): string | null => {
    if (memory.degraded) return memory.raw;
    try {
      return localStorage.getItem(fullKey);
    } catch {
      return memory.raw;
    }
  };
  const notify = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    // key === null — очистка хранилища в другой вкладке
    window.addEventListener('storage', (e) => (e.key === null || e.key === fullKey) && notify());
  }

  return {
    get() {
      const raw = readRaw();
      if (cache && cache.raw === raw) return cache.value;
      let value = fallback;
      if (raw) {
        try {
          value = parse(JSON.parse(raw)) ?? fallback;
        } catch {
          /* битые данные сбрасываются */
        }
      }
      cache = { raw, value };
      return value;
    },
    set(v) {
      const raw = JSON.stringify(v);
      try {
        localStorage.setItem(fullKey, raw);
        memory.degraded = false;
      } catch {
        memory.raw = raw;
        memory.degraded = true;
      }
      cache = { raw, value: v };
      notify();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const listOf = <T>(ok: (x: unknown) => x is T) => (v: unknown): T[] | undefined => (Array.isArray(v) ? v.filter(ok) : undefined);

const isSummary = (x: unknown): x is TitleSummary =>
  isObj(x) && isStr(x.id) && isStr(x.name) && isStr(x.type) && isStr(x.format) && isStr(x.status);
const isHistory = (x: unknown): x is HistoryEntry =>
  isObj(x) && isSummary(x.title) && isStr(x.episodeId) && isStr(x.episodeName) && isNum(x.position) && isNum(x.duration) && isNum(x.updatedAt);
const isProgress = (x: unknown): x is ProgressEntry =>
  isObj(x) && isStr(x.titleId) && isNum(x.position) && isNum(x.duration) && isNum(x.updatedAt);

const parseProgress = (v: unknown): Record<string, ProgressEntry> | undefined =>
  isObj(v) ? Object.fromEntries(Object.entries(v).filter(([, e]) => isProgress(e))) as Record<string, ProgressEntry> : undefined;

const QUALITIES = ['auto', 'sd', 'hd'];
export const clampVolume = (v: number) => Math.min(1, Math.max(0, v));
/** Поля проверяются по одному: битое поле заменяется значением по умолчанию. */
const parsePrefs = (v: unknown): Prefs | undefined => {
  if (!isObj(v)) return undefined;
  const d = DEFAULT_PREFS;
  return {
    quality: QUALITIES.includes(v.quality as string) ? (v.quality as Prefs['quality']) : d.quality,
    autoNext: typeof v.autoNext === 'boolean' ? v.autoNext : d.autoNext,
    volume: isNum(v.volume) ? clampVolume(v.volume) : d.volume,
    muted: typeof v.muted === 'boolean' ? v.muted : d.muted,
  };
};

export interface ProgressEntry { titleId: string; position: number; duration: number; updatedAt: number }
export interface HistoryEntry {
  title: TitleSummary;
  episodeId: string;
  episodeName: string;
  still?: string;
  position: number;
  duration: number;
  updatedAt: number;
}
export interface Prefs { quality: 'auto' | 'sd' | 'hd'; autoNext: boolean; volume: number; muted: boolean }

export const DEFAULT_PREFS: Prefs = { quality: 'auto', autoNext: true, volume: 1, muted: false };
export const LIMITS = { progress: 500, history: 50, favorites: 200, recent: 8 };

export const progressStore = createStore<Record<string, ProgressEntry>>('progress', {}, parseProgress);
export const historyStore = createStore<HistoryEntry[]>('history', [], listOf(isHistory));
export const favoritesStore = createStore<TitleSummary[]>('favorites', [], listOf(isSummary));
export const recentStore = createStore<string[]>('recentSearches', [], listOf(isStr));
/** Первая страница ленты для мгновенного показа при повторном визите (api/feedCache.ts); всегда перепроверяется сетью. */
export interface FeedSnapshot { savedAt: number; items: TitleSummary[]; total?: number; hasMore: boolean }
const parseFeed = (v: unknown): FeedSnapshot | undefined => {
  if (!isObj(v) || !isNum(v.savedAt) || !Array.isArray(v.items)) return undefined;
  const items = v.items.filter(isSummary);
  return items.length ? { savedAt: v.savedAt, items, ...(isNum(v.total) && { total: v.total }), hasMore: v.hasMore !== false } : undefined;
};
export const feedStore = createStore<FeedSnapshot | null>('feed', null, parseFeed);
export const prefsStore = createStore<Prefs>('prefs', DEFAULT_PREFS, parsePrefs);

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.get());
}

export const getPrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...prefsStore.get() });
export const setPrefs = (patch: Partial<Prefs>) => prefsStore.set({ ...getPrefs(), ...patch });
export const usePrefs = (): Prefs => ({ ...DEFAULT_PREFS, ...useStore(prefsStore) });

export const WATCHED = 0.9;
export const isWatched = (p?: { position: number; duration: number }) =>
  !!p && p.duration > 0 && p.position / p.duration >= WATCHED;

/** Только поля TitleSummary — снимок для «Продолжить просмотр» и «Избранного» без сети. */
export function toSnapshot(t: TitleSummary | Title): TitleSummary {
  const { id, type, format, name, originalName, year, status, poster, rating, episodes, latestEpisode, updatedAt } = t;
  return { id, type, format, name, originalName, year, status, poster, rating, episodes, latestEpisode, updatedAt };
}

export function saveProgress(a: {
  title: TitleSummary | Title;
  episode: Episode;
  /** Следующая доступная серия: на неё переходит запись истории после просмотра. */
  next?: Episode;
  position: number;
  duration: number;
}) {
  const now = Date.now();
  const { episode, next, position, duration } = a;
  const progress = { ...progressStore.get(), [episode.id]: { titleId: episode.titleId, position, duration, updatedAt: now } };
  const ids = Object.keys(progress);
  if (ids.length > LIMITS.progress) {
    ids.sort((x, y) => progress[x].updatedAt - progress[y].updatedAt).slice(0, ids.length - LIMITS.progress).forEach((k) => delete progress[k]);
  }
  progressStore.set(progress);

  const rest = historyStore.get().filter((h) => h.title.id !== a.title.id);
  const snapshot = toSnapshot(a.title);
  if (isWatched({ position, duration })) {
    // досмотрено: запись переходит на следующую серию, а если её нет — удаляется
    if (next) {
      historyStore.set([{ title: snapshot, episodeId: next.id, episodeName: next.name, still: next.preview?.url, position: 0, duration: 0, updatedAt: now }, ...rest].slice(0, LIMITS.history));
    } else historyStore.set(rest);
  } else {
    historyStore.set([{ title: snapshot, episodeId: episode.id, episodeName: episode.name, still: episode.preview?.url, position, duration, updatedAt: now }, ...rest].slice(0, LIMITS.history));
  }
}

/** «С начала»: сбросить позицию серии. */
export function resetProgress(episodeId: string) {
  const p = progressStore.get();
  if (!p[episodeId]) return;
  progressStore.set({ ...p, [episodeId]: { ...p[episodeId], position: 0 } });
  historyStore.set(historyStore.get().map((h) => (h.episodeId === episodeId ? { ...h, position: 0 } : h)));
}

export const isFavorite = (list: TitleSummary[], id: string) => list.some((t) => t.id === id);

export function toggleFavorite(t: TitleSummary | Title) {
  const list = favoritesStore.get();
  favoritesStore.set(isFavorite(list, t.id) ? list.filter((x) => x.id !== t.id) : [toSnapshot(t), ...list].slice(0, LIMITS.favorites));
}

export function addRecentSearch(q: string) {
  const text = q.trim();
  if (text.length < 2) return;
  recentStore.set([text, ...recentStore.get().filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, LIMITS.recent));
}
