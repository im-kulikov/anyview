/** Установленное приложение iOS выгружается из памяти и при запуске открывает главную; последний открытый тайтл помним на 30 минут. */
export const RESUME_KEY = 'anyview:last';
export const RESUME_TTL_MS = 30 * 60_000;

export function resumeTarget(raw: string | null, now: number): string | null {
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (typeof v !== 'object' || v === null) return null;
    const { path, ts } = v as { path?: unknown; ts?: unknown };
    if (typeof path !== 'string' || typeof ts !== 'number') return null;
    return /^\/title\/[\w-]+$/.test(path) && now - ts >= 0 && now - ts < RESUME_TTL_MS ? path : null;
  } catch {
    return null;
  }
}

export function rememberPath(pathname: string, now = Date.now()): void {
  try {
    if (/^\/title\//.test(pathname)) localStorage.setItem(RESUME_KEY, JSON.stringify({ path: pathname, ts: now }));
    else localStorage.removeItem(RESUME_KEY);
  } catch { /* хранилище недоступно — без восстановления */ }
}

/** Один раз за запуск приложения (sessionStorage очищается вместе с процессом); true — стоит перейти на последний тайтл. */
export function coldStartTarget(pathname: string, now = Date.now()): string | null {
  try {
    if (sessionStorage.getItem('anyview:booted')) return null;
    sessionStorage.setItem('anyview:booted', '1');
    return pathname === '/' ? resumeTarget(localStorage.getItem(RESUME_KEY), now) : null;
  } catch {
    return null;
  }
}
