import { describe, expect, test } from 'vitest';
import { bufferedEnd, createRequestGate, endedAction, engineFor, errorAction, filterEpisodes, isResumable, nextSpeed, percent, resumeFrom, RESUME_MIN, stepVolume } from './playerModel';

const p = (position: number, duration = 100) => ({ position, duration });

describe('позиция старта', () => {
  test('порог: до RESUME_MIN включительно — с нуля', () => {
    expect(resumeFrom(p(RESUME_MIN))).toBe(0);
    expect(resumeFrom(p(RESUME_MIN + 1))).toBe(RESUME_MIN + 1);
  });
  test('нет записи и досмотренная (≥ 90 %) — с нуля', () => {
    expect(resumeFrom(undefined)).toBe(0);
    expect(resumeFrom(p(90))).toBe(0);
    expect(isResumable(p(89))).toBe(true);
  });
});

describe('отображаемые значения', () => {
  test('percent', () => {
    expect(percent(50, 200)).toBe(25);
    expect(percent(5, 0)).toBe(0);
    expect(percent(300, 200)).toBe(100);
  });
  test('bufferedEnd — конец последнего диапазона', () => {
    expect(bufferedEnd({ length: 0, end: () => 0 })).toBe(0);
    expect(bufferedEnd({ length: 2, end: (i) => [10, 42][i] })).toBe(42);
  });
  test('stepVolume без накопления погрешности и в границах', () => {
    expect(stepVolume(0.7, 0.1)).toBe(0.8);
    expect(stepVolume(0.95, 0.1)).toBe(1);
    expect(stepVolume(0.05, -0.1)).toBe(0);
  });
});

describe('решения по событиям', () => {
  test('ended на последней серии и при выключенном автопереходе — ничего', () => {
    expect(endedAction({ hasNext: false, autoNext: true, nativeFullscreen: false })).toBe('none');
    expect(endedAction({ hasNext: true, autoNext: false, nativeFullscreen: false })).toBe('none');
  });
  test('ended: отсчёт, а в нативном полном экране iPhone — сразу дальше', () => {
    expect(endedAction({ hasNext: true, autoNext: true, nativeFullscreen: false })).toBe('countdown');
    expect(endedAction({ hasNext: true, autoNext: true, nativeFullscreen: true })).toBe('next');
  });
  test('ошибка: альтернативное качество один раз, затем экран ошибки', () => {
    expect(errorAction({ hasEpisode: true, hasAlt: true, triedAlt: false })).toBe('alt');
    expect(errorAction({ hasEpisode: true, hasAlt: true, triedAlt: true })).toBe('fail');
    expect(errorAction({ hasEpisode: true, hasAlt: false, triedAlt: false })).toBe('fail');
    expect(errorAction({ hasEpisode: false, hasAlt: true, triedAlt: false })).toBe('fail');
  });
});

describe('createRequestGate', () => {
  test('быстрые клики по сериям: актуален только последний запрос', () => {
    const g = createRequestGate();
    const a = g.next();
    const b = g.next();
    const c = g.next();
    expect([g.isCurrent(a), g.isCurrent(b), g.isCurrent(c)]).toEqual([false, false, true]);
  });
  test('invalidate отменяет ожидающие', () => {
    const g = createRequestGate();
    const a = g.next();
    g.invalidate();
    expect(g.isCurrent(a)).toBe(false);
  });
});

test('engineFor: пока только прямые файлы', () => {
  expect(engineFor({ kind: 'file' })).toBe('native');
  expect(engineFor({ kind: 'hls' })).toBe('unsupported');
  expect(engineFor(undefined)).toBe('unsupported');
});

describe('скорость и поиск серии', () => {
  const ep = (number: number | undefined, name: string) => ({ number, name });
  const list = [ep(1, '1 серия'), ep(10, '10 серия'), ep(11, '11 серия'), ep(2, '2 серия'), ep(undefined, 'OVA Спецвыпуск')];

  test('nextSpeed идёт по кругу, неизвестная скорость → 1', () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    expect(nextSpeed(1, speeds)).toBe(1.25);
    expect(nextSpeed(2, speeds)).toBe(0.75);
    expect(nextSpeed(3, speeds)).toBe(0.75); // не из списка: indexOf -1 → первый
  });

  test('filterEpisodes: по началу номера и по тексту названия', () => {
    expect(filterEpisodes(list, '1').map((e) => e.number)).toEqual([1, 10, 11]);
    expect(filterEpisodes(list, '10')).toEqual([list[1]]);
    expect(filterEpisodes(list, 'СПЕЦ')).toEqual([list[4]]);
    expect(filterEpisodes(list, '  ')).toBe(list);
    expect(filterEpisodes(list, '99')).toEqual([]);
  });
});
