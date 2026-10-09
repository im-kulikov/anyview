import { describe, expect, test } from 'vitest';
import { initialPlayback, playbackReducer as r, type PlaybackEvent, type PlaybackState } from './playerReducer';

const run = (...ev: PlaybackEvent[]): PlaybackState => ev.reduce(r, initialPlayback);

describe('playbackReducer', () => {
  test('загрузка → играет', () => {
    expect(run({ type: 'load' }, { type: 'play' }, { type: 'ready' })).toMatchObject({ started: true, playing: true, loading: false, failed: false });
  });
  test('ended с отсчётом → тики → отмена', () => {
    let s = run({ type: 'load' }, { type: 'play' }, { type: 'ended', action: 'countdown' });
    expect(s).toMatchObject({ playing: false, countdown: 5 });
    s = r(r(s, { type: 'tick' }), { type: 'tick' });
    expect(s.countdown).toBe(3);
    expect(r(s, { type: 'cancelCountdown' }).countdown).toBeNull();
  });
  test('ended на последней серии: отсчёта нет', () => {
    expect(run({ type: 'load' }, { type: 'ended', action: 'none' }).countdown).toBeNull();
  });
  test('fail гасит playing, loading и отсчёт — невозможных комбинаций нет', () => {
    const s = run({ type: 'load' }, { type: 'play' }, { type: 'ended', action: 'countdown' }, { type: 'fail' });
    expect(s).toMatchObject({ failed: true, playing: false, loading: false, countdown: null });
  });
  test('triedAlt: load{alt} ставит, обычный load сбрасывает', () => {
    const s = run({ type: 'load' }, { type: 'load', alt: true });
    expect(s.triedAlt).toBe(true);
    expect(r(s, { type: 'load' }).triedAlt).toBe(false);
  });
  test('повторная загрузка снимает ошибку и отсчёт', () => {
    expect(run({ type: 'fail' }, { type: 'load' })).toMatchObject({ failed: false, loading: true, countdown: null });
  });
  test('reset (серия сменилась снаружи) возвращает исходное состояние', () => {
    expect(run({ type: 'load' }, { type: 'play' }, { type: 'reset' })).toEqual(initialPlayback);
  });
  test('waiting/ready и pause', () => {
    expect(run({ type: 'play' }, { type: 'waiting' }).loading).toBe(true);
    expect(run({ type: 'play' }, { type: 'waiting' }, { type: 'pause' })).toMatchObject({ playing: false, loading: false });
  });
  test('tick без отсчёта не меняет состояние', () => {
    expect(r(initialPlayback, { type: 'tick' })).toBe(initialPlayback);
  });
});
