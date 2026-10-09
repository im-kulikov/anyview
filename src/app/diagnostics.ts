import { report } from '../lib/report';

const RELOADED = 'anyview:chunk-reload';

/** Глобальные ловушки: необработанные ошибки и устаревший чанк после деплоя (ARCH-17). Вызывается один раз из main.tsx. */
export function installDiagnostics(): void {
  window.addEventListener('unhandledrejection', (e) => report(e.reason, 'unhandledrejection'));
  window.addEventListener('error', (e) => report(e.error ?? e.message, 'window'));
  // После нового деплоя хэшированные чанки старой версии исчезают: один раз перезагружаем страницу, чтобы взять свежий index.html.
  window.addEventListener('vite:preloadError', (e) => {
    report((e as Event & { payload?: unknown }).payload, 'chunk');
    try {
      const last = Number(sessionStorage.getItem(RELOADED) ?? 0);
      if (Date.now() - last < 60_000) return;
      sessionStorage.setItem(RELOADED, String(Date.now()));
    } catch {
      return; // без sessionStorage перезагрузка могла бы зациклиться
    }
    e.preventDefault();
    location.reload();
  });
}
