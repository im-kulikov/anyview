import { describe, expect, test } from 'vitest';
import type { Episode } from '../../api/contract';
import { pickEpisode, nextEpisode, prevEpisode } from './pickEpisode';

const ep = (n: number, available = true): Episode => ({ id: `e${n}`, titleId: 't', season: 1, number: n, name: `${n} серия`, available });
const eps = [ep(1), ep(2), ep(3), ep(4, false)];
const pr = (position: number, updatedAt: number) => ({ titleId: 't', position, duration: 100, updatedAt });

describe('pickEpisode', () => {
  test('?episode= из URL', () => expect(pickEpisode(eps, 'e2', {})?.id).toBe('e2'));
  test('серия из URL недоступна — игнорируем', () => expect(pickEpisode(eps, 'e4', {})?.id).toBe('e1'));
  test('начатая и не досмотренная, самая свежая', () =>
    expect(pickEpisode(eps, null, { e1: pr(30, 1), e3: pr(10, 5), e2: pr(95, 9) })?.id).toBe('e3'));
  test('после последней просмотренной', () => expect(pickEpisode(eps, null, { e1: pr(95, 1), e2: pr(99, 2) })?.id).toBe('e3'));
  test('всё просмотрено — первая доступная', () =>
    expect(pickEpisode(eps, null, { e1: pr(95, 1), e2: pr(95, 2), e3: pr(95, 3) })?.id).toBe('e1'));
  test('без истории — первая доступная', () => expect(pickEpisode(eps, null, {})?.id).toBe('e1'));
  test('next/prev пропускают недоступные', () => {
    expect(nextEpisode(eps, 'e3')).toBeUndefined();
    expect(nextEpisode(eps, 'e1')?.id).toBe('e2');
    expect(prevEpisode(eps, 'e1')).toBeUndefined();
    expect(prevEpisode(eps, 'e3')?.id).toBe('e2');
  });
  test('нет доступных серий (анонс с синтетической серией) — undefined, без исключений', () => {
    const announce = [ep(1, false)];
    expect(pickEpisode(announce, null, {})).toBeUndefined();
    expect(pickEpisode(announce, 'e1', { e1: pr(10, 1) })).toBeUndefined();
    expect(pickEpisode([], null, {})).toBeUndefined();
  });
  test('nextEpisode с неизвестным id — undefined', () => expect(nextEpisode(eps, 'zzz')).toBeUndefined());
  test('позиция не выше порога RESUME_MIN — серия не «начата»', () => expect(pickEpisode(eps, null, { e2: pr(3, 5) })?.id).toBe('e1'));
  test('«последняя просмотренная» — по порядку в списке, а не по времени (CODE-22)', () =>
    expect(pickEpisode(eps, null, { e1: pr(95, 99), e2: pr(95, 1) })?.id).toBe('e3'));
});
