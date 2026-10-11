import { describe, expect, it } from 'vitest';
import { cacheable, pickStrategy, staleCaches } from './logic';

const O = 'https://site.test';
const B = '/anyview/';
const req = (url: string, o: Partial<{ method: string; mode: string; range: boolean }> = {}) => ({ url, method: 'GET', mode: 'no-cors', range: false, ...o });

describe('pickStrategy', () => {
  it('навигация внутри base — оболочка', () => expect(pickStrategy(req(`${O}/anyview/title/av-1`, { mode: 'navigate' }), O, B)).toBe('shell'));
  it('хешированный ассет — кеш', () => expect(pickStrategy(req(`${O}/anyview/assets/index-abc.js`), O, B)).toBe('asset'));
  it('версия, сам sw.js, манифест, картинки — мимо', () => {
    for (const p of ['version.json', 'sw.js', 'manifest.webmanifest', 'brand/logo-mark.svg']) expect(pickStrategy(req(`${O}/anyview/${p}`), O, B)).toBe('pass');
  });
  it('API и чужие домены — мимо', () => {
    expect(pickStrategy(req('https://api.test/v1/last'), O, B)).toBe('pass');
    expect(pickStrategy(req('https://img.test/assets/x.jpg'), O, B)).toBe('pass');
    expect(pickStrategy(req(`${O}/other/assets/x.js`), O, B)).toBe('pass');
  });
  it('не GET и Range (видео) — мимо', () => {
    expect(pickStrategy(req(`${O}/anyview/assets/a.js`, { method: 'POST' }), O, B)).toBe('pass');
    expect(pickStrategy(req(`${O}/anyview/assets/a.js`, { range: true }), O, B)).toBe('pass');
    expect(pickStrategy(req(`${O}/anyview/`, { mode: 'navigate', range: true }), O, B)).toBe('pass');
  });
});

describe('cacheable', () => {
  it('только 200 basic', () => {
    expect(cacheable(200, 'basic')).toBe(true);
    for (const [s, t] of [[404, 'basic'], [500, 'basic'], [206, 'basic'], [0, 'opaque'], [200, 'opaque'], [200, 'cors']] as const) expect(cacheable(s, t)).toBe(false);
  });
});

describe('staleCaches', () => {
  it('удаляет прежние версии, чужие не трогает', () => expect(staleCaches(['anyview-a', 'anyview-b', 'other'], 'anyview-b')).toEqual(['anyview-a']));
});
