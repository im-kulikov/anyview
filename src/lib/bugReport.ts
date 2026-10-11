import { recentErrors } from './report';

/** Версия сборки: в CI — sha коммита (VITE_BUILD_SHA), локально — «dev». По ней можно собрать ту же версию и расшифровать стек. */
export const BUILD_SHA: string = (import.meta.env.VITE_BUILD_SHA as string | undefined)?.slice(0, 7) || 'dev';

const KEY_PREFIX = 'anyview:';
const PER_KEY = 4000;
const TOTAL_DATA = 20_000;
const lines = (s: string | undefined, n: number) => (s ?? '').split('\n').slice(0, n).join('\n');

/** Форма значения без содержимого: достаточно, чтобы понять, какие данные у пользователя (массив из N, объект с ключами, не JSON). */
function shape(raw: string): string {
  try {
    const v: unknown = JSON.parse(raw);
    if (Array.isArray(v)) return `массив[${v.length}]`;
    if (v === null) return 'null';
    if (typeof v === 'object') return `объект{${Object.keys(v).length}}`;
    return typeof v;
  } catch {
    return 'НЕ JSON';
  }
}

function storageKeys(): [string, string][] {
  try {
    return Object.keys(localStorage).filter((k) => k.startsWith(KEY_PREFIX)).sort().map((k) => [k, localStorage.getItem(k) ?? ''] as [string, string]);
  } catch {
    return [];
  }
}

/** Секция отчёта; сбор одной секции не должен ронять сам отчёт. */
const section = (title: string, f: () => string): string => {
  try {
    return `${title}\n${f()}`;
  } catch (e) {
    return `${title}\n(не удалось собрать: ${e instanceof Error ? e.message : String(e)})`;
  }
};

/**
 * Текст отчёта о проблеме для копирования в чат: версия, страница, браузер, ошибка, последние ошибки вкладки, форма данных в localStorage.
 * Без `includeData` содержимое хранилища не попадает в отчёт (только размеры и формы); токенов и паролей в `anyview:*` нет.
 */
export function buildBugReport(opts: { error?: unknown; includeData?: boolean; now?: Date } = {}): string {
  const now = opts.now ?? new Date();
  const out: string[] = [`anyview: отчёт о проблеме`, `Версия: ${BUILD_SHA}`, `Время: ${now.toISOString()}`];
  out.push(section('Страница:', () => `${location.pathname}${location.search}${location.hash}`));
  out.push(section('Окружение:', () => {
    const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
    return [
      `UA: ${nav.userAgent}`,
      `Экран: ${innerWidth}×${innerHeight} @${devicePixelRatio}x, язык ${nav.language}, онлайн: ${nav.onLine ? 'да' : 'нет'}${nav.connection?.effectiveType ? `, сеть ${nav.connection.effectiveType}` : ''}`,
    ].join('\n');
  }));
  if (opts.error !== undefined) {
    const e = opts.error;
    out.push(section('Ошибка:', () => (e instanceof Error ? `${e.name}: ${e.message}\n${lines(e.stack, 12)}` : String(e))));
  }
  const recent = recentErrors();
  out.push(section(`Последние ошибки вкладки (${recent.length}):`, () =>
    recent.length ? recent.slice(-10).map((r) => `[${new Date(r.at).toISOString().slice(11, 19)}] ${r.context}: ${r.text}${r.stack ? `\n${lines(r.stack, 5)}` : ''}`).join('\n') : 'нет'));
  const keys = storageKeys();
  out.push(section('Хранилище:', () => (keys.length ? keys.map(([k, v]) => `${k}: ${(v.length / 1024).toFixed(1)} КБ, ${shape(v)}`).join('\n') : 'пусто или недоступно')));
  if (opts.includeData) {
    out.push(section('Данные хранилища:', () => {
      let left = TOTAL_DATA;
      return keys.filter(([k]) => k !== 'anyview:v1:feed').map(([k, v]) => {
        const cut = v.slice(0, Math.min(PER_KEY, left));
        left -= cut.length;
        return `${k}: ${cut}${cut.length < v.length ? ' …(обрезано)' : ''}`;
      }).join('\n');
    }));
  }
  return out.join('\n\n');
}
