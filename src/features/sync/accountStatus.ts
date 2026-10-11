/** Краткий статус синхронизации для строки под заголовком «Аккаунта» (без обращения к сети; данные уже в состоянии движка). */
export interface StatusInput {
  available: boolean;
  signedIn: boolean;
  loading: boolean;
  /** Вход уже выполнялся на этом устройстве, состояние ещё проверяется. */
  checking: boolean;
  syncing: boolean;
  error: boolean;
  lastSync?: number | null;
}

export type RowKind = 'off' | 'checking' | 'syncing' | 'error' | 'ok' | 'signed';

/** null — синхронизация недоступна (нет конфигурации): строки нет. */
export function rowKind(s: StatusInput): RowKind | null {
  if (!s.available) return null;
  if (s.signedIn) return s.syncing ? 'syncing' : s.error ? 'error' : s.lastSync ? 'ok' : 'signed';
  return s.loading || s.checking ? 'checking' : 'off';
}
