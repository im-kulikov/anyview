/**
 * Единая точка отчётов об ошибках. Сейчас — `console.error` с дедупом (не больше одного отчёта на тип ошибки и контекст);
 * приёмник (sendBeacon на свой endpoint) подключается здесь же, когда он появится (ADR-16).
 */
const seen = new Set<string>();
const MAX_REPORTS = 50;

export function report(err: unknown, context: string): void {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const key = `${context}|${text}`;
  if (seen.has(key) || seen.size >= MAX_REPORTS) return;
  seen.add(key);
  console.error(`[anyview:${context}]`, err);
}

/** Для тестов. */
export const resetReports = () => seen.clear();
