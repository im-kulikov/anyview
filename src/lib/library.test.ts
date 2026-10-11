import { expect, test } from 'vitest';
import type { TitleSummary } from '../api/contract';
import { newEpisodes } from './library';

const t = (id: string, ep?: number): TitleSummary => ({ id, name: id, type: 'anime', format: 'tv', status: 'ongoing', ...(ep && { latestEpisode: { number: ep, label: `${ep} серия` } }) });

test('новая серия: номер в ленте больше, чем в снимке', () => {
  const m = newEpisodes([t('a', 3), t('b', 5), t('c'), t('d', 2)], [t('a', 4), t('b', 5), t('c', 1), t('x', 9)]);
  expect([...m.keys()].sort()).toEqual(['a', 'c']);
  expect(m.get('a')?.latestEpisode?.number).toBe(4);
});

test('тайтла нет в ленте — новой серии нет', () => {
  expect(newEpisodes([t('a', 1)], []).size).toBe(0);
});
