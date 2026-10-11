import { describe, expect, it } from 'vitest';
import { RESUME_TTL_MS, resumeTarget } from './resume';

const raw = (path: unknown, ts: unknown) => JSON.stringify({ path, ts });

describe('resumeTarget', () => {
  it('возвращает свежий тайтл', () => expect(resumeTarget(raw('/title/av-1', 1000), 2000)).toBe('/title/av-1'));
  it('просроченный и из будущего — нет', () => {
    expect(resumeTarget(raw('/title/av-1', 0), RESUME_TTL_MS)).toBeNull();
    expect(resumeTarget(raw('/title/av-1', 5000), 1000)).toBeNull();
  });
  it('чужие пути и мусор — нет', () => {
    for (const r of [raw('/sync', 1), raw('//evil.com', 1), raw('/title/../x', 1), raw(1, 1), raw('/title/a', 'x'), '{', 'null', null, '"s"']) {
      expect(resumeTarget(r, 2)).toBeNull();
    }
  });
});
