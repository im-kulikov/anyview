import { BUILD_SHA } from './bugReport';
import { resetSwCache } from './sw';

/** Обновление установленного приложения: iOS держит его в памяти днями и не перезагружает страницу, поэтому версию сверяем сами при возврате на экран. */
const GUARD_KEY = 'anyview:reloaded';
const MIN_GAP_MS = 60_000;

/** Перезагружать ли страницу ради `remote`: версии известны и различаются, и на эту версию уже не перезагружались (иначе кеш CDN даст цикл). */
export function needsReload(local: string, remote: unknown, guard: string | null): remote is string {
  return typeof remote === 'string' && /^[0-9a-f]{7}$/.test(remote) && remote !== local && remote !== guard;
}

let available = false;
const listeners = new Set<() => void>();
export const updateAvailable = (): boolean => available;
export const subscribeUpdate = (cb: () => void): (() => void) => (listeners.add(cb), () => void listeners.delete(cb));

export function reloadOnce(mark: string): void {
  try {
    if (sessionStorage.getItem(GUARD_KEY) === mark) return;
    sessionStorage.setItem(GUARD_KEY, mark);
  } catch { /* без защиты от цикла не перезагружаем */ return; }
  location.reload();
}

const playing = (): boolean => [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended);

async function check(): Promise<void> {
  if (document.visibilityState !== 'visible' || navigator.onLine === false || available) return;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    const { sha } = (await res.json()) as { sha?: unknown };
    let guard: string | null = null;
    try { guard = sessionStorage.getItem(GUARD_KEY); } catch { /* нет хранилища */ }
    if (!needsReload(BUILD_SHA, sha, guard)) return;
    if (playing()) { available = true; listeners.forEach((l) => l()); } // не обрываем просмотр: плашка «Обновить»
    else reloadOnce(sha);
  } catch { /* нет сети или нет файла — проверим при следующем возврате */ }
}

/** Проверка при запуске и при каждом возврате в приложение (не чаще раза в минуту). */
export function watchUpdates(): void {
  let last = 0;
  const run = () => {
    if (Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    void check();
  };
  document.addEventListener('visibilitychange', run);
  window.addEventListener('pageshow', run);
  run();
  // Чанк удалён новым деплоем, а страница старая: единственное лечение — перезагрузка.
  // Кеш сбрасываем тоже: иначе воркер вернёт тот же старый index.html.
  window.addEventListener('vite:preloadError', () => void resetSwCache().then(() => reloadOnce('chunk')));
}
