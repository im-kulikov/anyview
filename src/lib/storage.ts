import { useSyncExternalStore } from 'react';
import type { Episode, Title, TitleSummary } from '../api/contract';

/** Локальные данные (SPEC §7): ключи с версией, чтение в try/catch, битое сбрасывается, лимиты по размеру. */

/** Версия схемы всех ключей `anyview:v1:*` в целом. Менять вместе с записью в MIGRATIONS (ADR-17). */
export const SCHEMA_VERSION = 2;
const SCHEMA_KEY = 'anyview:schema';
type Kv = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * `MIGRATIONS[n]` переводит данные с версии n на n+1 (читает и пишет ключи напрямую).
 * 1 → 2: метки времени избранного для синхронизации (ADR-27). Уже добавленные тайтлы получают `at` = 1, 2, … по порядку списка («давно, точное время неизвестно»):
 * удаление на другом устройстве после этого момента победит, а свежие добавления — нет.
 */
export const MIGRATIONS: Record<number, (kv: Kv) => void> = {
  1: (kv) => {
    const META = 'anyview:v1:favoritesMeta';
    const raw = kv.getItem('anyview:v1:favorites');
    if (!raw || kv.getItem(META) !== null) return;
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    const meta: Record<string, FavMeta> = {};
    // at = 1, 2, …: порядок «новые сверху» сохраняется, а все метки заведомо старше любых новых действий
    const ok = list.filter(isSummary);
    ok.forEach((t, i) => (meta[t.id] = { at: ok.length - i }));
    kv.setItem(META, JSON.stringify(meta));
  },
};

/**
 * Приводит хранилище к текущей схеме. Нет записи о версии — это v1 (так записаны данные, появившиеся до версионирования).
 * Миграция, упавшая с ошибкой, останавливает процесс без повышения версии: поэлементная валидация всё равно защищает чтение.
 * Запись версии, более новой, чем знает код (откат деплоя), не понижается.
 */
export function migrate(kv: Kv, migrations = MIGRATIONS, target = SCHEMA_VERSION): number {
  let v = Number(kv.getItem(SCHEMA_KEY)) || 1;
  if (v > target) return v;
  try {
    for (; v < target; v++) migrations[v]?.(kv);
    kv.setItem(SCHEMA_KEY, String(v));
  } catch {
    /* повторим при следующем запуске */
  }
  return v;
}

/** Кэши (не пользовательские данные), которые можно потерять ради записи важного. */
const EVICTABLE = ['anyview:v1:feed'];

/** Освободить место: выбрасываем кэши. Возвращает true, если было что выбросить. */
function evictCaches(): boolean {
  let any = false;
  for (const k of EVICTABLE) {
    try {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
        any = true;
      }
    } catch {
      /* недоступен */
    }
  }
  return any;
}

/** Уведомления подписчиков, отложенные до конца `batch()`: несколько `set` подряд дают один согласованный перерисованный снимок (ARCH-23). */
let batchDepth = 0;
const pending = new Set<() => void>();

/** Выполняет `fn`, а подписчиков всех затронутых хранилищ уведомляет один раз в конце. Значения читаются сразу актуальными. */
export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    if (--batchDepth === 0) {
      const run = [...pending];
      pending.clear();
      run.forEach((l) => l());
    }
  }
}

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
  const notify = () => listeners.forEach((l) => (batchDepth > 0 ? pending.add(l) : l()));
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
        try {
          localStorage.setItem(fullKey, raw);
        } catch (e) {
          // квота: пробуем освободить место за счёт кэшей и повторяем один раз
          if (!evictCaches()) throw e;
          localStorage.setItem(fullKey, raw);
        }
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

try {
  migrate(localStorage);
} catch {
  /* localStorage недоступен */
}

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

/** Метка избранного для слияния между устройствами: когда добавлено (`at`) или, при `del`, когда удалено («надгробие»). */
export interface FavMeta { at: number; del?: true }

export const DEFAULT_PREFS: Prefs = { quality: 'auto', autoNext: true, volume: 1, muted: false };
export const LIMITS = { progress: 500, history: 50, favorites: 200, recent: 8, tombstones: 300 };

