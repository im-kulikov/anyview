import { describe, expect, test, vi } from 'vitest';
import { fc } from '../../../test/fc';
import type { TitleSummary } from '../../contract';
import type { RawItem } from './parse';
import { episodesOf, htmlToText, parseTitle, sortPlaylist } from './parse';
import { classifyRelated, franchiseOf, normTitle, relatedQuery } from './related';
import { summariesOf, toTitle } from '.';

/** Фаззинг границы с чужим API: любые типы в любых полях. Сбой = настоящая дыра (ломает ленту или страницу у пользователя). */
vi.spyOn(console, 'error').mockImplementation(() => {});

const junk = fc.oneof(fc.constant(undefined), fc.constant(null), fc.jsonValue(), fc.string(), fc.integer(), fc.double(), fc.boolean());
const rawItem = fc.record(
  { id: fc.oneof(fc.integer(), fc.string()), title: fc.string(), description: junk, genre: junk, year: junk, type: junk, director: junk, urlImagePreview: junk, screenImage: junk, rating: junk, votes: junk },
  { requiredKeys: ['id', 'title'] },
) as fc.Arbitrary<RawItem>;

const FORMATS = ['tv', 'movie', 'ova', 'ona', 'special', 'short', 'unknown'];
const STATUSES = ['announced', 'ongoing', 'released', 'unknown'];

describe('карточка и страница из мусорного ответа', () => {
  test('summariesOf не бросает, а выданные карточки валидны (https, диапазоны, типы)', () =>
    fc.assert(fc.property(fc.array(rawItem, { maxLength: 6 }), (raws) => {
      for (const t of summariesOf(raws)) {
        expect(t.id).toMatch(/^av-/);
        expect(typeof t.name).toBe('string');
        expect(FORMATS).toContain(t.format);
        expect(STATUSES).toContain(t.status);
        if (t.year !== undefined) expect(Number.isFinite(t.year)).toBe(true);
        if (t.rating) expect(t.rating.value >= 0 && t.rating.value <= 10).toBe(true);
        if (t.poster) expect(t.poster.url.startsWith('https://')).toBe(true);
        if (t.latestEpisode) expect(Number.isFinite(t.latestEpisode.number)).toBe(true);
      }
    })));

  test('toTitle не бросает; картинки только https; описание — текст', () =>
    fc.assert(fc.property(rawItem, (raw) => {
      const t = toTitle(raw);
      expect(typeof t.description === 'string' || t.description === undefined).toBe(true);
      for (const img of [t.poster, t.backdrop]) if (img) expect(img.url.startsWith('https://')).toBe(true);
      expect(Array.isArray(t.genres)).toBe(true);
    })));
});

describe('разбор строк', () => {
  test('parseTitle: не бросает, счётчики конечные', () =>
    fc.assert(fc.property(fc.string(), (s) => {
      const p = parseTitle(s);
      expect(typeof p.name).toBe('string');
      if (p.episodes) for (const n of [p.episodes.released, p.episodes.total ?? 0]) expect(Number.isFinite(n)).toBe(true);
    })));

  test('htmlToText и normTitle не бросают; normTitle идемпотентна', () =>
    fc.assert(fc.property(fc.string(), (s) => {
      expect(typeof htmlToText(s)).toBe('string');
      const n = normTitle(s);
      expect(normTitle(n)).toBe(n);
    })));

  test('relatedQuery / franchiseOf не бросают на любом названии', () =>
    fc.assert(fc.property(fc.string(), fc.constantFrom(...FORMATS), (name, format) => {
      expect(typeof relatedQuery(name)).toBe('string');
      const f = franchiseOf({ name, format: format as TitleSummary['format'] });
      if (f) {
        expect(f.key.length).toBeGreaterThan(0);
        expect(Number.isFinite(f.season)).toBe(true);
      }
    })));
});

describe('плейлист', () => {
  const item = fc.record({ name: fc.string(), hd: junk, std: junk, preview: junk }, { requiredKeys: ['name'] });

  test('episodesOf: не бросает, id серий уникальны (это ключи React)', () =>
    fc.assert(fc.property(fc.array(item, { maxLength: 40 }), (list) => {
      const eps = episodesOf('1', 'av-1', sortPlaylist(list as never) as never);
      expect(new Set(eps.map((e) => e.id)).size).toBe(eps.length);
    })));
});

describe('связи тайтлов (сезоны и похожие)', () => {
  const word = fc.constantFrom('Наруто', 'Тест', 'Пощади', 'Ёжик', 'А', 'Mr. X', 'Ван Пис');
  const marker = fc.constantFrom('', '', ' (второй сезон)', ' (третий сезон)', ' (2 сезон)', ' (фильм первый)', ' (спэшл 1)', ': Финал', ' 2');
  const summary = (i: number): fc.Arbitrary<TitleSummary> =>
    fc.record({
      name: fc.tuple(word, marker).map(([w, m]) => w + m),
      format: fc.constantFrom('tv', 'ona', 'movie', 'ova'),
      year: fc.option(fc.integer({ min: 1960, max: 2030 }), { nil: undefined }),
    }).map((r) => ({ id: `av-${i}`, type: 'anime', status: 'released', ...r }) as TitleSummary);
  const list = fc.integer({ min: 1, max: 12 }).chain((n) => fc.tuple(...Array.from({ length: n }, (_, i) => summary(i + 1))));

  test('classifyRelated: сезоны упорядочены и без повторов, «похожие» без текущего и без пересечения с сезонами, ≤ 40', () =>
    fc.assert(fc.property(list, (items) => {
      const [current, ...rest] = items;
      const r = classifyRelated(current, rest);
      const nums = r.seasons.map((s) => s.number);
      expect(nums).toEqual([...nums].sort((a, b) => a - b));
      expect(new Set(r.seasons.map((s) => s.id)).size).toBe(r.seasons.length);
      expect(r.similar.some((s) => s.id === current.id)).toBe(false);
      const seasonIds = new Set(r.seasons.map((s) => s.id));
      expect(r.similar.some((s) => seasonIds.has(s.id))).toBe(false);
      expect(r.similar.length).toBeLessThanOrEqual(40);
      expect(r.seasons.filter((s) => s.current).length).toBeLessThanOrEqual(1);
    })));
});
