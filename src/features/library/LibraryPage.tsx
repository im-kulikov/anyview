import { Link, useSearchParams } from 'react-router';
import type { TitleSummary } from '../../api/contract';
import { ContinueCard } from '../../components/ContinueCard';
import { PosterGrid } from '../../components/PosterGrid';
import { favoritesStore, historyStore, LIST_STATUSES, statusesStore, useStore, type ListStatus } from '../../lib/storage';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useNewEpisodes } from './useNewEpisodes';
import styles from './LibraryPage.module.css';

type Tab = 'continue' | ListStatus | 'favorites';
const TABS: Tab[] = ['continue', ...LIST_STATUSES, 'favorites'];
const label = (t: Tab) => (t === 'continue' ? S.library.continue : t === 'favorites' ? S.library.favorites : S.lists[t]);

/** «Моё»: начатые серии, списки просмотра и избранное. Всё локальное (синхронизируется через /sync), сети не требует. */
export function LibraryPage() {
  useDocumentTitle(S.library.title);
  const history = useStore(historyStore);
  const favorites = useStore(favoritesStore);
  const statuses = useStore(statusesStore);
  const fresh = useNewEpisodes();
  const [params] = useSearchParams();

  const byStatus = (s: ListStatus): TitleSummary[] =>
    Object.values(statuses).filter((e) => e.s === s && e.t).sort((a, b) => b.at - a.at).map((e) => fresh.get(e.t!.id) ?? e.t!);
  const items: Record<Tab, number> = {
    continue: history.length,
    ...Object.fromEntries(LIST_STATUSES.map((s) => [s, byStatus(s).length])) as Record<ListStatus, number>,
    favorites: favorites.length,
  };
  const asked = params.get('tab') as Tab | null;
  // По умолчанию — первый непустой раздел: пользователь сразу видит своё, а не пустой экран.
  const tab: Tab = asked && TABS.includes(asked) ? asked : TABS.find((t) => items[t] > 0) ?? 'continue';

  return (
    <main className={styles.main}>
      <h1>{S.library.title}</h1>
      <nav aria-label={S.library.tabs} className={styles.tabs}>
        {TABS.map((t) => (
          <Link key={t} to={`/library?tab=${t}`} replace aria-current={t === tab ? 'page' : undefined} className={styles.tab}>
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
        <PosterGrid items={favorites} showEpisode={false} />
      ) : (
        <PosterGrid items={byStatus(tab)} showEpisode={tab === 'watching'} />
      )}

      <p className={styles.hint}>
        {S.library.syncHint} <Link to="/sync">{S.library.syncLink}</Link>
      </p>
    </main>
  );
}
