import { readLocal, subscribeLocal, writeLocal } from '../lib/storage';
import { report } from '../lib/report';
import { syncConfig } from './config';
import { classifyError, type ErrorKind } from './errors';
import { mergeData, sameData } from './merge';
import { canSyncOnVisible, createDebouncer, PUSH_DEBOUNCE_MS, retryDelay, RETRY_MAX_ATTEMPTS } from './schedule';
import type { CloudUser, Remote } from './firebase';

/**
 * Управление синхронизацией (ADR-28): состояние для экрана `/sync`, подписка на локальные хранилища, расписание.
 * Сам этот модуль не содержит Firebase: SDK и GIS подгружаются `import('./firebase')` только после действия пользователя
 * или при уже выполненном входе (флаг в localStorage).
 */

export const FLAG_KEY = 'anyview:sync';

export interface SyncState {
  available: boolean;
  /** Идёт загрузка кода синхронизации (чанк и скрипт Google). */
  loading: boolean;
  /** Состояние входа известно (Firebase восстановил сессию или подтвердил её отсутствие). */
  known: boolean;
  user: CloudUser | null;
  syncing: boolean;
  lastSync: number | null;
  error: ErrorKind | null;
}

let state: SyncState = { available: syncConfig() !== null, loading: false, known: false, user: null, syncing: false, lastSync: null, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};
export const getSyncState = (): SyncState => state;
export const subscribeSyncState = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const flag = {
  get: () => {
    try {
      return localStorage.getItem(FLAG_KEY) === '1';
    } catch {
      return false;
    }
  },
  set: (on: boolean) => {
    try {
      if (on) localStorage.setItem(FLAG_KEY, '1');
      else localStorage.removeItem(FLAG_KEY);
    } catch {
      /* недоступен */
    }
  },
};

let remote: Remote | undefined;
let connecting: Promise<Remote> | undefined;
let applying = false;
let running: Promise<void> | undefined;
let attempt = 0;
let lastAttempt: number | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let unsubLocal: (() => void) | undefined;
let listening = false;

const push = createDebouncer(() => void syncNow(), PUSH_DEBOUNCE_MS);

function fail(e: unknown) {
  const kind = classifyError(e);
  // Только код ошибки: в объектах Firebase бывают адреса и данные учётной записи.
  report(new Error(`${kind}:${(e as { code?: string } | null)?.code ?? (e as Error | null)?.name ?? 'error'}`), 'sync');
  set({ syncing: false, error: kind });
  if (kind === 'network' && attempt < RETRY_MAX_ATTEMPTS) {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void syncNow(), retryDelay(attempt++));
  }
}

function onUser(user: CloudUser | null) {
  set({ user, known: true });
  if (user) {
    flag.set(true);
    unsubLocal ??= subscribeLocal(() => {
      if (!applying) push.call();
    });
    void syncNow();
  } else {
    flag.set(false);
    unsubLocal?.();
    unsubLocal = undefined;
    push.cancel();
    clearTimeout(retryTimer);
    set({ syncing: false, error: null, lastSync: null });
  }
}

function listen() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') push.flush(); // best-effort: запрос может не успеть
    else if (state.user && canSyncOnVisible(lastAttempt, Date.now())) void syncNow();
  });
  window.addEventListener('pagehide', () => push.flush());
  window.addEventListener('online', () => state.user && void syncNow());
}

/** Загружает код синхронизации и подключается к Firebase (один раз). */
export function connect(): Promise<Remote> {
  const cfg = syncConfig();
  if (!cfg) return Promise.reject(new Error('sync is not configured'));
  if (remote) return Promise.resolve(remote);
  if (!connecting) {
    set({ loading: true });
    connecting = import('./firebase')
      .then(({ createRemote }) => {
        listen();
        remote = createRemote(cfg, { onUser, onError: fail });
        set({ loading: false });
        return remote;
      })
      .catch((e) => {
        connecting = undefined;
        set({ loading: false });
        fail(e);
        throw e;
      });
  }
  return connecting;
}

/** Старт приложения: если вход выполнялся, поднимаем синхронизацию в фоне. */
export function start(): void {
  if (state.available && flag.get()) void connect().catch(() => {});
}

/** Кнопка Google в контейнере (после действия пользователя «Включить синхронизацию»). */
export async function renderSignIn(el: HTMLElement): Promise<void> {
  try {
    set({ error: null });
    await (await connect()).renderButton(el);
  } catch (e) {
    fail(e);
  }
}

/** Один проход: облако → слияние с локальным → запись в облако → применение к локальным хранилищам. */
export function syncNow(): Promise<void> {
  if (!remote || !state.user) return Promise.resolve();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(); // вернёмся по событию online
  if (running) return running;
  push.cancel();
  clearTimeout(retryTimer);
  lastAttempt = Date.now();
  set({ syncing: true, error: null });
  running = (async () => {
    try {
      const { local, merged } = await remote!.sync(readLocal);
      // Пользователь мог смотреть видео, пока шёл запрос: сливаем с актуальным локальным, а не затираем.
      const cur = readLocal();
      const next = mergeData(cur, merged);
      if (!sameData(cur, next)) {
        applying = true;
        try {
          writeLocal(next);
        } finally {
          applying = false;
        }
      }
      attempt = 0;
      set({ syncing: false, lastSync: Date.now() });
      if (!sameData(cur, local)) push.call(); // локальное изменилось во время обмена — отправим
    } catch (e) {
      fail(e);
    } finally {
      running = undefined;
    }
  })();
  return running;
}

export async function signOut(): Promise<void> {
  try {
    await remote?.signOut();
  } catch (e) {
    fail(e);
  }
}

/** Удаляет облачный документ и выходит: иначе следующая синхронизация сразу вернула бы данные в облако. Локальные данные остаются. */
export async function deleteCloudData(): Promise<boolean> {
  if (!remote) return false;
  push.cancel();
  clearTimeout(retryTimer);
  set({ syncing: true, error: null });
  try {
    await remote.deleteCloud();
    set({ syncing: false });
    await signOut();
    return true;
  } catch (e) {
    fail(e);
    return false;
  }
}

/** «Повторить» и «Синхронизировать сейчас» из интерфейса: сбрасывает счётчик повторов. */
export function retry(): Promise<void> {
  attempt = 0;
  return syncNow();
}
