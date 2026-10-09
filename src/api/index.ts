import { ApiError } from './contract';
import type { ContentProvider } from './provider';
import { createAnimevostProvider } from './providers/animevost';
import { parseBases } from './providers/animevost/urls';
import { comingSoonProvider } from './providers/comingSoon';

/** Аниме — animevost, остальные типы — заглушка. */
function createAnimevostRouter(rawBases: string | undefined): ContentProvider {
  const anime = createAnimevostProvider(parseBases(rawBases));
  return {
    catalog: () => anime.catalog(),
    updates: (p) => (p.type === 'anime' ? anime.updates(p) : comingSoonProvider.updates(p)),
    search: (p) => (!p.type || p.type === 'anime' ? anime.search(p) : comingSoonProvider.search(p)),
    title: (id, s) => anime.title(id, s),
    episodes: (id, s) => anime.episodes(id, s),
    sources: (id, s) => anime.sources(id, s),
    related: (id, s) => anime.related(id, s),
  };
}

/** Заготовка под свой сервер (`${apiBase}/api/v1/*`, API_CONTRACT.md): клиент не реализован, все вызовы падают явной ошибкой. */
function createAnyviewProvider(apiBase: string | undefined): ContentProvider {
  const fail = (): Promise<never> =>
    Promise.reject(new ApiError('network', `Provider "anyview" is not implemented (VITE_API_BASE=${apiBase ?? 'unset'})`));
  return { catalog: fail, updates: fail, title: fail, episodes: fail, sources: fail, related: fail, search: fail };
}

/** Выбор провайдера по VITE_PROVIDER; неизвестное значение — ошибка конфигурации при старте. */
export function createProvider(env: { VITE_PROVIDER?: string; VITE_API_BASE?: string; VITE_ANIMEVOST_BASES?: string }): ContentProvider {
  const name = env.VITE_PROVIDER || 'animevost';
  if (name === 'animevost') return createAnimevostRouter(env.VITE_ANIMEVOST_BASES);
  if (name === 'anyview') return createAnyviewProvider(env.VITE_API_BASE);
  throw new Error(`Unknown VITE_PROVIDER "${name}" (expected "animevost" or "anyview")`);
}

export const provider: ContentProvider = createProvider(import.meta.env);
