import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { TitleSummary } from '../../api/contract';
import { provider } from '../../api/index';
import { ContinueCard } from '../../components/ContinueCard';
import { PosterGrid } from '../../components/PosterGrid';
import { favoritesStore, historyStore, LIST_STATUSES, statusesStore, useStore, type ListStatus } from '../../lib/storage';
import { seasonsWord } from '../../lib/format';
import { groupSeasons } from '../../lib/library';
import { S } from '../../lib/strings';
import { useNewEpisodes } from './useNewEpisodes';
import styles from './LibrarySection.module.css';

type Tab = 'continue' | ListStatus | 'favorites';
const TABS: Tab[] = ['continue', ...LIST_STATUSES, 'favorites'];
const label = (t: Tab) => (t === 'continue' ? S.library.continue : t === 'favorites' ? S.library.favorites : S.lists[t]);

/** «Моё» на странице «Аккаунт»: начатые серии, списки просмотра и избранное. Всё локальное (синхронизируется там же, ниже), сети не требует. */
export function LibrarySection() {
  const history = useStore(historyStore);
  const favorites = useStore(favoritesStore);
  const statuses = useStore(statusesStore);
  const fresh = useNewEpisodes();
  // Избранное: сезоны одной франшизы — одна карточка с последним сезоном (данные не меняются, только показ)
  const favGroups = useMemo(() => groupSeasons(favorites, provider.franchiseOf), [favorites]);
  const favBadges = useMemo(() => Object.fromEntries(favGroups.filter((g) => g.seasons > 1).map((g) => [g.title.id, `${g.seasons} ${seasonsWord(g.seasons)}`])), [favGroups]);
  const [params] = useSearchParams();

  const byStatus = (s: ListStatus): TitleSummary[] =>
    Object.values(statuses).filter((e) => e.s === s && e.t).sort((a, b) => b.at - a.at).map((e) => fresh.get(e.t!.id) ?? e.t!);
  const items: Record<Tab, number> = {
    continue: history.length,
    ...Object.fromEntries(LIST_STATUSES.map((s) => [s, byStatus(s).length])) as Record<ListStatus, number>,
    favorites: favGroups.length,
  };
  const asked = params.get('tab') as Tab | null;
  // По умолчанию — первый непустой раздел: пользователь сразу видит своё, а не пустой экран.
  const tab: Tab = asked && TABS.includes(asked) ? asked : TABS.find((t) => items[t] > 0) ?? 'continue';

  return (
    <section className={styles.main} aria-labelledby="library-h">
      <h2 id="library-h">{S.library.title}</h2>
      <nav aria-label={S.library.tabs} className={styles.tabs}>
        {TABS.map((t) => (
          <Link key={t} to={`/sync?tab=${t}`} replace aria-current={t === tab ? 'page' : undefined} className={styles.tab}>
            {label(t)}<span>{items[t]}</span>
          </Link>
        ))}
      </nav>

      {items[tab] === 0 ? (
        <div className={styles.empty}>
          <p>{S.library.empty[tab]}</p>
          <Link to="/anime">{S.library.toCatalog}</Link>
        </div>
      ) : tab === 'continue' ? (
        <ul className={styles.continue}>
          {history.map((h) => <li key={h.title.id}><ContinueCard entry={h} isNew={fresh.has(h.title.id)} /></li>)}
        </ul>
      ) : tab === 'favorites' ? (
        <>
          <PosterGrid items={favGroups.map((g) => g.title)} badges={favBadges} showEpisode={false} />
          {Object.keys(favBadges).length > 0 && <p className={styles.hint}>{S.library.groupedHint}</p>}
        </>
      ) : (
        <PosterGrid items={byStatus(tab)} showEpisode={tab === 'watching'} />
      )}
    </section>
  );
}
