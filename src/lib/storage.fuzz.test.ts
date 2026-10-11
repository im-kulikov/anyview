import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fc } from '../test/fc';
import { EVIL, KEYS, mutate, mutateLeaf, VALID } from '../test/samples';

/** Фаззинг данных пользователя: что бы ни лежало в localStorage или пришло из облака, чтение не бросает и отдаёт только годные данные. */
const data = new Map<string, string>();
const api = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
vi.stubGlobal('localStorage', new Proxy(api, {
  ownKeys: () => [...data.keys()],
  getOwnPropertyDescriptor: (_t, k) => (data.has(String(k)) ? { enumerable: true, configurable: true, value: data.get(String(k)) } : undefined),
}));
vi.stubGlobal('location', { pathname: '/', search: '', hash: '' });
vi.stubGlobal('navigator', { userAgent: 'fuzz', language: 'ru', onLine: true });
vi.stubGlobal('innerWidth', 390);
vi.stubGlobal('innerHeight', 844);
vi.stubGlobal('devicePixelRatio', 1);
vi.spyOn(console, 'error').mockImplementation(() => {});

const S = await import('./storage');
const { buildBugReport } = await import('./bugReport');
const { mergeData, normalize, sameData, EMPTY } = await import('../sync/merge');
const { canonical } = await import('../sync/merge');
const VALID_SUMMARY = (VALID.favorites as { id: string }[])[0];

beforeEach(() => data.clear());

const readAll = () => {
  S.historyStore.get(); S.favoritesStore.get(); S.favoritesMetaStore.get(); S.statusesStore.get();
  S.progressStore.get(); S.prefsStore.get(); S.recentStore.get(); S.feedStore.get();
  return S.readLocal();
};

describe('хранилище', () => {
  test('произвольный JSON и произвольные строки в любом ключе: чтение не бросает, повторный разбор не меняет данные', () =>
    fc.assert(fc.property(
      fc.constantFrom(...KEYS), fc.oneof(fc.string(), fc.jsonValue().map((v) => JSON.stringify(v))),
      (key, raw) => {
        data.clear();
        data.set(`anyview:v1:${key}`, raw);
        const local = readAll();
        const again = S.parseLocalData(JSON.parse(JSON.stringify(local)));
        expect(again && sameData(again, local)).toBe(true); // всё, что вышло из чтения, снова проходит проверки
      },
    )));

  test('мутации корректных данных (случайное поле → случайное значение или удаление): не бросает, результат валиден', () =>
    fc.assert(fc.property(
      fc.constantFrom(...KEYS), fc.array(fc.nat(50), { minLength: 1, maxLength: 5 }), fc.oneof(fc.constant(undefined), fc.jsonValue()), fc.boolean(),
      (key, path, repl, del) => {
        data.clear();
        for (const k of KEYS) data.set(`anyview:v1:${k}`, JSON.stringify(k === key ? mutate(VALID[k], path, repl, del) : VALID[k]));
        const local = readAll();
        const again = S.parseLocalData(JSON.parse(JSON.stringify(local)));
        expect(again && sameData(again, local)).toBe(true);
        // подписи: у каждого показываемого снимка форматы и числа пригодны для отрисовки
        for (const t of [...local.favorites, ...local.history.map((h) => h.title)]) {
          expect(['tv', 'movie', 'ova', 'ona', 'special', 'short', 'unknown']).toContain(t.format);
          if (t.rating) expect(Number.isFinite(t.rating.value)).toBe(true);
        }
      },
    )));

  test('целенаправленная порча листа «злым» значением: не бросает, подписи и числа пригодны для отрисовки', () =>
    fc.assert(fc.property(
      fc.constantFrom(...KEYS), fc.noBias(fc.nat(10_000)), fc.oneof(fc.constantFrom(...EVIL), fc.jsonValue()), fc.boolean(),
      (key, leaf, repl, del) => {
        data.clear();
        for (const k of KEYS) data.set(`anyview:v1:${k}`, JSON.stringify(k === key ? mutateLeaf(VALID[k], leaf, repl, del) : VALID[k]));
        const local = readAll();
        const again = S.parseLocalData(JSON.parse(JSON.stringify(local)));
        expect(again && sameData(again, local)).toBe(true);
        for (const t of [...local.favorites, ...local.history.map((h) => h.title), ...Object.values(local.statuses).flatMap((e) => (e.t ? [e.t] : []))]) {
          expect(['tv', 'movie', 'ova', 'ona', 'special', 'short', 'unknown']).toContain(t.format);
          expect(['announced', 'ongoing', 'released', 'unknown']).toContain(t.status);
          if (t.rating) expect(Number.isFinite(t.rating.value)).toBe(true);
          if (t.poster) expect(typeof t.poster.url).toBe('string');
          if (t.latestEpisode) expect(Number.isFinite(t.latestEpisode.number)).toBe(true);
        }
      },
    )));

  test('отчёт о проблеме не бросает и ограничен по размеру при любом содержимом хранилища', () =>
    fc.assert(fc.property(
      fc.dictionary(fc.constantFrom(...KEYS).map((k) => `anyview:v1:${k}`), fc.oneof(fc.string(), fc.jsonValue().map((v) => JSON.stringify(v)))), fc.boolean(),
      (entries, withData) => {
        data.clear();
        for (const [k, v] of Object.entries(entries)) data.set(k, v);
        const text = buildBugReport({ includeData: withData });
        expect(text.length).toBeLessThan(40_000);
      },
    )));
});

describe('слияние между устройствами на произвольных данных', () => {
  const entry = fc.record({ s: fc.constantFrom('watching', 'done', 'planned', null), at: fc.integer({ min: 0, max: 8 }) });
  const state = fc.record({
    progress: fc.dictionary(fc.constantFrom('e1', 'e2', 'e3'), fc.record({ titleId: fc.constantFrom('t1', 't2'), position: fc.integer({ min: 0, max: 100 }), duration: fc.constant(100), updatedAt: fc.integer({ min: 0, max: 8 }) })),
    statuses: fc.dictionary(fc.constantFrom('t1', 't2', 't3'), entry).map((d) => Object.fromEntries(Object.entries(d).map(([k, e]) => [k, e.s ? { ...e, t: { ...VALID_SUMMARY, id: k } } : { s: null, at: e.at }]))),
  }).map((p) => normalize({ ...EMPTY, progress: p.progress, statuses: p.statuses as never }));

  test('коммутативность и идемпотентность (реальные состояния — результат normalize)', () =>
    fc.assert(fc.property(state, state, (a, b) => {
      expect(canonical(mergeData(a, b))).toBe(canonical(mergeData(b, a)));
      const m = mergeData(a, b);
      expect(canonical(mergeData(m, m))).toBe(canonical(m));
    })));
});
