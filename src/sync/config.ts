export interface SyncConfig {
  firebase: { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string };
  clientId: string;
}

/** Публичная конфигурация из `VITE_FIREBASE_*` и `VITE_GOOGLE_CLIENT_ID` (docs/SYNC.md). Не задана — синхронизации нет, код провайдера не грузится. */
export function syncConfig(env: Record<string, string | undefined> = import.meta.env): SyncConfig | null {
  const { VITE_FIREBASE_API_KEY: apiKey, VITE_FIREBASE_AUTH_DOMAIN: authDomain, VITE_FIREBASE_PROJECT_ID: projectId, VITE_FIREBASE_APP_ID: appId, VITE_GOOGLE_CLIENT_ID: clientId } = env;
  if (!apiKey || !authDomain || !projectId || !appId || !clientId) return null;
  return {
    firebase: { apiKey, authDomain, projectId, appId, storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '', messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '' },
    clientId,
  };
}
