import { describe, expect, test } from 'vitest';
import {
  backdropOf, formatOf, htmlToText, parseTitle, ratingOf, resolveAirDate, sortPlaylist, statusOf,
} from './parse';
import { toSummary } from './index';
import { https } from '../../../lib/https';

const NOW = new Date(2026, 9, 9);

describe('parseTitle', () => {
  test('онгоинг со следующей серией', () => {
    const p = parseTitle(
      'Волшебник ледяного клинка правит миром (второй сезон) / Hyouken no Majutsushi ga Sekai wo Suberu II [1 из 12+] [2 серия - 15 октября]',
      NOW,
    );
    expect(p.name).toBe('Волшебник ледяного клинка правит миром (второй сезон)');
    expect(p.originalName).toBe('Hyouken no Majutsushi ga Sekai wo Suberu II');
    expect(p.episodes).toEqual({ released: 1, total: 12, totalIsEstimate: true });
    expect(p.nextEpisode).toEqual({ number: 2, airDate: '2026-10-15' });
    expect(statusOf(p.episodes)).toBe('ongoing');
  });

  test('Наруто — released, без latestEpisode', () => {
    const p = parseTitle('Наруто / Naruto [1-220 из 220]');
    expect(p.episodes).toEqual({ released: 220, total: 220 });
    expect(statusOf(p.episodes)).toBe('released');
    const s = toSummary({ id: 7, title: 'Наруто / Naruto [1-220 из 220]', type: 'ТВ' });
    expect(s.latestEpisode).toBeUndefined();
    expect(s.id).toBe('av-7');
  });

  test('OVA в названии', () => {
    const p = parseTitle('Наруто OVA-1 / Naruto OVA-1 [1 из 1]');
    expect(p.name).toBe('Наруто OVA-1');
    expect(p.originalName).toBe('Naruto OVA-1');
    expect(p.episodes).toEqual({ released: 1, total: 1 });
  });

  test.each([
    ['[ОВА 1-2 из 2]', { released: 2, total: 2 }],
    ['[OVA 1 из 1]', { released: 1, total: 1 }],
    ['[Спешл 1-3 из 3]', { released: 3, total: 3 }],
    ['[1 из 1] [OVA 1 из 1]', { released: 1, total: 1 }],
    ['[0-11 из 11]', { released: 11, total: 11 }],
  ])('счётчик %s', (br, expected) => {
    expect(parseTitle(`А / B ${br}`).episodes).toEqual(expected);
  });

  test('следующая серия «в году» — без airDate', () => {
    expect(parseTitle('А / B [1 из 12+] [13 серия - в 2027 году]', NOW).nextEpisode).toEqual({ number: 13 });
  });

  test('Fate/Zero не режется', () => {
    const p = parseTitle('Судьба / Fate/Zero [1-25 из 25]');
    expect(p.originalName).toBe('Fate/Zero');
  });

  test('без [..] и без « / »', () => {
    const p = parseTitle('Просто название');
    expect(p).toEqual({ name: 'Просто название', originalName: undefined, episodes: undefined, nextEpisode: undefined });
    expect(statusOf(p.episodes)).toBe('unknown');
  });

  test('дата на стыке года', () => {
    expect(parseTitle('А / B [1 из 2+] [5 серия - 5 января]', new Date(2026, 11, 20)).nextEpisode?.airDate).toBe('2027-01-05');
    expect(parseTitle('А / B [1 из 2+] [5 серия - 30 декабря]', new Date(2027, 0, 3)).nextEpisode?.airDate).toBe('2026-12-30');
  });
});

describe('поля', () => {
  test('формат без учёта регистра', () => {
    expect(formatOf('Полнометражный фильм')).toBe('movie');
    expect(formatOf('короткометражный фильм')).toBe('short');
    expect(formatOf('ТВ')).toBe('tv');
    expect(formatOf('ТВ-спэшл')).toBe('special');
    expect(formatOf('ОВА')).toBe('ova');
    expect(formatOf('что-то')).toBe('unknown');
  });

  test('latestEpisode не у фильма', () => {
    const s = toSummary({ id: 1, title: 'Ф / F [1 из 12+]', type: 'Полнометражный фильм' });
    expect(s.latestEpisode).toBeUndefined();
    expect(toSummary({ id: 2, title: 'Ф / F [3 из 12+]', type: 'ТВ' }).latestEpisode).toEqual({ number: 3, label: '3 серия' });
  });

  test('рейтинг', () => {
    expect(ratingOf(137, 43)?.value).toBe(6.4);
    expect(ratingOf(0, 0)).toBeUndefined();
    expect(ratingOf(16, 4)).toBeUndefined();
    expect(ratingOf(20, 5)?.value).toBe(8);
  });

  test('сортировка серий', () => {
    const names = ['10 серия', 'Спешл', '2 серия', '1 серия', 'OVA'];
    expect(sortPlaylist(names.map((name) => ({ name }))).map((x) => x.name)).toEqual([
      '1 серия', '2 серия', '10 серия', 'Спешл', 'OVA',
    ]);
  });

  test('https()', () => {
    expect(https('http://media.animetop.info/img/1.jpg')).toBe('https://media.animetop.info/img/1.jpg');
  });

  test('htmlToText', () => {
    expect(htmlToText('Один<br>\n<br>\nДва &laquo;три&raquo; &amp; &#39;x&#39;<br />Z&nbsp;<b>y</b>&mdash;')).toBe(
      'Один\n\nДва «три» & \'x\'\nZ y—',
    );
    expect(htmlToText('a<br>\n<br>\n<br>\n<br>\nb')).toBe('a\n\nb');
  });

  test('относительный screenImage → абсолютный https', () => {
    expect(
      backdropOf({
        id: 1, title: '', urlImagePreview: 'http://static.openni.ru/uploads/posts/a.jpg',
        screenImage: ['', '/uploads/posts/2022-01/b.jpg'],
      })?.url,
    ).toBe('https://static.openni.ru/uploads/posts/2022-01/b.jpg');
    expect(backdropOf({ id: 1, title: '', urlImagePreview: 'https://x.ru/a.jpg', screenImage: ['', ''] })).toBeUndefined();
  });

  test('htmlToText: числовые сущности вне диапазона не бросают (CODE-11)', () => {
    expect(htmlToText('a &#99999999; b &#x110000; c &#0; d &#xD800;')).toBe('a &#99999999; b &#x110000; c &#0; d &#xD800;');
    expect(htmlToText('&#1089;&#x44F;')).toBe('ся');
  });

  test('htmlToText: «<» вне тегов сохраняется, блоки разделяются переносом (CODE-11)', () => {
    expect(htmlToText('Рейтинг <5 и >3')).toBe('Рейтинг <5 и >3');
    expect(htmlToText('<p>a</p><p>b</p>')).toBe('a\nb');
    expect(htmlToText('x <b>y</b> <a href="u">z</a>')).toBe('x y z');
  });

  test('рейтинг: шкала 0–10, нулевой не показываем (CODE-33)', () => {
    expect(ratingOf(100, 10)?.value).toBe(10);
    expect(ratingOf(0, 10)).toBeUndefined();
  });

  test('resolveAirDate: несуществующая дата → undefined (CODE-18)', () => {
    expect(resolveAirDate(31, 2, NOW)).toBeUndefined();
    expect(resolveAirDate(0, 1, NOW)).toBeUndefined();
    expect(resolveAirDate(15, 10, NOW)).toBe('2026-10-15');
  });
});
