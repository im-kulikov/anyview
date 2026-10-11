import { expect, test } from 'vitest';
import type { TitleSummary } from '../api/contract';
import { applyFilter, formatsOf } from './searchFilter';

const t = (id: string, format: TitleSummary['format'], year?: number, rating?: number): TitleSummary =>
  ({ id, name: id, type: 'anime', format, status: 'released', ...(year && { year }), ...(rating && { rating: { source: 'x', value: rating } }) });
const items = [t('a', 'tv', 2010, 7), t('b', 'movie', 2015), t('c', 'tv', 2020, 9), t('d', 'ova', undefined, 8), t('e', 'tv', 2020, 5)];

test('formatsOf: только присутствующие типы, в порядке чипов, со счётчиком', () => {
  expect(formatsOf(items)).toEqual([{ format: 'tv', count: 3 }, { format: 'movie', count: 1 }, { format: 'ova', count: 1 }]);
});

test('фильтр по типу и сортировка; без значения — в конец, равные сохраняют порядок', () => {
  expect(applyFilter(items, 'tv', 'relevance').map((x) => x.id)).toEqual(['a', 'c', 'e']);
  expect(applyFilter(items, null, 'year').map((x) => x.id)).toEqual(['c', 'e', 'b', 'a', 'd']);
  expect(applyFilter(items, null, 'rating').map((x) => x.id)).toEqual(['c', 'd', 'a', 'e', 'b']);
  expect(applyFilter(items, null, 'relevance')).toBe(items);
});
