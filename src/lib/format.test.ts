import { expect, test } from 'vitest';
import { cardMeta, episodesText, formatDay, formatTime, plural, titlesWord } from './format';

test('plural / titlesWord', () => {
  expect(titlesWord(1)).toBe('тайтл');
  expect(titlesWord(3603)).toBe('тайтла');
  expect(titlesWord(11)).toBe('тайтлов');
  expect(plural(22, ['серия', 'серии', 'серий'])).toBe('серии');
});

test('cardMeta / episodesText / formatTime', () => {
  expect(cardMeta({ format: 'tv', year: 2026 })).toBe('ТВ · 2026');
  expect(cardMeta({ format: 'unknown' })).toBe('');
  expect(episodesText({ released: 1, total: 12, totalIsEstimate: true })).toBe('1 из 12+');
  expect(episodesText({ released: 7 })).toBe('7');
  expect(formatTime(494)).toBe('08:14');
  expect(formatTime(3725)).toBe('1:02:05');
});

test('plural: склонения на границах', () => {
  const f: [string, string, string] = ['серия', 'серии', 'серий'];
  const word = (n: number) => plural(n, f);
  expect([0, 1, 2, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112, 121].map(word)).toEqual([
    'серий', 'серия', 'серии', 'серий', 'серий', 'серий', 'серий', 'серия', 'серии', 'серий', 'серия', 'серий', 'серий', 'серия',
  ]);
});

test('formatTime / formatDay / episodesText: мусор не бросает', () => {
  for (const x of [NaN, -1, Infinity, -Infinity]) expect(formatTime(x)).toBe('00:00');
  expect(formatTime(3599.9)).toBe('59:59');
  expect(formatTime(86400)).toBe('24:00:00');
  expect(() => formatDay('')).not.toThrow();
  expect(() => formatDay('не дата')).not.toThrow();
  expect(episodesText({ released: 0 })).toBeDefined();
  expect(episodesText(undefined)).toBeUndefined();
  expect(episodesText({ released: 5, total: 12 })).toBe('5 из 12');
});
