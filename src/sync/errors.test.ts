import { expect, test } from 'vitest';
import { classifyError, SchemaError } from './errors';
import { syncConfig } from './config';

test('классификация ошибок Firebase', () => {
  const c = (code: string) => classifyError(Object.assign(new Error('x'), { code }));
  expect(c('unavailable')).toBe('network');
  expect(c('auth/network-request-failed')).toBe('network');
  expect(c('permission-denied')).toBe('denied');
  expect(c('resource-exhausted')).toBe('quota');
  expect(c('auth/invalid-credential')).toBe('auth');
  expect(c('unauthenticated')).toBe('auth');
  expect(classifyError(new TypeError('Failed to fetch'))).toBe('network');
  expect(classifyError(new SchemaError())).toBe('schema');
  expect(classifyError('boom')).toBe('unknown');
  expect(classifyError(null)).toBe('unknown');
});

test('конфигурация: без обязательных полей синхронизации нет', () => {
  const full = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_AUTH_DOMAIN: 'd', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a', VITE_GOOGLE_CLIENT_ID: 'c' };
  expect(syncConfig(full)?.clientId).toBe('c');
  expect(syncConfig({})).toBeNull();
  expect(syncConfig({ ...full, VITE_GOOGLE_CLIENT_ID: '' })).toBeNull();
});
