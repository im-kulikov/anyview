/** Режим «приложение на экране Домой» (iOS) и подсказка установки. Всё чистое по `Env`, чтение браузера — в `readEnv`. */
export interface Env {
  ua: string;
  platform: string;
  touchPoints: number;
  standalone: boolean;
}

export function readEnv(): Env {
  try {
    const n = navigator as Navigator & { standalone?: boolean };
    return {
      ua: n.userAgent,
      platform: n.platform ?? '',
      touchPoints: n.maxTouchPoints ?? 0,
      standalone: n.standalone === true || matchMedia('(display-mode: standalone)').matches,
    };
  } catch {
    return { ua: '', platform: '', touchPoints: 0, standalone: false };
  }
}

export const isStandalone = (): boolean => readEnv().standalone;

/** iPhone, iPod, iPad; iPadOS в режиме «как на компьютере» выдаёт себя за Mac, но у него есть мультитач. */
export const isIos = (e: Env): boolean => /iPhone|iPod|iPad/.test(e.ua) || (e.platform === 'MacIntel' && e.touchPoints > 1);

/** Встроенные браузеры приложений: в них нет «На экран Домой». Telegram в iOS маркера в UA не оставляет — отсеять нельзя. */
const IN_APP = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|Snapchat|TikTok|MiuiBrowser/;
/** Другие браузеры на iOS: «Поделиться → На экран Домой» в них тоже есть, но пункт может выглядеть иначе. */
const OTHER_IOS = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|YaBrowser/;

export type InstallKind = 'safari' | 'other-ios';

/** Какую подсказку показать: null — не нужна (уже установлено, не iOS, встроенный браузер). */
export function installKind(e: Env): InstallKind | null {
  if (e.standalone || !isIos(e) || IN_APP.test(e.ua)) return null;
  return OTHER_IOS.test(e.ua) ? 'other-ios' : 'safari';
}

export const HINT_KEY = 'anyview:install';
/** После закрытия подсказка молчит этот срок. */
export const HINT_SNOOZE_MS = 30 * 86_400_000;

export interface HintState {
  dismissedAt?: number;
}

export const hintVisible = (kind: InstallKind | null, s: HintState, now: number): boolean =>
  kind !== null && !(typeof s.dismissedAt === 'number' && now - s.dismissedAt < HINT_SNOOZE_MS);

export function readHintState(): HintState {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HINT_KEY) ?? '{}');
    return typeof v === 'object' && v !== null && typeof (v as HintState).dismissedAt === 'number' ? { dismissedAt: (v as HintState).dismissedAt } : {};
  } catch {
    return {};
  }
}

export function dismissHint(now = Date.now()): void {
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify({ dismissedAt: now }));
  } catch {
    /* localStorage недоступен: подсказка покажется снова — не страшно */
  }
}
