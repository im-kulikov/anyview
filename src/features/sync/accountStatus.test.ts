import { expect, test } from 'vitest';
import { rowKind, type StatusInput } from './accountStatus';

const base: StatusInput = { available: true, signedIn: false, loading: false, checking: false, syncing: false, error: false };
const k = (o: Partial<StatusInput>) => rowKind({ ...base, ...o });

test('строка статуса: недоступно — нет строки', () => expect(k({ available: false, signedIn: true })).toBeNull());
test('не вошли: выключено, а пока проверяется вход — «проверяем»', () => {
  expect(k({})).toBe('off');
  expect(k({ loading: true })).toBe('checking');
  expect(k({ checking: true })).toBe('checking');
});
test('вошли: синхронизация, ошибка, синхронизировано, просто вошли', () => {
  expect(k({ signedIn: true, syncing: true, error: true })).toBe('syncing');
  expect(k({ signedIn: true, error: true, lastSync: 5 })).toBe('error');
  expect(k({ signedIn: true, lastSync: 5 })).toBe('ok');
  expect(k({ signedIn: true })).toBe('signed');
});
