import { Link } from 'react-router';
import { ChevronRight, Film } from 'lucide-react';
import { useUpdates } from '../../api/hooks';
import { Rail } from '../../components/Rail';
import { SectionHeader } from '../../components/SectionHeader';
import { TitleCard, TitleCardSkeleton } from '../../components/TitleCard';
import { ContinueCard } from '../../components/ContinueCard';
import { favoritesStore, historyStore, useStore } from '../../lib/storage';
import { PosterGrid } from '../../components/PosterGrid';
import { ErrorState } from '../../components/ErrorState';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './HomePage.module.css';

const FRESH = 12;
const LATEST = 12;

export function HomePage() {
  useDocumentTitle();
  const q = useUpdates();
  const history = useStore(historyStore).slice(0, 10);
  const favorites = useStore(favoritesStore);
  // Одна лента на главной и на /anime; для главной берём только первую страницу.
  const first = q.data?.pages[0]?.items;
  const fresh = (first ?? []).filter((t) => t.status === 'ongoing' && t.latestEpisode).slice(0, FRESH);
  const freshIds = new Set(fresh.map((t) => t.id));
  const latest = (first ?? []).filter((t) => !freshIds.has(t.id)).slice(0, LATEST);

  // Ошибка ленты не ломает остальные секции (SPEC §6): «Продолжить» и «Избранное» читаются локально.
  const failed = q.isError && !first;
  const retry = <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <main className={styles.main}>
      <section className={styles.section}>
        <SectionHeader title={S.home.fresh} to="/anime" label={S.home.freshAll} text={S.home.all} />
        {failed ? retry : <Rail>
          {first
            ? fresh.map((t, i) => <TitleCard key={t.id} title={t} showEpisode priority={i < 1} className={styles.railCard} />)
            : Array.from({ length: 6 }, (_, i) => <TitleCardSkeleton key={i} className={styles.railCard} />)}
        </Rail>}
      </section>

      {history.length > 0 && (
        <section className={styles.section}>
          <SectionHeader title={S.home.continue} />
          <div className={styles.continueRail}>
            <Rail>
              {history.map((h) => <ContinueCard key={h.title.id} entry={h} className={styles.continueCard} />)}
            </Rail>
          </div>
          <ul className={styles.continueGrid}>
            {history.map((h) => <li key={h.title.id}><ContinueCard entry={h} /></li>)}
          </ul>
        </section>
      )}

      {favorites.length > 0 && (
        <section className={styles.section}>
          <SectionHeader title={S.home.favorites} />
          <Rail>
            {favorites.map((t) => <TitleCard key={t.id} title={t} className={styles.railCard} />)}
          </Rail>
        </section>
      )}

      <section className={styles.section}>
        <SectionHeader title={S.home.latest} to="/anime" label={S.home.latestAll} text={S.home.catalog} />
        {failed ? retry : first ? (
          <PosterGrid items={latest} />
        ) : (
          <PosterGrid items={[]} skeletons={LATEST} />
        )}
        <Link to="/anime" className={styles.more}>
          {S.home.more}
        </Link>
      </section>

      <Link to="/series" className={styles.banner}>
        <span className={styles.bannerIcon}>
          <Film size={24} aria-hidden="true" />
        </span>
        <span className={styles.bannerText}>
          <b>
            <span className={styles.m}>{S.home.soonTitleShort}</span>
            <span className={styles.d}>{S.home.soonTitle}</span>
          </b>
          <span>
            <span className={styles.m}>{S.home.soonBodyShort}</span>
            <span className={styles.d}>{S.home.soonBody}</span>
          </span>
        </span>
        <span className={styles.bannerGo}>
          <ChevronRight size={20} aria-hidden="true" />
          <span className={styles.d}>{S.home.more2}</span>
        </span>
      </Link>
    </main>
  );
}
