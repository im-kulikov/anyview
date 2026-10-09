import { afterEach, describe, expect, test, vi } from 'vitest';
import type { TitleSummary } from '../../contract';
import { createAnimevostProvider, toSummary } from './index';
import { baseName, classifyRelated, headName, hasKindMarker, MAX_SIMILAR, normTitle, relatedQuery, seasonMarker } from './related';

// Фрагменты реальных ответов POST /search: [id, год, тип, title].
type Row = [number, string, string, string];
const raw = ([id, year, type, title]: Row) => ({ id, title, year, type });
const sum = (r: Row): TitleSummary => toSummary(raw(r));
const rows = (rs: Row[]) => rs.map(sum);
const pick = (rs: Row[], id: number) => sum(rs.find((r) => r[0] === id)!);
const ids = (ts: { id: string }[]) => ts.map((t) => t.id);

const PUBLIC: Row[] = [
  [3138, '2024', 'ТВ', 'Пощади меня, великий господин! (второй сезон) / Da Wang Rao Ming 2 [1-12 из 12]'],
  [2729, '2021', 'ONA', 'Пощади меня, великий господин! / Da Wang Rao Ming [1-12 из 12]'],
  [4066, '2026', 'ТВ', 'Пощади меня, великий господин! (третий сезон) / Da Wang Rao Ming 3 [1-3 из 12+]'],
];
const ICE: Row[] = [
  [2907, '2023', 'ТВ', 'Волшебник ледяного клинка правит миром / Hyouken no Majutsushi ga Sekai wo Suberu [1-12 из 12]'],
  [4020, '2026', 'ТВ', 'Волшебник ледяного клинка правит миром (второй сезон) / Hyouken no Majutsushi ga Sekai wo Suberu II [1 из 12+]'],
];
const NARUTO: Row[] = [
  [7, '2002', 'ТВ', 'Наруто / Naruto [1-220 из 220]'],
  [8, '2003', 'OVA', 'Наруто OVA-1 / Naruto OVA-1 [1 из 1]'],
  [10, '2004', 'полнометражный фильм', 'Наруто (фильм первый) / Naruto the Movie: Ninja Clash in the Land of Snow [1 из 1]'],
  [11, '2004', 'короткометражный фильм', 'Наруто: Спортивный фестиваль Конохи / Naruto: Konoha Sports Festival [1 из 1]'],
  [12, '2005', 'полнометражный фильм', 'Наруто (фильм второй) / Naruto the Movie 2: Legend of the Stone of Gelel [1 из 1]'],
  [49, '2012', 'ТВ', 'ЧИБИ Наруто: Весна Юности Рока Ли / Naruto SD: Rock Lee no Seishun Full-Power Ninden [1-21 из 51]'],
  [5, '2007', 'ТВ', 'Наруто Ураганные Хроники / Naruto Shippuuden [1-500 из 500]'],
  [1805, '2017', 'ТВ', 'Боруто: Новое поколение Наруто / Boruto: Naruto Next Generations [1-293 из 293]'],
];
const KAMUY: Row[] = [
  [2868, '2022', 'ТВ', 'Золотое божество (четвёртый сезон) / Golden Kamuy 4th Season [1-13 из 13]'],
  [2057, '2018', 'ТВ', 'Золотое божество / Golden Kamuy [1-12 из 12]'],
  [2156, '2018', 'ТВ', 'Золотое божество (второй сезон) / Golden Kamuy Second Season [1-12 из 12]'],
  [2516, '2020', 'ТВ', 'Золотое божество (третий сезон) / Golden Kamuy 3rd Season [1-12 из 12]'],
  [3764, '2026', 'ТВ', 'Золотое божество: Финал / Golden Kamuy: Saishuushou [1-13 из 13]'],
];
const SLIME: Row[] = [
  [2167, '2018', 'ТВ', 'О моём перерождении в слизь / Tensei shitara Slime Datta Ken [1-25 из 25] [OVA 1-5 из 5]'],
  [2261, '2021', 'ТВ', 'О моём перерождении в слизь (второй сезон) / Tensei shitara Slime Datta Ken Second Season [1-24 из 24]'],
  [2605, '2021', 'ТВ', 'О моём перерождении в слизь. Дневник слизи-попаданца / Tensura Nikki: Tensei shitara Slime Datta Ken [1-12 из 12]'],
  [2976, '2022', 'полнометражный фильм', 'О моём перерождении в слизь: Алые узы / Tensei shitara Slime Datta Ken Movie [1 из 1]'],
  [3096, '2023', 'OVA', 'О моём перерождении в слизь: Мечта Колеуса / Tensei Shitara Slime Datta Ken: Coleus no Yume [1-3 из 3]'],
  [3152, '2024', 'ТВ', 'О моём перерождении в слизь (третий сезон) / Tensei shitara Slime Datta Ken 3rd Season [1-24 из 24]'],
  [3802, '2026', 'ТВ', 'О моём перерождении в слизь (четвёртый сезон) / Tensei shitara Slime Datta Ken 4th Season [1-24 из 24]'],
];
const MUSHOKU: Row[] = [
  [3004, '2023', 'ТВ', 'Реинкарнация безработного: История о приключениях в другом мире (второй сезон) / Mushoku Tensei II [1-12 из 12]'],
  [2540, '2020', 'ТВ', 'Реинкарнация безработного: История о приключениях в другом мире / Mushoku Tensei: Isekai Ittara Honki Dasu [1-11 из 11]'],
  [2678, '2021', 'ТВ', 'Реинкарнация безработного: История о приключениях в другом мире: Часть 2 / Mushoku Tensei: Part 2 [12-23 из 23]'],
  [3922, '2026', 'ТВ', 'Реинкарнация безработного: История о приключениях в другом мире (третий сезон) / Mushoku Tensei 3 [1 из 12+]'],
];
const SHAMAN: Row[] = [
  [166, '2001', 'ТВ', 'Король шаманов / Shaman King [1-64 из 64]'],
  [2582, '2021', 'ТВ', 'Король шаманов (2021) / Shaman King (2021) [1-52 из 52]'],
  [3122, '2024', 'ТВ', 'Король шаманов: Цветы / Shaman King: Flowers [1-13 из 13]'],
];
const HIGURASHI: Row[] = [
  [2494, '2020', 'ТВ', 'Когда плачут цикады / Higurashi no Naku Koro ni (2020) [1-24 из 24]'],
  [1270, '2006', 'ТВ', 'Когда плачут цикады / Higurashi no Naku Koro ni [1-26 из 26]'],
  [1271, '2007', 'ТВ', 'Когда плачут цикады (второй сезон) / Higurashi no Naku Koro ni Kai [1-24 из 24]'],
  [1272, '2009', 'OVA', 'Когда плачут цикады ОВА / Higurashi no Naku Koro ni Rei [1-5 из 5]'],
  [2633, '2021', 'ТВ', 'Когда плачут цикады: Выпускной / Higurashi no Naku Koro ni Sotsu [1-15 из 15]'],
];

