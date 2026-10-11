import { useMemo } from 'react';
import { useUpdates } from '../../api/hooks';
import type { TitleSummary } from '../../api/contract';
import { newEpisodes } from '../../lib/library';
import { historyStore, statusesStore, useStore } from '../../lib/storage';

/** Отслеживаемые тайтлы: история просмотра и список «Смотрю». */
export function useTracked(): TitleSummary[] {
  const history = useStore(historyStore);
  const statuses = useStore(statusesStore);
  return useMemo(() => {
    const m = new Map<string, TitleSummary>();
    for (const e of Object.values(statuses)) if (e.s === 'watching' && e.t) m.set(e.t.id, e.t);
    for (const h of history) m.set(h.title.id, h.title);
    return [...m.values()];
  }, [history, statuses]);
}

/** id → свежая карточка из ленты для тайтлов, у которых вышла серия после последнего просмотра. Лента уже загружена на главной и в каталоге. */
export function useNewEpisodes(): Map<string, TitleSummary> {
  const tracked = useTracked();
  const pages = useUpdates().data?.pages;
  return useMemo(() => newEpisodes(tracked, pages?.flatMap((p) => p.items) ?? []), [tracked, pages]);
}
