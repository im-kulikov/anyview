import { useSyncExternalStore } from 'react';
import type { Episode, Title, TitleSummary } from '../api/contract';

/** Локальные данные (SPEC §7): ключи с версией, чтение в try/catch, битое сбрасывается, лимиты по размеру. */

interface Store<T> {
  get(): T;
  set(v: T): void;
  subscribe(cb: () => void): () => void;
}

function createStore<T>(key: string, fallback: T, valid: (v: unknown) => v is T): Store<T> {
  const fullKey = `anyview:v1:${key}`;
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | undefined;
  const memory: { raw: string | null } = { raw: null }; // localStorage недоступен — живём в памяти

  const readRaw = (): string | null => {
    try {
      return localStorage.getItem(fullKey);
    } catch {
      return memory.raw;
    }
  };
  const notify = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => e.key === fullKey && notify());
  }

  return {
    get() {
      const raw = readRaw();
      if (cache && cache.raw === raw) return cache.value;
      let value = fallback;
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (valid(parsed)) value = parsed;
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
      } catch {
        memory.raw = raw;
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
const isArr = (v: unknown): v is unknown[] => Array.isArray(v);

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

export const progressStore = createStore<Record<string, ProgressEntry>>('progress', {}, isObj as (v: unknown) => v is Record<string, ProgressEntry>);
export const historyStore = createStore<HistoryEntry[]>('history', [], isArr as (v: unknown) => v is HistoryEntry[]);
export const favoritesStore = createStore<TitleSummary[]>('favorites', [], isArr as (v: unknown) => v is TitleSummary[]);
export const recentStore = createStore<string[]>('recentSearches', [], (v): v is string[] => isArr(v) && v.every((x) => typeof x === 'string'));
export const prefsStore = createStore<Prefs>('prefs', DEFAULT_PREFS, (v): v is Prefs => isObj(v));

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
