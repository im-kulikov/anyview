import { describe, expect, test, vi } from 'vitest';
import type { RawItem } from './parse';
import { createAnimevostProvider, summariesOf, toSummary, toTitle } from '.';

/** Чужой API не гарантирует форму полей: мусор в необязательных полях не должен ронять ни карточку, ни ленту. */
const bad = (extra: Record<string, unknown>) => ({ id: 1, title: 'Тест / Test [1 из 12]', ...extra }) as unknown as RawItem;
const GARBAGE: [string, RawItem][] = [
  // найдено фаззингом (ADR-35)
  ['type — __proto__ (поиск по словарю без hasOwn)', bad({ type: '__proto__' })],
  ['type — constructor', bad({ type: 'constructor' })],
  ['year — объект с toString: 0 (Number() бросает)', bad({ year: { toString: 0 } })],
  ['rating — объект с toString: 0', bad({ rating: { toString: 0 }, votes: { toString: 0 } })],
  ['type — число', bad({ type: 3 })],
  ['genre — объект', bad({ genre: { a: 1 } })],
  ['description — число', bad({ description: 5 })],
  ['director — объект', bad({ director: {} })],
  ['year — объект', bad({ year: {} })],
  ['urlImagePreview — число', bad({ urlImagePreview: 7 })],
  ['rating/votes — мусор', bad({ rating: {}, votes: [] })],
  ['screenImage — строка', bad({ screenImage: 'x' })],
  ['screenImage — числа', bad({ screenImage: [1] })],
];

describe('мусорные поля чужого API', () => {
  test.each(GARBAGE)('toSummary/toTitle: %s — не бросают', (_n, raw) => {
    expect(() => toSummary(raw)).not.toThrow();
    expect(() => toTitle(raw)).not.toThrow();
  });

  test('summariesOf: плохой элемент не роняет соседей', () => {
    const boom = { id: 2, title: null } as unknown as RawItem; // нет названия — отбрасывается
    const good = { id: 100, title: 'Хорошее / Good [1 из 12]', year: '2020', type: 'ТВ' } as RawItem;
    const items = summariesOf([...GARBAGE.map(([, r]) => r), boom, good]);
    expect(items.some((i) => i.id === 'av-100')).toBe(true);
  });

  test('лента: один плохой элемент не превращает страницу в ошибку', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ state: { status: 'ok', count: 2 }, data: [bad({ type: 3, id: 7 }), { id: 8, title: 'Ок / Ok [1 из 1]' }] }))));
    const page = await createAnimevostProvider(['https://a.test']).updates({ type: 'anime', page: 1, pageSize: 30 });
    expect(page.items.some((i) => i.id === 'av-8')).toBe(true);
    vi.unstubAllGlobals();
  });
});

import { episodesOf } from './parse';
import { toDetails } from './details';

describe('найдено фаззингом (ADR-35)', () => {
  test('type «__proto__» и «constructor» дают формат unknown, а не объект прототипа', () => {
    expect(toSummary(bad({ type: '__proto__' })).format).toBe('unknown');
    expect(toSummary(bad({ type: 'constructor' })).format).toBe('unknown');
  });
  test('плейлист: hd/std не строкой не роняют разбор серий', () => {
    const eps = episodesOf('1', 'av-1', [{ name: '1 серия', std: { toString: false } as never, hd: 5 as never }]);
    expect(eps).toHaveLength(1);
  });
  test('сведения: source «__proto__» и rating «constructor» не дают подписи', () => {
    const d = toDetails({ rating: 'constructor' }, { source: '__proto__' });
    expect(d.source).toBeUndefined();
    expect(d.ageRating).toBeUndefined();
  });
});
