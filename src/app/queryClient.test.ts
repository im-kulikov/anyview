import { expect, test } from 'vitest';
import { ApiError } from '../api/contract';
import { isReportable, shouldRetry } from './queryClient';

test('политика повторов (CODE-20)', () => {
  expect(shouldRetry(0, new ApiError('network', 'x'))).toBe(true);
  expect(shouldRetry(0, new ApiError('http', 'x', 503))).toBe(true);
  expect(shouldRetry(0, new ApiError('http', 'x', 429))).toBe(true);
  expect(shouldRetry(0, new ApiError('http', 'x', 404))).toBe(false);
  expect(shouldRetry(0, new ApiError('http', 'x', 403))).toBe(false);
  expect(shouldRetry(0, new ApiError('not_found', 'x'))).toBe(false);
  expect(shouldRetry(0, new ApiError('parse', 'x'))).toBe(false);
  expect(shouldRetry(2, new ApiError('network', 'x'))).toBe(false);
});

test('в отчёты попадают поломки, а не «нет сети» и «не найдено»', () => {
  expect(isReportable(new ApiError('parse', 'x'))).toBe(true);
  expect(isReportable(new ApiError('http', 'x', 502))).toBe(true);
  expect(isReportable(new TypeError('bug'))).toBe(true);
  expect(isReportable(new ApiError('network', 'x'))).toBe(false);
  expect(isReportable(new ApiError('not_found', 'x'))).toBe(false);
  expect(isReportable(new ApiError('http', 'x', 404))).toBe(false);
  expect(isReportable(new DOMException('a', 'AbortError'))).toBe(false);
});