describe('нормализация и маркеры названия', () => {
  test('регистр, ё/е, пунктуация, пробелы', () => {
    expect(normTitle('Четвёртый  СЕЗОН: Ёж!')).toBe('четвертый сезон еж');
    expect(normTitle('Король шаманов')).toBe(normTitle('КОРОЛЬ  ШАМАНОВ'));
    expect(normTitle('Всё')).toBe(normTitle('Все'));
  });

  test('литеральные обратные слэши перед кавычками убираются', () => {
    expect(normTitle(String.raw`Queen\'s Blade`)).toBe(normTitle("Queen's Blade"));
    expect(normTitle(String.raw`\"Волшебство Гайдэн\"`)).toBe('волшебство гайдэн');
    expect(baseName(String.raw`\"Волшебство Гайдэн\" (второй сезон)`)).toBe('"Волшебство Гайдэн"');
  });

  test('маркеры сезона: словом, цифрой, с «-й», «первый»', () => {
    expect(seasonMarker('Пощади меня, великий господин! (второй сезон)')).toBe(2);
    expect(seasonMarker('Пощади меня, великий господин! (третий сезон)')).toBe(3);
    expect(seasonMarker('Х (четвёртый сезон)')).toBe(4);
    expect(seasonMarker('Х (четвертый сезон)')).toBe(4);
    expect(seasonMarker('Х (одиннадцатый сезон)')).toBe(11);
    expect(seasonMarker('Х (2 сезон)')).toBe(2);
    expect(seasonMarker('Х (3-й сезон)')).toBe(3);
    expect(seasonMarker('Х (первый сезон)')).toBe(1);
    expect(seasonMarker('Х')).toBeUndefined();
    expect(seasonMarker('Triage X 2')).toBeUndefined(); // цифры в названии — не сезон
  });

  test('маркеры фильма и спэшла, в т.ч. двойной пробел и латинская c', () => {
    expect(hasKindMarker('Наруто (фильм первый)')).toBe(true);
    expect(hasKindMarker('Х (фильм  второй)')).toBe(true);
    expect(hasKindMarker('Х (коллекция фильмов)')).toBe(false); // не вырезается как маркер: остаётся в названии
    expect(hasKindMarker('Х (спецвыпуск 2)')).toBe(true);
    expect(hasKindMarker('Х (спэшл 1)')).toBe(true);
    expect(hasKindMarker('Х (c' + 'пэшлы)')).toBe(true); // латинская c
    expect(hasKindMarker('Х (спэшлы)')).toBe(true);
    expect(hasKindMarker('Х (второй сезон)')).toBe(false);
    expect(baseName('Х  (фильм  второй)')).toBe('Х');
    expect(baseName('Х (c' + 'пэшлы)')).toBe('Х');
    expect(baseName('Король шаманов (2021)')).toBe('Король шаманов (2021)'); // год — часть названия
    expect(baseName('Наруто OVA-1')).toBe('Наруто OVA-1');
  });

  test('«голова»: до первого подзаголовка', () => {
    expect(headName('Золотое божество: Финал')).toBe('Золотое божество');
    expect(headName('О моём перерождении в слизь. Дневник слизи-попаданца')).toBe('О моём перерождении в слизь');
    expect(headName('Фейт — Ночь схватки')).toBe('Фейт');
    expect(headName('Блич - Тысячелетняя война')).toBe('Блич');
    expect(headName('Слизь-попаданец')).toBe('Слизь-попаданец'); // дефис без пробелов — часть слова
    expect(headName('Наруто')).toBe('Наруто');
  });

  test('запрос: «голова» от 4 символов, иначе база целиком', () => {
    expect(relatedQuery('Золотое божество: Финал')).toBe('Золотое божество');
    expect(relatedQuery('Пощади меня, великий господин! (второй сезон)')).toBe('Пощади меня, великий господин!');
    expect(relatedQuery('Ван: Кусок (второй сезон)')).toBe('Ван: Кусок');
    expect(relatedQuery(String.raw`\"Волшебство Гайдэн\" (второй сезон)`)).toBe('Волшебство Гайдэн');
  });
});

