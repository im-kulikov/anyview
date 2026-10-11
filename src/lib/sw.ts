/** Service worker оболочки (ADR-39): регистрация и аварийный сброс. Без поддержки или при `VITE_SW=off` приложение работает как прежде. */
const BASE = import.meta.env.BASE_URL;

export function registerSw(): void {
  if (!import.meta.env.PROD || import.meta.env.VITE_SW === 'off' || !('serviceWorker' in navigator)) return;
  // после load: регистрация не конкурирует со стартом ленты
  window.addEventListener('load', () => void navigator.serviceWorker.register(`${BASE}sw.js`, { scope: BASE, updateViaCache: 'none' }).catch(() => {}));
}

/** Снять воркер и стереть его кеши: «Сбросить кеш» в диагностике и лечение пропавшего чанка. */
export async function resetSwCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch { /* нечего сбрасывать */ }
}
