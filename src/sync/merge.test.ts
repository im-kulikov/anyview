import { describe, expect, test } from 'vitest';
import type { TitleSummary } from '../api/contract';
import { LIMITS, parseLocalData, type HistoryEntry, type LocalData } from '../lib/storage';
import { canonical, CLOUD_MAX_BYTES, EMPTY, fitForCloud, mergeData, normalize, sameData, serialize } from './merge';

const title = (id: string, name = id): TitleSummary => ({ id, name, type: 'anime', format: 'tv', status: 'ongoing' }) as TitleSummary;
const hist = (t: string, ep: string, position: number, updatedAt: number): HistoryEntry => ({ title: title(t), episodeId: ep, episodeName: ep, position, duration: 100, updatedAt });
const prog = (titleId: string, position: number, updatedAt: number) => ({ titleId, position, duration: 100, updatedAt });
const data = (p: Partial<LocalData>): LocalData => ({ ...EMPTY, ...p });
const same = (a: LocalData, b: LocalData) => expect(canonical(a)).toBe(canonical(b));

describe('прогресс', () => {
  test('по серии побеждает более свежая запись, остальное объединяется', () => {
    const a = data({ progress: { e1: prog('t', 10, 100), e2: prog('t', 5, 50) } });
    const b = data({ progress: { e1: prog('t', 40, 200), e3: prog('u', 1, 10) } });
    const m = mergeData(a, b);
    expect(m.progress.e1.position).toBe(40);
    expect(Object.keys(m.progress)).toEqual(['e1', 'e2', 'e3']);
  });

  test('лимит 500 вытесняет самые старые', () => {
    const progress = Object.fromEntries(Array.from({ length: 505 }, (_, i) => [`e${i}`, prog('t', 1, i + 1)]));
    const m = normalize(data({ progress }));
    expect(Object.keys(m.progress)).toHaveLength(LIMITS.progress);
    expect(m.progress.e0).toBeUndefined();
    expect(m.progress.e504).toBeDefined();
  });
});

describe('история', () => {
  test('одна запись на тайтл — более свежая; лимит 50', () => {
    const m = mergeData(data({ history: [hist('t', 'e1', 10, 100)] }), data({ history: [hist('t', 'e2', 20, 200), hist('u', 'x1', 1, 50)] }));
    expect(m.history.map((h) => [h.title.id, h.episodeId])).toEqual([['t', 'e2'], ['u', 'x1']]);
    const many = Array.from({ length: 60 }, (_, i) => hist(`t${i}`, `e${i}`, 1, i + 1));
    const n = normalize(data({ history: many }));
    expect(n.history).toHaveLength(LIMITS.history);
    expect(n.history[0].title.id).toBe('t59');
  });

  test('досмотрено на другом устройстве: запись удаляется, а не воскресает', () => {
    const phone = data({ progress: { e3: prog('t', 99, 200) }, history: [] }); // досмотрели последнюю серию, записи нет
    const pc = data({ progress: { e3: prog('t', 50, 100) }, history: [hist('t', 'e3', 50, 100)] });
    const m = mergeData(phone, pc);
    expect(m.history).toEqual([]);
    expect(m.progress.e3.position).toBe(99);
  });

  test('досмотрено, следующая серия: побеждает запись на следующей серии', () => {
    const phone = data({ progress: { e1: prog('t', 95, 200) }, history: [hist('t', 'e2', 0, 200)] });
    const pc = data({ progress: { e1: prog('t', 50, 100) }, history: [hist('t', 'e1', 50, 100)] });
    expect(mergeData(pc, phone).history).toMatchObject([{ episodeId: 'e2', position: 0 }]);
  });

  test('старая запись по недосмотренной серии не воскресает после досмотра другой серии того же тайтла', () => {
    const phone = data({ progress: { e3: prog('t', 99, 200) } });
    const pc = data({ progress: { e2: prog('t', 40, 50) }, history: [hist('t', 'e2', 40, 50)] });
    expect(mergeData(phone, pc).history).toEqual([]);
    // а новый просмотр после досмотра создаёт запись заново
    const again = data({ history: [hist('t', 'e4', 5, 300)], progress: { e4: prog('t', 5, 300) } });
    expect(mergeData(mergeData(phone, pc), again).history).toHaveLength(1);
  });
});

