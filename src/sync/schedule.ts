/** Расписание синхронизации (ADR-27): чистые правила и дебаунс с подменяемыми таймерами — тестируются без DOM. */

export const PUSH_DEBOUNCE_MS = 5_000;
/** Во время непрерывного просмотра позиция пишется каждые ~5 с и сдвигала бы дебаунс бесконечно: отправка не позже чем через это время. */
export const PUSH_MAX_WAIT_MS = 30_000;
/** Возврат на вкладку запускает синхронизацию не чаще этого. */
export const VISIBLE_MIN_MS = 60_000;
export const RETRY_BASE_MS = 5_000;
export const RETRY_MAX_MS = 300_000;
/** После стольких подряд неудач повтор прекращается до действия пользователя («Повторить») или возврата на вкладку. */
export const RETRY_MAX_ATTEMPTS = 6;

/** Задержка перед повтором после `attempt`-й неудачи подряд (0 — первая): 5, 10, 20, … с, не больше 5 мин. */
export const retryDelay = (attempt: number): number => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt);

export const canSyncOnVisible = (lastAttempt: number | null, now: number): boolean => lastAttempt === null || now - lastAttempt >= VISIBLE_MIN_MS;

export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

/** Откладывает `fn` на `ms` после последнего `call()`, но не дольше `maxMs` с первого; `flush()` выполняет сразу, если вызов ожидается. */
export function createDebouncer(fn: () => void, ms: number, timers: Timers = realTimers, maxMs = Infinity, now: () => number = Date.now) {
  let id: unknown;
  let waiting = false;
  let firstAt = 0;
  const cancel = () => {
    if (waiting) timers.clear(id);
    waiting = false;
  };
  return {
    call() {
      if (!waiting) firstAt = now();
      const delay = Math.min(ms, Math.max(0, firstAt + maxMs - now()));
      cancel();
      waiting = true;
      id = timers.set(() => {
        waiting = false;
        fn();
      }, delay);
    },
    flush() {
      if (!waiting) return;
      cancel();
      fn();
    },
    cancel,
    get pending() {
      return waiting;
    },
  };
}
