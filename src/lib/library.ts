import type { TitleSummary } from '../api/contract';

/**
 * «Новая серия»: у отслеживаемого тайтла (в истории или в списке «Смотрю») в ленте обновлений номер последней серии
 * больше, чем в снимке, сохранённом при просмотре. Возвращает свежую карточку из ленты по id.
 * shortcut: лента — только недавние обновления; тайтл, выпавший из неё, «новой серии» не покажет. Серверу — отдавать это самому.
 */
export function newEpisodes(tracked: TitleSummary[], feed: TitleSummary[]): Map<string, TitleSummary> {
  const fresh = new Map(feed.map((t) => [t.id, t]));
  const out = new Map<string, TitleSummary>();
  for (const t of tracked) {
    const now = fresh.get(t.id)?.latestEpisode?.number ?? 0;
    if (now > (t.latestEpisode?.number ?? 0)) out.set(t.id, fresh.get(t.id)!);
  }
  return out;
}