describe('избранное', () => {
  const fav = (...ids: string[]) => ids.map((i) => title(i));

  test('объединение; порядок — по времени добавления, новые сверху', () => {
    const a = data({ favorites: fav('a'), favMeta: { a: { at: 10 } } });
    const b = data({ favorites: fav('b'), favMeta: { b: { at: 20 } } });
    expect(mergeData(a, b).favorites.map((t) => t.id)).toEqual(['b', 'a']);
  });

  test('удаление на одном устройстве не воскресает от старой копии на другом', () => {
    const phone = data({ favorites: [], favMeta: { a: { at: 50, del: true } } });
    const pc = data({ favorites: fav('a'), favMeta: { a: { at: 10 } } });
    const m = mergeData(phone, pc);
    expect(m.favorites).toEqual([]);
    expect(m.favMeta.a).toEqual({ at: 50, del: true });
  });

  test('повторное добавление после удаления побеждает; при равенстве меток удаление сильнее', () => {
    const del = data({ favMeta: { a: { at: 50, del: true } } });
    const readd = data({ favorites: fav('a'), favMeta: { a: { at: 60 } } });
    expect(mergeData(del, readd).favorites).toHaveLength(1);
    const tie = data({ favorites: fav('a'), favMeta: { a: { at: 50 } } });
    expect(mergeData(del, tie).favorites).toHaveLength(0);
  });

  test('избранное без меток считается добавленным «давно» (at = 0)', () => {
    const m = mergeData(data({ favorites: fav('a') }), EMPTY);
    expect(m.favorites).toHaveLength(1);
    expect(m.favMeta.a).toEqual({ at: 0 });
  });

  test('лимиты: избранное 200, надгробий 300', () => {
    const favMeta = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`f${i}`, { at: i + 1 }]));
    const m = normalize(data({ favorites: fav(...Object.keys(favMeta)), favMeta }));
    expect(m.favorites).toHaveLength(LIMITS.favorites);
    const dead = Object.fromEntries(Array.from({ length: 320 }, (_, i) => [`d${i}`, { at: i + 1, del: true as const }]));
    const n = normalize(data({ favMeta: dead }));
    expect(Object.keys(n.favMeta)).toHaveLength(LIMITS.tombstones);
    expect(n.favMeta.d0).toBeUndefined();
    expect(n.favMeta.d319).toBeDefined();
  });
});

// Свойства слияния на случайных (но согласованных) состояниях; генератор детерминирован.
// Ассоциативности нет намеренно: отбрасывание устаревшей записи истории необратимо (ADR-27); сходимость обеспечивают коммутативность и идемпотентность.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
function randomState(r: () => number): LocalData {
  const pick = (n: number) => Math.floor(r() * n);
  const progress: LocalData['progress'] = {};
  for (let i = 0; i < pick(8); i++) {
    const e = pick(6);
    progress[`e${e}`] = prog(`t${e % 3}`, pick(3) === 0 ? 95 : pick(90), 1 + pick(6)); // малый разброс времени — частые равенства
  }
  const history: HistoryEntry[] = [];
  for (let t = 0; t < 3; t++) if (r() < 0.7) history.push(hist(`t${t}`, `e${pick(6)}`, pick(90), 1 + pick(6)));
  const favorites: TitleSummary[] = [];
  const favMeta: LocalData['favMeta'] = {};
  for (let f = 0; f < 5; f++) {
    const x = r();
    if (x < 0.4) {
      favorites.push(title(`f${f}`, `name${pick(2)}`));
      favMeta[`f${f}`] = { at: 1 + pick(6) };
    } else if (x < 0.7) favMeta[`f${f}`] = { at: 1 + pick(6), del: true };
  }
  return { progress, history, favorites, favMeta };
}