export const progressStore = createStore<Record<string, ProgressEntry>>('progress', {}, parseProgress);
export const historyStore = createStore<HistoryEntry[]>('history', [], listOf(isHistory));
export const favoritesStore = createStore<TitleSummary[]>('favorites', [], listOf(isSummary));
const isMeta = (x: unknown): x is FavMeta => isObj(x) && isNum(x.at) && (x.del === undefined || x.del === true);
const parseMeta = (v: unknown): Record<string, FavMeta> | undefined =>
  isObj(v) ? (Object.fromEntries(Object.entries(v).filter(([, m]) => isMeta(m))) as Record<string, FavMeta>) : undefined;
export const favoritesMetaStore = createStore<Record<string, FavMeta>>('favoritesMeta', {}, parseMeta);
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
  batch(() => saveProgressNow(a));
}

function saveProgressNow(a: Parameters<typeof saveProgress>[0]) {
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

/** «С начала»: сбросить позицию серии. `updatedAt` обновляется: иначе при слиянии с другим устройством сброс проиграл бы старой записи. */
export function resetProgress(episodeId: string) {
  const p = progressStore.get();
  if (!p[episodeId]) return;
  const now = Date.now();
  batch(() => {
    progressStore.set({ ...p, [episodeId]: { ...p[episodeId], position: 0, updatedAt: now } });
    historyStore.set(historyStore.get().map((h) => (h.episodeId === episodeId ? { ...h, position: 0, updatedAt: now } : h)));
  });
}

export const isFavorite = (list: TitleSummary[], id: string) => list.some((t) => t.id === id);

/** Живые метки — только для тайтлов из списка; «надгробий» не больше LIMITS.tombstones, самые свежие. Чистая: используется и слиянием. */
export function pruneFavMeta(meta: Record<string, FavMeta>, list: TitleSummary[]): Record<string, FavMeta> {
  const alive = new Set(list.map((t) => t.id));
  const out: Record<string, FavMeta> = {};
  for (const [id, m] of Object.entries(meta)) if (m.del || alive.has(id)) out[id] = m;
  const dead = Object.entries(out).filter(([, m]) => m.del).sort(([ia, a], [ib, b]) => b.at - a.at || (ia < ib ? -1 : 1));
  for (const [id] of dead.slice(LIMITS.tombstones)) delete out[id];
  return out;
}

export function toggleFavorite(t: TitleSummary | Title) {
  const list = favoritesStore.get();
  const now = Date.now();
  const removing = isFavorite(list, t.id);
  const next = removing ? list.filter((x) => x.id !== t.id) : [toSnapshot(t), ...list].slice(0, LIMITS.favorites);
  const meta = { ...favoritesMetaStore.get(), [t.id]: removing ? { at: now, del: true as const } : { at: now } };
  batch(() => {
    favoritesStore.set(next);
    favoritesMetaStore.set(pruneFavMeta(meta, next));
  });
}

export function addRecentSearch(q: string) {
  const text = q.trim();
  if (text.length < 2) return;
  recentStore.set([text, ...recentStore.get().filter((x) => x.toLowerCase() !== text.toLowerCase())].slice(0, LIMITS.recent));
}

/** Всё, что синхронизируется между устройствами (ADR-27). prefs и недавние запросы остаются локальными. */
export interface LocalData {
  progress: Record<string, ProgressEntry>;
  history: HistoryEntry[];
  favorites: TitleSummary[];
  favMeta: Record<string, FavMeta>;
}

export const readLocal = (): LocalData => ({
  progress: progressStore.get(),
  history: historyStore.get(),
  favorites: favoritesStore.get(),
  favMeta: favoritesMetaStore.get(),
});

/** Все четыре хранилища одним согласованным обновлением для `useSyncExternalStore`. */
export function writeLocal(d: LocalData): void {
  batch(() => {
    progressStore.set(d.progress);
    historyStore.set(d.history);
    favoritesStore.set(d.favorites);
    favoritesMetaStore.set(d.favMeta);
  });
}

export function subscribeLocal(cb: () => void): () => void {
  const off = [progressStore, historyStore, favoritesStore, favoritesMetaStore].map((s) => s.subscribe(cb));
  return () => off.forEach((f) => f());
}

/** Недоверенное значение (из облака) → `LocalData` с поэлементной проверкой, как при чтении `localStorage`; не объект — `null`. */
export function parseLocalData(v: unknown): LocalData | null {
  if (!isObj(v)) return null;
  return {
    progress: parseProgress(v.progress) ?? {},
    history: listOf(isHistory)(v.history) ?? [],
    favorites: listOf(isSummary)(v.favorites) ?? [],
    favMeta: parseMeta(v.favMeta) ?? {},
  };
}
