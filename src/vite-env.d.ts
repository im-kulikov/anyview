/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `animevost` (по умолчанию) или `anyview` (свой сервер, пока не реализован). */
  readonly VITE_PROVIDER?: string;
  /** Список баз animevost через запятую, пробуем по порядку. */
  readonly VITE_ANIMEVOST_BASES?: string;
  /** База своего API (провайдер `anyview`). */
  readonly VITE_API_BASE?: string;
  readonly VITE_BASE?: string;
  /** Абсолютный адрес сайта (для og:image); читает только сборка (config/htmlPlugin.ts). */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
