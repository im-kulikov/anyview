/**
 * Единая точка отчётов об ошибках. Сейчас — `console.error` с дедупом (не больше одного отчёта на тип ошибки и контекст);
 * приёмник (sendBeacon на свой endpoint) подключается здесь же, когда он появится (ADR-16).
 */
const seen = new Set<string>();
const MAX_REPORTS = 50;

/** Последние отчёты в памяти вкладки: попадают в «Скопировать отчёт» (lib/bugReport.ts), чтобы консоль была не нужна. */
export interface RecentError { at: number; context: string; text: string; stack?: string }
const recent: RecentError[] = [];
const MAX_RECENT = 30;
export const recentErrors = (): readonly RecentError[] => recent;

export function report(err: unknown, context: string): void {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const key = `${context}|${text}`;
  if (seen.has(key) || seen.size >= MAX_REPORTS) return;
  seen.add(key);
  recent.push({ at: Date.now(), context, text, ...(err instanceof Error && err.stack && { stack: err.stack }) });
  if (recent.length > MAX_RECENT) recent.shift();
  console.error(`[anyview:${context}]`, err);
}

/** Для тестов. */
export const resetReports = () => {
  seen.clear();
  recent.length = 0;
};
