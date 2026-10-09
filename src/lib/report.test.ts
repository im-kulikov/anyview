import { afterEach, expect, test, vi } from 'vitest';
import { report, resetReports } from './report';

afterEach(() => {
  resetReports();
  vi.restoreAllMocks();
});

test('одинаковая ошибка в одном контексте сообщается один раз', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  report(new Error('x'), 'a');
  report(new Error('x'), 'a');
  report(new Error('x'), 'b');
  report(new Error('y'), 'a');
  expect(spy).toHaveBeenCalledTimes(3);
});
