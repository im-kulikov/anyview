import type { TitleFormat, TitleSummary } from '../api/contract';

export type SortKey = 'relevance' | 'year' | 'rating';
export const SORTS: SortKey[] = ['relevance', 'year', 'rating'];

const FORMAT_ORDER: TitleFormat[] = ['tv', 'movie', 'ova', 'ona', 'special', 'short', 'unknown'];

/** Типы, которые есть в выдаче, в порядке чипов, с числом тайтлов. Выдача поиска ≤ 50 и вся в памяти, поэтому фильтр честный. */
export function formatsOf(items: TitleSummary[]): { format: TitleFormat; count: number }[] {
  const n = new Map<TitleFormat, number>();
  for (const t of items) n.set(t.format, (n.get(t.format) ?? 0) + 1);
  return FORMAT_ORDER.filter((f) => n.has(f)).map((format) => ({ format, count: n.get(format)! }));
}

/** Фильтр по типу и сортировка; «relevance» сохраняет порядок API. Без значения (год, рейтинг) — в конец, порядок равных сохраняется. */
export function applyFilter(items: TitleSummary[], format: TitleFormat | null, sort: SortKey): TitleSummary[] {
  const list = format ? items.filter((t) => t.format === format) : items;
  if (sort === 'relevance') return list;
  const key = (t: TitleSummary) => (sort === 'year' ? t.year : t.rating?.value) ?? -Infinity;
  return list.map((t, i) => ({ t, i })).sort((a, b) => key(b.t) - key(a.t) || a.i - b.i).map((x) => x.t);
}
