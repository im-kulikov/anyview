/** Образцы корректных данных `anyview:v1:*` и мутатор для фаззинга (unit и e2e используют одно и то же). */
export const summary = {
  id: 'av-1', type: 'anime', format: 'tv', name: 'Тест', status: 'ongoing', year: 2020,
  poster: { url: 'https://x/p.jpg' }, rating: { source: 'a', value: 7.5, votes: 3 },
  latestEpisode: { number: 3, label: '3 серия' }, episodes: { released: 3, total: 12 },
};

export const KEYS = ['history', 'favorites', 'favoritesMeta', 'statuses', 'progress', 'prefs', 'recentSearches', 'feed'] as const;

export const VALID: Record<(typeof KEYS)[number], unknown> = {
  history: [{ title: summary, episodeId: 'e1', episodeName: '1 серия', position: 10, duration: 100, updatedAt: 5 }, { title: { ...summary, id: 'av-2' }, episodeId: 'e2', episodeName: '2 серия', position: 20, duration: 100, updatedAt: 4 }],
  favorites: [summary, { ...summary, id: 'av-3', name: 'Тест (второй сезон)' }],
  favoritesMeta: { 'av-1': { at: 3 } },
  statuses: { 'av-1': { s: 'watching', at: 4, t: summary }, 'av-2': { s: null, at: 2 } },
  progress: { e1: { titleId: 'av-1', position: 10, duration: 100, updatedAt: 5 } },
  prefs: { quality: 'hd', autoNext: true, volume: 0.5, muted: false, speed: 1.5, cols: 2 },
  recentSearches: ['наруто'],
  feed: { savedAt: 1, items: [summary], total: 1, hasMore: true },
};

/** Заменяет значение по случайному пути внутри дерева (или удаляет его). */
export function mutate(root: unknown, pick: number[], repl: unknown, del: boolean): unknown {
  const copy = structuredClone(root) as Record<string, unknown>;
  let node: unknown = copy;
  for (const p of pick) {
    if (typeof node !== 'object' || node === null) break;
    const keys = Object.keys(node);
    if (!keys.length) break;
    const k = keys[p % keys.length];
    const child = (node as Record<string, unknown>)[k];
    if (typeof child !== 'object' || child === null || p % 3 === 0) {
      if (del) delete (node as Record<string, unknown>)[k];
      else (node as Record<string, unknown>)[k] = repl;
      return copy;
    }
    node = child;
  }
  return copy;
}

/** Значения, на которых чаще всего ломаются разыменования: пустые, неверного типа, граничные, прототипные. */
export const EVIL: unknown[] = [null, '', 'x', 0, -1, 1e308, [], {}, { toString: 0 }, '__proto__', 'constructor', [null], { value: 'x' }, { url: 5 }, true];

/** Пути ко всем листьям дерева (примитивам и пустым контейнерам) — чтобы мутация целилась в конкретное поле, а не в случайное место. */
export function leafPaths(root: unknown, prefix: (string | number)[] = []): (string | number)[][] {
  if (typeof root !== 'object' || root === null || Object.keys(root).length === 0) return [prefix];
  return Object.entries(root).flatMap(([k, v]) => leafPaths(v, [...prefix, Array.isArray(root) ? Number(k) : k]));
}

/** Подменяет (или удаляет) лист с номером `idx` (по модулю числа листьев). */
export function mutateLeaf(root: unknown, idx: number, repl: unknown, del: boolean): unknown {
  const copy = structuredClone(root);
  const paths = leafPaths(copy).filter((p) => p.length > 0);
  if (!paths.length) return copy;
  const path = paths[idx % paths.length];
  let node = copy as Record<string | number, unknown>;
  for (const k of path.slice(0, -1)) node = node[k] as Record<string | number, unknown>;
  const last = path[path.length - 1];
  if (del) {
    if (Array.isArray(node)) node.splice(Number(last), 1);
    else delete node[last];
  } else node[last] = repl;
  return copy;
}
