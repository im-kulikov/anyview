/** Адреса animevost: общие для адаптера и для vite.config.ts (preload в index.html), чтобы не расходились. */

export const DEFAULT_BASES = 'https://api.animetop.info/v1,https://api.animevost.org/v1';
/** Хост постеров: нужен для preconnect. */
export const IMAGE_ORIGIN = 'https://static.openni.ru';
/** Больше API не отдаёт. */
export const MAX_PAGE = 40;

/** Список баз из `VITE_ANIMEVOST_BASES` (через запятую) или значения по умолчанию. */
export const parseBases = (raw: string | undefined): string[] =>
  (raw || DEFAULT_BASES)
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/** Путь страницы ленты (то, что уходит в `fetch` после базы). */
export const lastPath = (page: number, pageSize: number): string => `/last?page=${page}&quantity=${Math.min(pageSize, MAX_PAGE)}`;

/**
 * Зеркало постеров (ротируется, актуальный адрес — в баннере на animevost.org). static.openni.ru отдаёт просроченный сертификат,
 * поэтому обложки идут через wsrv.nl (уменьшение до 480 px, webp) и запасные источники.
 * Сертификат v14.vost.pw истекает 26.10.2026 в 11:13 UTC — до этого момента зеркало нужно заменить.
 */
export const IMAGE_MIRROR = 'https://v14.vost.pw';
const IMAGE_ORIGINS = ['static.openni.ru', 'animevost.org'];

/**
 * Кандидаты адреса обложки по порядку предпочтения: wsrv.nl (с запасным источником в `default`), зеркало, оригинал.
 * ФОРМАТ ПЕРВОГО АДРЕСА ЗАФИКСИРОВАН: он же ключ HTTP-кеша браузера, любое изменение (параметры, порядок, кодирование)
 * сбрасывает кеш обложек у всех пользователей. Чужие хосты, пути не из `/uploads/` и нечитаемый ввод возвращаются как есть.
 */
export function imageUrls(url: string): string[] {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (!/^https?:$/.test(u.protocol) || !u.pathname.startsWith('/uploads/')) return [url];
    if (!IMAGE_ORIGINS.includes(host) && host !== 'vost.pw' && !host.endsWith('.vost.pw')) return [url];
    const path = u.pathname + u.search;
    const wsrv = (src: string) => `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=480&we&output=webp&q=75`;
    return [
      `${wsrv('https://animevost.org' + path)}&default=${encodeURIComponent(wsrv('http://static.openni.ru' + path))}`,
      IMAGE_MIRROR + path,
      'https://animevost.org' + path,
    ];
  } catch {
    return [url];
  }
}