describe('классификация связей', () => {
  test('три сезона заказчика: ONA 2021, 2024, 2026; текущий отмечен', () => {
    const r = classifyRelated(pick(PUBLIC, 3138), rows(PUBLIC));
    expect(r.seasons.map((s) => [s.id, s.number, s.label, s.year, s.current])).toEqual([
      ['av-2729', 1, '1 сезон', 2021, false],
      ['av-3138', 2, '2 сезон', 2024, true],
      ['av-4066', 3, '3 сезон', 2026, false],
    ]);
    expect(r.similar).toEqual([]);
    expect(classifyRelated(pick(PUBLIC, 4066), rows(PUBLIC)).seasons.map((s) => s.current)).toEqual([false, false, true]);
  });

  test('ё/е и регистр между сезонами одной франшизы не мешают', () => {
    const a = sum([1, '2020', 'ТВ', 'Всё о Ёжике / Hedgehog [1-12 из 12]']);
    const b = sum([2, '2021', 'ТВ', 'ВСЕ О ЕЖИКЕ (второй сезон) / Hedgehog 2 [1-12 из 12]']);
    expect(classifyRelated(a, [a, b]).seasons.map((s) => s.number)).toEqual([1, 2]);
  });

  test('Волшебник ледяного клинка: два сезона', () => {
    expect(classifyRelated(pick(ICE, 4020), rows(ICE)).seasons.map((s) => [s.id, s.current])).toEqual([['av-2907', false], ['av-4020', true]]);
  });

  test('Наруто: фильмы, OVA, спин-оффы — «Похожие» по году; сезон один, текущий не в «Похожих»', () => {
    const r = classifyRelated(pick(NARUTO, 7), rows(NARUTO));
    expect(r.seasons.map((s) => s.id)).toEqual(['av-7']);
    // «ЧИБИ Наруто» и «Боруто: …Наруто» — другая голова, не связываем; «Ураганные Хроники» — база начинается с «Наруто »
    expect(ids(r.similar)).toEqual(['av-8', 'av-10', 'av-11', 'av-12', 'av-5']);
    expect(ids(r.similar)).not.toContain('av-7');
  });

  test('Золотое божество: сезоны 1-4, «Финал» — похожее', () => {
    const r = classifyRelated(pick(KAMUY, 2156), rows(KAMUY));
    expect(r.seasons.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(ids(r.similar)).toEqual(['av-3764']);
    // из «Финала» (другая база) сезоны первых четырёх не видны, а он сам не сезон
    const fin = classifyRelated(pick(KAMUY, 3764), rows(KAMUY));
    expect(fin.seasons).toEqual([{ id: 'av-3764', number: 1, label: '1 сезон', year: 2026, current: true }]);
    expect(ids(fin.similar)).toEqual(['av-2057', 'av-2156', 'av-2516', 'av-2868']);
  });

  test('«О моём перерождении в слизь»: «. Дневник…», фильмы и OVA — похожие, сезоны 1-4', () => {
    const r = classifyRelated(pick(SLIME, 3152), rows(SLIME));
    expect(r.seasons.map((s) => s.number)).toEqual([1, 2, 3, 4]);
    expect(ids(r.similar)).toEqual(['av-2605', 'av-2976', 'av-3096']);
  });

  test('«Реинкарнация безработного»: «Часть 2» — похожее, а не сезон', () => {
    const r = classifyRelated(pick(MUSHOKU, 3004), rows(MUSHOKU));
    expect(r.seasons.map((s) => [s.id, s.number])).toEqual([['av-2540', 1], ['av-3004', 2], ['av-3922', 3]]);
    expect(ids(r.similar)).toEqual(['av-2678']);
  });

  test('«Король шаманов (2021)»: ремейк с годом и «Цветы» — похожие; сезон один', () => {
    const r = classifyRelated(pick(SHAMAN, 166), rows(SHAMAN));
    expect(r.seasons.map((s) => s.id)).toEqual(['av-166']);
    expect(ids(r.similar)).toEqual(['av-2582', 'av-3122']);
    // у ремейка «голова» — «король шаманов 2021»: связь односторонняя (известное ограничение)
    const remake = classifyRelated(pick(SHAMAN, 2582), rows(SHAMAN));
    expect(remake.seasons.map((s) => s.id)).toEqual(['av-2582']);
    expect(remake.similar).toEqual([]);
  });

  test('«Когда плачут цикады»: дубль номера (2006/2020) уходит в «Похожие» вместе с обоими', () => {
    const r = classifyRelated(pick(HIGURASHI, 1271), rows(HIGURASHI));
    expect(r.seasons.map((s) => [s.id, s.number, s.current])).toEqual([['av-1271', 2, true]]);
    expect(ids(r.similar)).toEqual(['av-1270', 'av-1272', 'av-2494', 'av-2633']);
    // сам текущий в дубле: пропадает из сезонов и не попадает в «Похожие»
    const dup = classifyRelated(pick(HIGURASHI, 1270), rows(HIGURASHI));
    expect(dup.seasons.map((s) => s.id)).toEqual(['av-1271']);
    expect(ids(dup.similar)).not.toContain('av-1270');
    expect(ids(dup.similar)).toContain('av-2494');
  });

  test('чужие тайтлы по подстроке («Саки» ⊂ «Осаки») отбрасываются', () => {
    const cur = sum([1, '2009', 'ТВ', 'Саки / Saki [1-25 из 25]']);
    const rs = rows([
      [1, '2009', 'ТВ', 'Саки / Saki [1-25 из 25]'],
      [2, '2010', 'ТВ', 'Осака в тумане / Osaka [1 из 1]'],
      [3, '2012', 'ТВ', 'Сасаки и Пипи / Sasaki [1 из 1]'],
      [4, '2012', 'ТВ', 'Саки: Достижение / Saki: Achiga-hen [1-13 из 13]'],
    ]);
    const r = classifyRelated(cur, rs);
    expect(ids(r.similar)).toEqual(['av-4']);
  });

  test('текущего нет в выдаче — он всё равно в сезонах; фильм/OVA сам не сезон', () => {
    const cur = pick(PUBLIC, 3138);
    const r = classifyRelated(cur, rows(PUBLIC.filter((x) => x[0] !== 3138)));
    expect(r.seasons.map((s) => [s.id, s.current])).toEqual([['av-2729', false], ['av-3138', true], ['av-4066', false]]);
    const movie = classifyRelated(pick(NARUTO, 10), rows(NARUTO));
    expect(movie.seasons.map((s) => s.id)).toEqual(['av-7']);
    expect(ids(movie.similar)).not.toContain('av-10');
    const ova = classifyRelated(pick(NARUTO, 8), rows(NARUTO)); // «Наруто OVA-1»: своя база, связей нет
    expect(ova).toEqual({ seasons: [], similar: [] });
  });

  test('«Похожие» не больше 40', () => {
    const many = Array.from({ length: 60 }, (_, i) => sum([100 + i, '2010', 'OVA', `Блич OVA-${i} / Bleach OVA ${i} [1 из 1]`]));
    const cur = sum([1, '2004', 'ТВ', 'Блич / Bleach [1-366 из 366]']);
    expect(classifyRelated(cur, [cur, ...many]).similar).toHaveLength(MAX_SIMILAR);
  });
});

// --- провайдер: запросы, кэш, ошибки ---

const BASE = 'https://api.test/v1';
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const ok = (data: unknown[]) => json({ state: { status: 'ok', count: data.length }, data });

afterEach(() => vi.unstubAllGlobals());

/** Мок API: /info отдаёт тайтл из набора, /search — весь набор. */
function api(set: Row[]) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/info')) {
      const id = Number(new URLSearchParams(String(init?.body)).get('id'));
      return ok(set.filter((r) => r[0] === id).map(raw));
    }
    return ok(set.map(raw));
  });
  vi.stubGlobal('fetch', f);
  const searches = () => f.mock.calls.filter(([u]) => String(u).endsWith('/search'));
  return { f, searches };
}

