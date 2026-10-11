import { describe, expect, test } from 'vitest';
import { fc } from '../test/fc';
import type { TitleFormat, TitleSummary } from '../api/contract';
import { cardMeta, episodesText, formatDay, formatTime, plural } from './format';
import { groupSeasons, newEpisodes } from './library';
import { applyFilter, formatsOf, SORTS } from './searchFilter';
import { filterEpisodes, nextSpeed } from '../features/player/playerModel';

/** Фаззинг чистой логики экранов: инварианты на произвольных списках. */
const FORMATS: TitleFormat[] = ['tv', 'movie', 'ova', 'ona', 'special', 'short', 'unknown'];
const title = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }),
  name: fc.string({ maxLength: 20 }),
  format: fc.constantFrom(...FORMATS),
  year: fc.option(fc.integer({ min: 1900, max: 2100 }), { nil: undefined }),
  rating: fc.option(fc.record({ source: fc.constant('x'), value: fc.double({ min: 0, max: 10, noNaN: true }) }), { nil: undefined }),
  latestEpisode: fc.option(fc.record({ number: fc.integer({ min: 0, max: 400 }), label: fc.constant('x') }), { nil: undefined }),
}).map((r) => ({ type: 'anime', status: 'ongoing', ...r }) as TitleSummary);
const unique = (items: TitleSummary[]) => [...new Map(items.map((t) => [t.id, t])).values()];
const list = fc.array(title, { maxLength: 25 }).map(unique);

describe('фильтр и сортировка поиска', () => {
  test('не теряет и не выдумывает элементы, не мутирует вход, порядок соответствует сортировке', () =>
    fc.assert(fc.property(list, fc.option(fc.constantFrom(...FORMATS), { nil: null }), fc.constantFrom(...SORTS), (items, format, sort) => {
      const before = items.map((t) => t.id).join();
      const out = applyFilter(items, format, sort);
      expect(items.map((t) => t.id).join()).toBe(before);
      expect(out.length).toBe(format ? items.filter((t) => t.format === format).length : items.length);
      expect(new Set(out.map((t) => t.id)).size).toBe(out.length);
      if (sort !== 'relevance') {
        const key = (t: TitleSummary) => (sort === 'year' ? t.year : t.rating?.value) ?? -Infinity;
        for (let i = 1; i < out.length; i++) expect(key(out[i - 1])).toBeGreaterThanOrEqual(key(out[i]));
      }
    })));

  test('formatsOf: счётчики сходятся с входом', () =>
    fc.assert(fc.property(list, (items) => {
      const f = formatsOf(items);
      expect(f.reduce((n, x) => n + x.count, 0)).toBe(items.length);
    })));
});

describe('сезоны в избранном', () => {
  // «франшиза» из имени: часть до «:» и номер после; пустое имя — вне франшиз
  const franchise = (t: TitleSummary) => (t.name.includes(':') ? { key: t.name.split(':')[0], season: Number(t.name.split(':')[1]) || 1 } : undefined);

  test('groupSeasons: счёт сходится, показаны только элементы входа, без повторов, вход не мутируется', () =>
    fc.assert(fc.property(list, (items) => {
      const before = items.map((t) => t.id).join();
      const g = groupSeasons(items, franchise);
      expect(items.map((t) => t.id).join()).toBe(before);
      expect(g.reduce((n, x) => n + x.seasons, 0)).toBe(items.length); // каждый элемент входа учтён ровно в одной карточке
      const ids = new Set(items.map((t) => t.id));
      expect(g.every((x) => ids.has(x.title.id) && x.seasons >= 1)).toBe(true);
      expect(new Set(g.map((x) => x.title.id)).size).toBe(g.length);
    })));
});

describe('новые серии', () => {
  test('newEpisodes: результат — подмножество tracked∩feed, номер в ленте строго больше', () =>
    fc.assert(fc.property(list, list, (tracked, feed) => {
      const m = newEpisodes(tracked, feed);
      for (const [id, fresh] of m) {
        const t = tracked.find((x) => x.id === id)!;
        expect((fresh.latestEpisode?.number ?? 0)).toBeGreaterThan(t.latestEpisode?.number ?? 0);
      }
    })));
});

describe('форматирование', () => {
  test('formatTime: любое число даёт ММ:СС или Ч:ММ:СС', () =>
    fc.assert(fc.property(fc.oneof(fc.double({ min: -1e6, max: 1e9 }), fc.constantFrom(NaN, Infinity, -Infinity)), (x) => {
      expect(formatTime(x)).toMatch(/^(\d+:)?\d{2}:\d{2}$/);
    })));
  test('plural: всегда одна из трёх форм', () =>
    fc.assert(fc.property(fc.integer({ min: -1_000_000, max: 1_000_000 }), (n) => {
      expect(['a', 'b', 'c']).toContain(plural(n, ['a', 'b', 'c']));
    })));
  test('formatDay / episodesText / cardMeta не бросают на мусоре', () =>
    fc.assert(fc.property(fc.string(), fc.integer(), fc.integer(), fc.constantFrom(...FORMATS), (s, a, b, f) => {
      expect(typeof formatDay(s)).toBe('string');
      expect(() => episodesText({ released: a, total: b })).not.toThrow();
      expect(typeof cardMeta({ format: f, year: a })).toBe('string');
    })));
});

describe('плеер', () => {
  test('filterEpisodes: подмножество входа; пустой запрос — весь список', () =>
    fc.assert(fc.property(fc.array(fc.record({ number: fc.option(fc.integer({ min: 0, max: 999 }), { nil: undefined }), name: fc.string({ maxLength: 12 }) }), { maxLength: 30 }), fc.string({ maxLength: 4 }), (eps, q) => {
      const out = filterEpisodes(eps, q);
      expect(out.every((e) => eps.includes(e))).toBe(true);
      expect(filterEpisodes(eps, '  ')).toBe(eps);
    })));
  test('nextSpeed: результат всегда из списка', () =>
    fc.assert(fc.property(fc.double(), (cur) => {
      expect([0.75, 1, 1.25, 1.5, 2]).toContain(nextSpeed(cur, [0.75, 1, 1.25, 1.5, 2]));
    })));
});
