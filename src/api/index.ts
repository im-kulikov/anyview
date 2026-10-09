import type { ContentProvider } from './provider';
import { createAnimevostProvider } from './providers/animevost';
import { comingSoonProvider } from './providers/comingSoon';

const DEFAULT_BASES = 'https://api.animetop.info/v1,https://api.animevost.org/v1';
const bases = (import.meta.env.VITE_ANIMEVOST_BASES ?? DEFAULT_BASES)
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

const anime = createAnimevostProvider(bases);

/** Единая точка входа: аниме — animevost, остальные типы — заглушка. */
export const provider: ContentProvider = {
  catalog: () => anime.catalog(),
  updates: (p) => (p.type === 'anime' ? anime.updates(p) : comingSoonProvider.updates(p)),
  search: (p) => (!p.type || p.type === 'anime' ? anime.search(p) : comingSoonProvider.search(p)),
  title: (id, s) => anime.title(id, s),
  episodes: (id, s) => anime.episodes(id, s),
  sources: (id, s) => anime.sources(id, s),
};
