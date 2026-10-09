export type ErrorKind = 'network' | 'denied' | 'quota' | 'schema' | 'auth' | 'unknown';

/** Облако записано более новой версией приложения: перезаписывать нельзя. */
export class SchemaError extends Error {
  override name = 'SchemaError';
}

/** Только `network` повторяется автоматически; остальное требует действия пользователя. Без токенов и адресов в тексте. */
export function classifyError(e: unknown): ErrorKind {
  if (e instanceof SchemaError) return 'schema';
  const code = typeof (e as { code?: unknown } | null)?.code === 'string' ? (e as { code: string }).code : '';
  if (/unavailable|deadline-exceeded|network-request-failed|timeout|cancelled/.test(code)) return 'network';
  if (code.includes('permission-denied')) return 'denied';
  if (code.includes('resource-exhausted') || code.includes('quota')) return 'quota';
  if (code.includes('unauthenticated') || code.startsWith('auth/')) return 'auth';
  if (e instanceof TypeError) return 'network'; // fetch без соединения
  return 'unknown';
}
