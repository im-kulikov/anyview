import { describe, expect, it } from 'vitest';
import { needsReload } from './update';

describe('needsReload', () => {
  it('новая версия — да', () => expect(needsReload('aaaaaaa', 'bbbbbbb', null)).toBe(true));
  it('та же, локальная сборка, повтор для той же версии — нет', () => {
    expect(needsReload('aaaaaaa', 'aaaaaaa', null)).toBe(false);
    expect(needsReload('aaaaaaa', 'dev', null)).toBe(false); // локальная сборка на сервере: версии нет
    expect(needsReload('aaaaaaa', 'bbbbbbb', 'bbbbbbb')).toBe(false);
  });
  it('мусор вместо версии — нет', () => {
    for (const r of [undefined, null, 1, '', 'zzzzzzz', 'bbbbbbbb', {}]) expect(needsReload('aaaaaaa', r, null)).toBe(false);
  });
});
