import { describe, expect, test } from 'vitest';
import type { TitleSummary } from '../api/contract';
import { groupSeasons, newEpisodes } from './library';

const t = (id: string, ep?: number): TitleSummary => ({ id, name: id, type: 'anime', format: 'tv', status: 'ongoing', ...(ep && { latestEpisode: { number: ep, label: `${ep} серия` } }) });

test('новая серия: номер в ленте больше, чем в снимке', () => {
  const m = newEpisodes([t('a', 3), t('b', 5), t('c'), t('d', 2)], [t('a', 4), t('b', 5), t('c', 1), t('x', 9)]);
  expect([...m.keys()].sort()).toEqual(['a', 'c']);
  expect(m.get('a')?.latestEpisode?.number).toBe(4);
});

test('тайтла нет в ленте — новой серии нет', () => {
  expect(newEpisodes([t('a', 1)], []).size).toBe(0);
});

test('граничные случаи', () => {
  expect(newEpisodes([], [t('a', 5)]).size).toBe(0);
  expect(newEpisodes([t('a', 3)], [t('a', 3)]).size).toBe(0); // не больше снимка
  expect(newEpisodes([t('a', 3)], [t('a')]).size).toBe(0); // в ленте нет номера серии
  expect(newEpisodes([t('a'), t('a')], [t('a', 2)]).size).toBe(1); // дубли в tracked — один ключ
  expect(newEpisodes([t('a', 1)], [t('a', 4)]).get('a')?.latestEpisode?.number).toBe(4);
});

describe('groupSeasons: сезоны одной франшизы — одна карточка', () => {
  // франшиза — часть id до «:», сезон — после; `x` без двоеточия — тайтл сам по себе
  const f = (t: TitleSummary) => (t.id.includes(':') ? { key: t.id.split(':')[0], season: Number(t.id.split(':')[1]) } : undefined);
  const ids = (g: ReturnType<typeof groupSeasons>) => g.map((x) => `${x.title.id}×${x.seasons}`);

  test('три сезона и фильм: показан последний сезон и фильм, порядок по самому свежему члену группы', () => {
    const list = [t('film'), t('a:1'), t('b:1'), t('a:3'), t('a:2')];
    expect(ids(groupSeasons(list, f))).toEqual(['film×1', 'a:3×3', 'b:1×1']);
  });
  test('в списке только часть сезонов — показан последний из имеющихся', () => {
    expect(ids(groupSeasons([t('a:1'), t('a:2')], f))).toEqual(['a:2×2']);
  });
  test('дубль номера сезона (ремейк с той же базой) — ничего не склеиваем', () => {
    expect(ids(groupSeasons([t('a:1'), t('a:2'), t('a:2')], f))).toEqual(['a:1×1', 'a:2×1', 'a:2×1']);
  });
  test('один сезон, пустой список, нет франшизы — без изменений', () => {
    expect(groupSeasons([], f)).toEqual([]);
    expect(ids(groupSeasons([t('a:1')], f))).toEqual(['a:1×1']);
    expect(ids(groupSeasons([t('x'), t('y')], f))).toEqual(['x×1', 'y×1']);
  });
  test('входной список не мутируется', () => {
    const list = [t('a:2'), t('a:1')];
    const copy = list.map((x) => x.id);
    groupSeasons(list, f);
    expect(list.map((x) => x.id)).toEqual(copy);
  });
});