describe('provider.related', () => {
  test('один поиск на франшизу: параллельные вызовы делят промис, переходы между сезонами — кэш', async () => {
    const { searches } = api(PUBLIC);
    const p = createAnimevostProvider([BASE]);
    const [a, b] = await Promise.all([p.related('av-3138'), p.related('av-2729')]);
    expect(a.seasons.map((s) => s.id)).toEqual(['av-2729', 'av-3138', 'av-4066']);
    expect(b.seasons.find((s) => s.current)?.id).toBe('av-2729');
    expect((await p.related('av-4066')).seasons.find((s) => s.current)?.id).toBe('av-4066');
    expect(searches()).toHaveLength(1);
    expect(new URLSearchParams(String(searches()[0][1]?.body)).get('name')).toBe('Пощади меня, великий господин!');
  });

  test('запрос — «голова»: у «Золотое божество: Финал» ищем по «Золотое божество»', async () => {
    const { searches } = api(KAMUY);
    const r = await createAnimevostProvider([BASE]).related('av-3764');
    expect(new URLSearchParams(String(searches()[0][1]?.body)).get('name')).toBe('Золотое божество');
    expect(r.similar).toHaveLength(4);
  });

  test('короткая «голова» (< 4) — запрос по базе', async () => {
    const set: Row[] = [
      [1, '2010', 'ТВ', 'Ван: Кусок / One piece [1-12 из 12]'],
      [2, '2011', 'ТВ', 'Ван: Кусок (второй сезон) / One piece 2 [1-12 из 12]'],
    ];
    const { searches } = api(set);
    const r = await createAnimevostProvider([BASE]).related('av-1');
    expect(new URLSearchParams(String(searches()[0][1]?.body)).get('name')).toBe('Ван: Кусок');
    expect(r.seasons).toHaveLength(2);
  });

  test('текущего нет в выдаче поиска — всё равно в сезонах', async () => {
    const f = vi.fn((url: string) =>
      url.endsWith('/info') ? ok([raw(PUBLIC[0])]) : ok([raw(PUBLIC[1]), raw(PUBLIC[2])]),
    );
    vi.stubGlobal('fetch', f);
    const r = await createAnimevostProvider([BASE]).related('av-3138');
    expect(r.seasons.map((s) => [s.id, s.current])).toEqual([['av-2729', false], ['av-3138', true], ['av-4066', false]]);
  });

  test('«ничего не найдено» (404 без CORS = TypeError) и сбои — пусто, без исключения', async () => {
    const f = vi.fn((url: string) => (url.endsWith('/info') ? ok([raw(PUBLIC[1])]) : Promise.reject(new TypeError('Failed to fetch'))));
    vi.stubGlobal('fetch', f);
    const p = createAnimevostProvider([BASE]);
    await expect(p.related('av-2729')).resolves.toEqual({ seasons: [], similar: [] });
    vi.stubGlobal('fetch', vi.fn(() => json({}, 500)));
    await expect(createAnimevostProvider([BASE]).related('av-5')).resolves.toEqual({ seasons: [], similar: [] });
    await expect(createAnimevostProvider([BASE]).related('xx-1')).resolves.toEqual({ seasons: [], similar: [] });
  });

  test('отмена пробрасывается как AbortError, а не превращается в пустой ответ', async () => {
    api(PUBLIC);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(createAnimevostProvider([BASE]).related('av-2729', ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
