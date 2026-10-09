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
