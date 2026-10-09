import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signInWithCredential, signOut as fbSignOut } from 'firebase/auth';
import { deleteDoc, doc, getFirestore, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore/lite';
import type { LocalData } from '../lib/storage';
import { parseLocalData } from '../lib/storage';
import type { SyncConfig } from './config';
import { classifyError, SchemaError } from './errors';
import { EMPTY, fitForCloud, mergeData, serialize } from './merge';

/**
 * Единственное место, где живут Firebase SDK и Google Identity Services (ADR-28). Грузится динамическим import только после
 * действия пользователя или при уже выполненном входе. Только `firebase/app`, `firebase/auth` и `firebase/firestore/lite` (REST, без realtime и офлайн-кэша).
 * ID-токены нигде не сохраняются и не логируются: токен живёт в замыкании callback до вызова `signInWithCredential`.
 */

const SCHEMA = 1;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export interface CloudUser { name: string | null; email: string | null }
export interface Hooks {
  onUser(u: CloudUser | null): void;
  onError(e: unknown): void;
}
export interface SyncResult {
  /** Локальное состояние, которое читалось в транзакции. */
  local: LocalData;
  merged: LocalData;
}
export interface Remote {
  renderButton(el: HTMLElement): Promise<void>;
  /** Чтение облака → слияние → запись, одной транзакцией. */
  sync(readLocal: () => LocalData): Promise<SyncResult>;
  deleteCloud(): Promise<void>;
  signOut(): Promise<void>;
}

let gisPromise: Promise<void> | undefined;
function loadGis(): Promise<void> {
  gisPromise ??= new Promise<void>((resolve, reject) => {
    if (window.google?.accounts) return resolve();
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisPromise = undefined; // можно повторить
      s.remove();
      reject(new TypeError('gis-load-failed'));
    };
    document.head.append(s);
  });
  return gisPromise;
}

/** Содержимое документа → состояние. Нет документа или негодная строка — пусто; схема новее известной — отказ (не затираем). */
function readCloud(raw: unknown): LocalData {
  const d = raw as { schema?: unknown; data?: unknown } | undefined;
  if (typeof d?.schema === 'number' && d.schema > SCHEMA) throw new SchemaError('cloud schema is newer');
  if (typeof d?.data !== 'string') return EMPTY;
  try {
    return parseLocalData(JSON.parse(d.data)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

export function createRemote(cfg: SyncConfig, hooks: Hooks): Remote {
  const app = initializeApp(cfg.firebase);
  // Без popupRedirectResolver: вход идёт через GIS и credential, iframe authDomain и redirect не нужны (ломаются при partitioned storage).
  const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  const db = getFirestore(app);
  let uid: string | null = null;
  onAuthStateChanged(auth, (u) => {
    uid = u?.uid ?? null;
    hooks.onUser(u ? { name: u.displayName, email: u.email } : null);
  });
  const ref = () => {
    if (!uid) throw Object.assign(new Error('signed out'), { code: 'unauthenticated' });
    return doc(db, 'users', uid);
  };

  return {
    async renderButton(el) {
      await loadGis();
      const id = window.google!.accounts.id;
      id.initialize({
        client_id: cfg.clientId,
        auto_select: true,
        cancel_on_tap_outside: false,
        callback: ({ credential }) => {
          if (!credential) return;
          signInWithCredential(auth, GoogleAuthProvider.credential(credential)).catch((e) => hooks.onError(e));
        },
      });
      id.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'pill', locale: 'ru', width: 280 });
    },

    async sync(readLocal) {
      const r = ref();
      let local = EMPTY;
      let merged = EMPTY;
      // Транзакция: если документ изменили между чтением и записью (другое устройство), Firestore повторяет функцию целиком — слияние пересчитывается (ADR-28).
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(r);
        const remote = snap.exists() ? readCloud(snap.data()) : EMPTY;
        local = readLocal();
        merged = mergeData(local, remote);
        const payload = serialize(fitForCloud(merged));
        // Ничего нового для облака — не пишем (меньше записей из квоты Spark).
        if (!snap.exists() || (snap.data() as { data?: unknown }).data !== payload) {
          tx.set(r, { schema: SCHEMA, updatedAt: serverTimestamp(), data: payload });
        }
      });
      return { local, merged };
    },

    async deleteCloud() {
      const r = ref();
      try {
        await deleteDoc(r);
      } catch (e) {
        // Опубликованные правила без отдельного `allow delete` отказывают (request.resource == null): затираем пустым состоянием.
        if (classifyError(e) !== 'denied') throw e;
        await setDoc(r, { schema: SCHEMA, updatedAt: serverTimestamp(), data: serialize(EMPTY) });
      }
    },

    async signOut() {
      window.google?.accounts.id.disableAutoSelect();
      await fbSignOut(auth);
    },
  };
}
