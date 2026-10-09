/**
 * Внешний URL → абсолютный https. `http:` поднимается до `https:` (иначе GitHub Pages блокирует смешанный контент),
 * относительные и protocol-relative адреса разрешаются от `base`. Любая другая схема (`javascript:`, `data:`, …) или
 * нечитаемый адрес — `undefined`: поля в данных не будет. Список хостов не ограничиваем (CDN меняются), охрана хостов — CSP.
 */
export function https(url: string, base?: string): string | undefined {
  try {
    const u = new URL(url.trim(), base);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
