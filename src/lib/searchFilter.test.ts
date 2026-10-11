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

test('applyFilter: пустой вход, без значений порядок API, рейтинг 0 выше «нет рейтинга», вход не мутируется', () => {
  expect(applyFilter([], 'tv', 'year')).toEqual([]);
  const none = [t('x', 'tv'), t('y', 'tv'), t('z', 'tv')];
  expect(applyFilter(none, null, 'year').map((i) => i.id)).toEqual(['x', 'y', 'z']);
  const zero = [{ ...t('a', 'tv'), rating: { source: 's', value: 0 } }, t('b', 'tv')];
  expect(applyFilter(zero, null, 'rating').map((i) => i.id)).toEqual(['a', 'b']);
  const before = items.map((i) => i.id).join();
  applyFilter(items, null, 'rating');
  expect(items.map((i) => i.id).join()).toBe(before);
  expect(applyFilter(items, null, 'rating')).toHaveLength(items.length);
});

test('formatsOf: порядок чипов не зависит от порядка выдачи', () => {
  const a = formatsOf([t('1', 'ova'), t('2', 'tv'), t('3', 'movie')]).map((f) => f.format);
  const b = formatsOf([t('3', 'movie'), t('2', 'tv'), t('1', 'ova')]).map((f) => f.format);
  expect(a).toEqual(['tv', 'movie', 'ova']);
  expect(b).toEqual(a);
  expect(formatsOf([])).toEqual([]);
});
