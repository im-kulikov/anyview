import { expect, test } from 'vitest';
import { cardMeta, episodesText, formatTime, plural, titlesWord } from './format';

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
