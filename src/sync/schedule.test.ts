import { expect, test, vi } from 'vitest';
import { canSyncOnVisible, createDebouncer, retryDelay, RETRY_MAX_MS, VISIBLE_MIN_MS } from './schedule';

test('повтор: 5, 10, 20 с … не больше 5 минут', () => {
  expect([0, 1, 2, 3].map(retryDelay)).toEqual([5000, 10000, 20000, 40000]);
  expect(retryDelay(20)).toBe(RETRY_MAX_MS);
});

test('возврат на вкладку: не чаще раза в минуту', () => {
  expect(canSyncOnVisible(null, 1)).toBe(true);
  expect(canSyncOnVisible(1000, 1000 + VISIBLE_MIN_MS - 1)).toBe(false);
  expect(canSyncOnVisible(1000, 1000 + VISIBLE_MIN_MS)).toBe(true);
});

test('дебаунс: последний вызов сдвигает срок, flush и cancel', () => {
  vi.useFakeTimers();
  try {
    const fn = vi.fn();
    const d = createDebouncer(fn, 5000);
    d.call();
    vi.advanceTimersByTime(4000);
    d.call();
    vi.advanceTimersByTime(4000);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(d.pending).toBe(false);

    d.call();
    d.flush();
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10000);
    expect(fn).toHaveBeenCalledTimes(2); // flush отменил таймер

    d.call();
    d.cancel();
    d.flush();
    vi.advanceTimersByTime(10000);
    expect(fn).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
