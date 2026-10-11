/** Чистая логика service worker'а (ADR-39): без `self` и `caches`, чтобы проверять юнит-тестами. */
export type Strategy = 'shell' | 'asset' | 'pass';

export interface Req { url: string; method: string; mode: string; range: boolean }

/** Что делать с запросом. Всё, кроме навигации и собственных хешированных ассетов, идёт мимо SW: API, версия, видео (Range), чужие домены, POST. */
export function pickStrategy(r: Req, origin: string, base: string): Strategy {
  if (r.method !== 'GET' || r.range) return 'pass';
  const u = new URL(r.url);
  if (u.origin !== origin || !u.pathname.startsWith(base)) return 'pass';
  if (r.mode === 'navigate') return 'shell';
  return u.pathname.startsWith(`${base}assets/`) ? 'asset' : 'pass';
}

/** В кеш кладём только полноценные ответы своего origin: не 404/5xx, не 206, не opaque. */
export const cacheable = (status: number, type: string): boolean => status === 200 && type === 'basic';

/** Кеши прежних версий (имя `anyview-<версия>`); чужие кеши не трогаем. */
export const staleCaches = (names: string[], current: string): string[] => names.filter((n) => n.startsWith('anyview-') && n !== current);