describe('свойства слияния', () => {
  const r = rng(42);
  const cases = Array.from({ length: 300 }, () => [randomState(r), randomState(r), randomState(r)] as const);

  test('коммутативность: merge(a, b) = merge(b, a)', () => {
    for (const [a, b] of cases) same(mergeData(a, b), mergeData(b, a));
  });

  test('идемпотентность: merge(a, a) = normalize(a), merge(m, m) = m', () => {
    for (const [a, b] of cases) {
      same(mergeData(a, a), normalize(a));
      const m = mergeData(a, b);
      same(mergeData(m, m), m);
    }
  });

  test('повторное слияние ничего не меняет: merge(a, merge(a, b)) = merge(a, b)', () => {
    for (const [a, b] of cases) {
      const m = mergeData(a, b);
      same(mergeData(a, m), m);
      same(mergeData(b, m), m);
    }
  });

  test('слияние с пустым состоянием не теряет данных', () => {
    for (const [a] of cases) {
      const m = mergeData(a, EMPTY);
      expect(Object.keys(m.progress).sort()).toEqual(Object.keys(a.progress).sort());
      expect(m.favorites.map((t) => t.id).sort()).toEqual(a.favorites.map((t) => t.id).sort());
    }
  });
});

describe('сериализация и размер', () => {
  test('сериализация канонична и переживает разбор', () => {
    const d = data({ progress: { e1: prog('t', 1, 2) }, favorites: [title('a')], favMeta: { a: { at: 3 } } });
    const reordered = { favMeta: d.favMeta, favorites: d.favorites, history: d.history, progress: { e1: { updatedAt: 2, duration: 100, position: 1, titleId: 't' } } };
    expect(serialize(d)).toBe(serialize(reordered));
    const back = parseLocalData(JSON.parse(serialize(d)));
    expect(back && sameData(back, d)).toBe(true);
  });

  test('разбор недоверенных данных: мусор отбрасывается поэлементно', () => {
    const back = parseLocalData({ progress: { e1: prog('t', 1, 2), e2: 'x' }, history: [1, hist('t', 'e1', 1, 1)], favorites: 5, favMeta: { a: { at: 'x' } } });
    expect(Object.keys(back!.progress)).toEqual(['e1']);
    expect(back!.history).toHaveLength(1);
    expect(back!.favorites).toEqual([]);
    expect(back!.favMeta).toEqual({});
    expect(parseLocalData('строка')).toBeNull();
  });

  test('обрезка до лимита: старые прогресс и история уходят первыми, свежее остаётся, локальное не меняется', () => {
    const progress = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`e${i}`, prog('t', 1, i + 1)]));
    const history = Array.from({ length: 50 }, (_, i) => hist(`t${i}`, `e${i}`, 1, 1000 + i));
    const favorites = Array.from({ length: 200 }, (_, i) => title(`f${i}`, 'Очень длинное название тайтла '.repeat(13)));
    const favMeta = Object.fromEntries(favorites.map((t, i) => [t.id, { at: i + 1 }]));
    const big = normalize(data({ progress, history, favorites, favMeta }));
    expect(new TextEncoder().encode(serialize(big)).length).toBeGreaterThan(CLOUD_MAX_BYTES);

    const fit = fitForCloud(big);
    expect(new TextEncoder().encode(serialize(fit)).length).toBeLessThanOrEqual(CLOUD_MAX_BYTES);
    expect(Object.keys(fit.progress).length).toBeLessThan(500);
    expect(fit.progress.e499).toBeDefined(); // самые свежие на месте
    expect(fit.progress.e0).toBeUndefined();
    expect(Object.keys(big.progress)).toHaveLength(500);
    same(fitForCloud(fit), fit); // уже влезает — без изменений
  });

  test('если и без прогресса не влезает, режется избранное; цикл завершается', () => {
    const favorites = Array.from({ length: 200 }, (_, i) => title(`f${i}`, 'x'.repeat(2000)));
    const fit = fitForCloud(data({ favorites, favMeta: Object.fromEntries(favorites.map((t, i) => [t.id, { at: i + 1 }])) }), 50_000);
    expect(fit.favorites.length).toBeGreaterThan(0);
    expect(fit.favorites.length).toBeLessThan(200);
    expect(fit.favorites.some((t) => t.id === 'f0')).toBe(false); // самые старые ушли первыми
    expect(fit.favMeta.f199).toBeDefined();
  });
});
