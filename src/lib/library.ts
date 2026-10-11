import type { FranchiseRef, TitleSummary } from '../api/contract';

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

export interface SeasonGroup {
  /** Показываемая карточка — последний (по номеру) сезон из тех, что есть в списке. */
  title: TitleSummary;
  /** Сколько сезонов этой франшизы в списке; 1 — тайтл показан сам по себе. */
  seasons: number;
}

/**
 * Сезоны одной франшизы в списке → одна карточка с последним сезоном (к остальным ведёт блок «Сезоны» на его странице).
 * Данные не меняются, группировка только для показа. Группа стоит на месте самого свежего своего члена.
 * Не склеиваем, если в группе повторяется номер сезона (ремейк «(2021)» с той же базой) — лучше показать все, чем спрятать другой тайтл.
 */
export function groupSeasons(list: TitleSummary[], franchiseOf: (t: TitleSummary) => FranchiseRef | undefined): SeasonGroup[] {
  const refs = list.map((t) => franchiseOf(t));
  const byKey = new Map<string, number[]>();
  refs.forEach((r, i) => r && byKey.set(r.key, [...(byKey.get(r.key) ?? []), i]));
  const out: SeasonGroup[] = [];
  const done = new Set<number>();
  list.forEach((t, i) => {
    if (done.has(i)) return;
    const members = refs[i] ? byKey.get(refs[i]!.key)! : [i];
    const nums = members.map((m) => refs[m]?.season);
    if (members.length < 2 || new Set(nums).size < nums.length) {
      out.push({ title: t, seasons: 1 }); // сам по себе (дубликаты номера обработаем каждый отдельно)
      done.add(i);
      return;
    }
    members.forEach((m) => done.add(m));
    const last = members.reduce((a, b) => (refs[b]!.season > refs[a]!.season ? b : a));
    out.push({ title: list[last], seasons: members.length });
  });
  return out;
}
