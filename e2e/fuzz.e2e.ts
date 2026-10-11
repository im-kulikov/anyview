import { expect, test } from '@playwright/test';
import fc from 'fast-check';
import { mockApi } from './mockApi';
import { EVIL, KEYS, mutateLeaf, VALID } from '../src/test/samples';

/**
 * Фаззинг экранов (ADR-35): случайные порчи данных пользователя в localStorage (случайное поле → случайное значение или удаление,
 * целиком мусорная строка), враждебные элементы в ленте API, телефон/десктоп; на каждом сценарии обходятся ключевые экраны.
 * Критерий — ни ошибки страницы, ни экрана «Что-то пошло не так». При падении fast-check сжимает сценарий до минимального и печатает
 * сид: `FUZZ_SEED=<сид> FUZZ_RUNS=<n> npm run e2e -- fuzz`. В PR — коротко (FUZZ_RUNS=4), ночью — глубоко.
 */
const RUNS = Number(process.env.FUZZ_RUNS ?? 4);
// В PR сид фиксирован (CI воспроизводим); ночной прогон задаёт случайный FUZZ_SEED. Сид общий для процессов: он не должен меняться между воркерами.
const SEED = Number(process.env.FUZZ_SEED ?? 20261011);
const ROUTES = ['/', '/anime', '/sync?tab=favorites', '/sync?tab=watching', '/title/av-4000', '/search?q=%D1%82%D0%BE%D0%BA%D0%B8%D0%B9'];

const junk = fc.oneof(fc.constant(undefined), fc.constant(null), fc.jsonValue(), fc.string(), fc.integer());
const hostileItem = fc.record({ id: fc.oneof(fc.integer(), fc.string()), title: fc.string(), description: junk, genre: junk, year: junk, type: junk, director: junk, urlImagePreview: junk, screenImage: junk, rating: junk, votes: junk });
// целенаправленная порча: лист номер `leaf` (по модулю) → «злое» значение (EVIL) или произвольный JSON, либо удаление
const mutation = fc.record({ key: fc.constantFrom(...KEYS), leaf: fc.noBias(fc.nat(10_000)), repl: fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...EVIL) }, { weight: 1, arbitrary: fc.jsonValue() }), del: fc.boolean() });
const scenario = fc.record({
  mutations: fc.array(mutation, { minLength: 2, maxLength: 8 }),
  rawKey: fc.option(fc.record({ key: fc.constantFrom(...KEYS), raw: fc.string() }), { nil: null }),
  feedJunk: fc.array(hostileItem, { maxLength: 3 }),
  phone: fc.boolean(),
});

test('фаззинг экранов: случайные порчи данных и ленты', async ({ browser }, info) => {
  test.setTimeout(RUNS * 30_000 + 60_000);
  console.log(`fuzz: runs=${RUNS} seed=${SEED}`);
  await fc.assert(
    fc.asyncProperty(scenario, async (sc) => {
      const store: Record<string, string> = {};
      for (const k of KEYS) store[`anyview:v1:${k}`] = JSON.stringify(VALID[k]);
      store['anyview:schema'] = '2';
      for (const m of sc.mutations) store[`anyview:v1:${m.key}`] = JSON.stringify(mutateLeaf(JSON.parse(store[`anyview:v1:${m.key}`]), m.leaf, m.repl, m.del));
      if (sc.rawKey) store[`anyview:v1:${sc.rawKey.key}`] = sc.rawKey.raw;

      const ctx = await browser.newContext({ viewport: sc.phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: sc.phone, hasTouch: sc.phone });
      try {
        const page = await ctx.newPage();
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
        await mockApi(page, { extraItems: sc.feedJunk });
        await page.addInitScript((s) => { if (!sessionStorage.getItem('f')) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem('f', '1'); } }, store);
        for (const path of ROUTES) {
          await page.goto(`/anyview${path}`);
          await expect(page.locator('main')).toBeVisible();
          await page.waitForLoadState('networkidle');
          expect(await page.getByText('Что-то пошло не так').count(), `экран ошибки на ${path}`).toBe(0);
        }
        expect(errors).toEqual([]);
      } catch (e) {
        await info.attach('scenario.json', { body: JSON.stringify(sc, null, 1), contentType: 'application/json' });
        throw e;
      } finally {
        await ctx.close();
      }
    }),
    // сжатие примера в браузере дорого (≈5 с на шаг, десятки минут): по умолчанию стоп на первом падении, сценарий прикладывается;
    // FUZZ_SHRINK=1 — сжать локально. Минимальные примеры дают unit-свойства (src/**/*.fuzz.test.ts).
    { numRuns: RUNS, seed: SEED, endOnFailure: !process.env.FUZZ_SHRINK },
  );
});
