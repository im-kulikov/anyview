import { describe, expect, test } from 'vitest';
import { franchiseOf } from './related';

const tv = (name: string, format: 'tv' | 'ona' | 'movie' | 'ova' = 'tv') => ({ name, format });

describe('franchiseOf: франшиза по карточке без сети', () => {
  test('сезоны одной франшизы дают один ключ и номера', () => {
    const a = franchiseOf(tv('Пощади меня, великий господин!'));
    const b = franchiseOf(tv('Пощади меня, великий господин! (второй сезон)'));
    const c = franchiseOf(tv('Пощади меня, великий господин! (третий сезон)'));
    expect(a?.key).toBe(b?.key);
    expect(b?.key).toBe(c?.key);
    expect([a?.season, b?.season, c?.season]).toEqual([1, 2, 3]);
  });
  test('«2 сезон» цифрами и ё/регистр/пунктуация в ключе не мешают', () => {
    expect(franchiseOf(tv('Ёжик: Тест (2 сезон)'))).toEqual({ key: franchiseOf(tv('ежик тест'))!.key, season: 2 });
  });
  test('ONA считается, фильм/OVA и маркеры фильма и спэшла — нет', () => {
    expect(franchiseOf(tv('Тест', 'ona'))).toBeDefined();
    expect(franchiseOf(tv('Тест', 'movie'))).toBeUndefined();
    expect(franchiseOf(tv('Тест', 'ova'))).toBeUndefined();
    expect(franchiseOf(tv('Тест (фильм первый)'))).toBeUndefined();
    expect(franchiseOf(tv('Тест (спэшл 2)'))).toBeUndefined();
  });
  test('пустое название — нет франшизы', () => {
    expect(franchiseOf(tv(''))).toBeUndefined();
    expect(franchiseOf(tv('(второй сезон)'))).toBeUndefined();
  });
  test('разные названия — разные ключи (Наруто/Боруто не склеиваются)', () => {
    expect(franchiseOf(tv('Наруто'))?.key).not.toBe(franchiseOf(tv('Боруто'))?.key);
  });
});
