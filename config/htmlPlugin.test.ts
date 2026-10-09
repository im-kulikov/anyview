import { expect, test } from 'vitest';
import { FEED_PAGE_SIZE } from '../src/api/keys';
import { lastPath } from '../src/api/providers/animevost/urls';
import { csp, headHints } from './htmlPlugin';

const hrefs = (env: Parameters<typeof headHints>[0]) => headHints(env).map((t) => `${t.attrs?.rel} ${t.attrs?.href}`);

test('подсказки строятся из VITE_ANIMEVOST_BASES и FEED_PAGE_SIZE', () => {
  expect(hrefs({ VITE_ANIMEVOST_BASES: ' https://a.test/v1/ , https://b.test/v1' })).toEqual([
    'preconnect https://a.test',
    'preconnect https://static.openni.ru',
    `preload https://a.test/v1${lastPath(1, FEED_PAGE_SIZE)}`,
  ]);
});

test('другой провайдер — без подсказок про animevost', () => {
  expect(headHints({ VITE_PROVIDER: 'anyview' })).toEqual([]);
});

test('CSP: connect-src только из баз, скрипты только свои', () => {
  const c = csp({ VITE_ANIMEVOST_BASES: 'https://a.test/v1,https://b.test/v1,https://a.test/v2' });
  expect(c).toContain("connect-src 'self' https://a.test https://b.test;");
  expect(c).toContain("script-src 'self';");
  expect(csp({ VITE_PROVIDER: 'anyview', VITE_API_BASE: 'https://api.me/x' })).toContain("connect-src 'self' https://api.me;");
});
