import type { Episode } from '../../api/contract';
import { isWatched, type ProgressEntry } from '../../lib/storage';

type Progress = Record<string, ProgressEntry>;

/** Следующая доступная серия после текущей (по порядку плейлиста). */
export function nextEpisode(episodes: Episode[], currentId: string): Episode | undefined {
  const i = episodes.findIndex((e) => e.id === currentId);
  if (i < 0) return undefined;
  return episodes.slice(i + 1).find((e) => e.available);
}

export function prevEpisode(episodes: Episode[], currentId: string): Episode | undefined {
  const i = episodes.findIndex((e) => e.id === currentId);
  return i > 0 ? episodes.slice(0, i).reverse().find((e) => e.available) : undefined;
}

/**
 * Какую серию открыть (SPEC §5.4): ?episode= → начатая и не досмотренная (самая свежая) →
 * первая доступная после последней просмотренной → первая доступная.
 */
export function pickEpisode(episodes: Episode[], urlEpisodeId: string | null, progress: Progress): Episode | undefined {
  const available = episodes.filter((e) => e.available);
  const fromUrl = available.find((e) => e.id === urlEpisodeId);
  if (fromUrl) return fromUrl;

  const entries = available.flatMap((e) => (progress[e.id] ? [{ e, p: progress[e.id] }] : []));
  const started = entries.filter(({ p }) => p.position > 0 && !isWatched(p)).sort((a, b) => b.p.updatedAt - a.p.updatedAt)[0];
  if (started) return started.e;

  const lastDone = entries.filter(({ p }) => isWatched(p)).sort((a, b) => b.p.updatedAt - a.p.updatedAt)[0];
  if (lastDone) {
    const after = nextEpisode(episodes, lastDone.e.id);
    if (after) return after;
  }
  return available[0];
}
