import { isWatched, LIMITS, pruneFavMeta, type FavMeta, type HistoryEntry, type LocalData, type ProgressEntry } from '../lib/storage';
import type { TitleSummary } from '../api/contract';

/**
 * Слияние состояний двух устройств (ADR-27). Всё здесь — чистые функции: результат зависит только от входа,
 * не зависит от порядка аргументов (коммутативность) и не меняется при повторном слиянии (идемпотентность).
 * Равные метки времени разрешаются сравнением канонического JSON, а не порядком аргументов.
 */

export const EMPTY: LocalData = { progress: {}, history: [], favorites: [], favMeta: {} };

/** Правила Firestore требуют `data.size() < 200000`; берём запас и считаем в байтах UTF-8. */
export const CLOUD_MAX_BYTES = 190_000;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** JSON с отсортированными ключами: одинаковые данные дают одинаковую строку на любом устройстве. */
export const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, val) => (isPlain(val) ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => cmp(a, b))) : val));

/** Запись с большим `updatedAt`; при равенстве — большая по каноническому JSON (детерминированно). */
function newer<T extends { updatedAt: number }>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return canonical(a) >= canonical(b) ? a : b;
}

function mergeProgress(a: LocalData['progress'], b: LocalData['progress']): LocalData['progress'] {
  const all = new Map<string, ProgressEntry>();
  for (const src of [a, b]) for (const [id, e] of Object.entries(src)) all.set(id, all.has(id) ? newer(all.get(id)!, e) : e);
  const ids = [...all.keys()].sort((x, y) => all.get(y)!.updatedAt - all.get(x)!.updatedAt || cmp(x, y)).slice(0, LIMITS.progress);
  return Object.fromEntries(ids.sort(cmp).map((id) => [id, all.get(id)!]));
}

/**
 * Одна запись на тайтл — самая свежая. Затем сверка с прогрессом: запись, которая старше досмотренной (≥ 90 %) позже серии того же тайтла,
 * устарела — следующую серию или удаление уже решило то устройство, где досмотрели (при следующей серии там есть более свежая запись).
 * Без этого удалённая запись воскресала бы из старой копии, а слияние зависело бы от порядка.
 */
function mergeHistory(a: HistoryEntry[], b: HistoryEntry[], progress: LocalData['progress']): HistoryEntry[] {
  const byTitle = new Map<string, HistoryEntry>();
  for (const e of [...a, ...b]) byTitle.set(e.title.id, byTitle.has(e.title.id) ? newer(byTitle.get(e.title.id)!, e) : e);
  const watchedAt = new Map<string, number>();
  for (const p of Object.values(progress)) if (isWatched(p)) watchedAt.set(p.titleId, Math.max(watchedAt.get(p.titleId) ?? 0, p.updatedAt));
  return [...byTitle.values()]
    .filter((e) => (watchedAt.get(e.title.id) ?? 0) <= e.updatedAt)
    .sort((x, y) => y.updatedAt - x.updatedAt || cmp(x.title.id, y.title.id))
    .slice(0, LIMITS.history);
}

interface FavState { at: number; del: boolean; title?: TitleSummary }

function favStates(d: LocalData): Map<string, FavState> {
  const m = new Map<string, FavState>();
  for (const [id, meta] of Object.entries(d.favMeta)) m.set(id, { at: meta.at, del: !!meta.del });
  for (const t of d.favorites) {
    const cur = m.get(t.id);
    if (cur) cur.title = t;
    else m.set(t.id, { at: 0, del: false, title: t });
  }
  return m;
}

/** Побеждает более позднее действие; при равенстве удаление сильнее добавления (удалённое не воскресает). */
function pickFav(a: FavState, b: FavState): FavState {
  const win = a.at !== b.at ? (a.at > b.at ? a : b) : a.del !== b.del ? (a.del ? a : b) : undefined;
  if (win) return { at: win.at, del: win.del, title: win.title ?? (win === a ? b : a).title };
  const titles = [a.title, b.title].filter((t): t is TitleSummary => !!t).sort((x, y) => cmp(canonical(y), canonical(x)));
  return { at: a.at, del: a.del, title: titles[0] };
}

function mergeFavorites(a: LocalData, b: LocalData): Pick<LocalData, 'favorites' | 'favMeta'> {
  const sa = favStates(a);
  const merged = new Map<string, FavState>();
  for (const [id, s] of favStates(b)) merged.set(id, sa.has(id) ? pickFav(sa.get(id)!, s) : s);
  for (const [id, s] of sa) if (!merged.has(id)) merged.set(id, s);

  const alive = [...merged]
    .filter(([, s]) => !s.del && s.title)
    .sort(([ia, x], [ib, y]) => y.at - x.at || cmp(ia, ib))
    .slice(0, LIMITS.favorites);
  const favorites = alive.map(([, s]) => s.title!);
  const meta: Record<string, FavMeta> = {};
  for (const [id, s] of merged) meta[id] = s.del ? { at: s.at, del: true } : { at: s.at };
  return { favorites, favMeta: pruneFavMeta(meta, favorites) };
}

export function mergeData(a: LocalData, b: LocalData): LocalData {
  const progress = mergeProgress(a.progress, b.progress);
  return { progress, history: mergeHistory(a.history, b.history, progress), ...mergeFavorites(a, b) };
}

/** Приведение одного состояния к инвариантам (лимиты, одна запись на тайтл, правила досмотра). */
export const normalize = (d: LocalData): LocalData => mergeData(d, EMPTY);

export const serialize = (d: LocalData): string => canonical({ v: 1, ...d });
export const sameData = (a: LocalData, b: LocalData): boolean => canonical(a) === canonical(b);
const bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * Обрезка для облака: пока строка длиннее лимита, выбрасывается десятая часть самых старых записей прогресса и истории,
 * когда их не осталось — «надгробий», затем избранного. Локальные данные не трогаются: режется только то, что уходит в облако.
 */
export function fitForCloud(d: LocalData, max = CLOUD_MAX_BYTES): LocalData {
  let cur = d;
  while (bytes(serialize(cur)) > max) {
    const items: { t: number; k: string }[] = [];
    const watching = Object.keys(cur.progress).length + cur.history.length > 0;
    if (watching) {
      for (const [id, e] of Object.entries(cur.progress)) items.push({ t: e.updatedAt, k: 'p:' + id });
      for (const e of cur.history) items.push({ t: e.updatedAt, k: 'h:' + e.title.id });
    } else {
      for (const [id, m] of Object.entries(cur.favMeta)) if (m.del) items.push({ t: m.at, k: 'm:' + id });
      if (!items.length) for (const t of cur.favorites) items.push({ t: cur.favMeta[t.id]?.at ?? 0, k: 'f:' + t.id });
    }
    if (!items.length) return cur; // резать нечего
    items.sort((x, y) => x.t - y.t || cmp(x.k, y.k));
    const gone = new Set(items.slice(0, Math.ceil(items.length / 10)).map((i) => i.k));
    cur = {
      progress: Object.fromEntries(Object.entries(cur.progress).filter(([id]) => !gone.has('p:' + id))),
      history: cur.history.filter((e) => !gone.has('h:' + e.title.id)),
      favorites: cur.favorites.filter((t) => !gone.has('f:' + t.id)),
      favMeta: Object.fromEntries(Object.entries(cur.favMeta).filter(([id]) => !gone.has('m:' + id) && !gone.has('f:' + id))),
    };
  }
  return cur;
}
