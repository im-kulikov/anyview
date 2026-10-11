import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Film } from 'lucide-react';
import { useUpdates } from '../../api/hooks';
import { provider } from '../../api/index';
import { Rail } from '../../components/Rail';
import { SectionHeader } from '../../components/SectionHeader';
import { TitleCard, TitleCardSkeleton } from '../../components/TitleCard';
import { ContinueCard } from '../../components/ContinueCard';
import { useNewEpisodes } from '../library/useNewEpisodes';
import { favoritesStore, historyStore, statusesStore, useStore } from '../../lib/storage';
import { PosterGrid } from '../../components/PosterGrid';
import { ErrorState } from '../../components/ErrorState';
import { seasonsWord } from '../../lib/format';
import { groupSeasons } from '../../lib/library';
import { S } from '../../lib/strings';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './HomePage.module.css';

const FRESH = 12;
const LATEST = 12;

export function HomePage() {
  useDocumentTitle();
  const q = useUpdates();
  const favorites = useStore(favoritesStore);
  const favGroups = useMemo(() => groupSeasons(favorites, provider.franchiseOf), [favorites]);
  const hasStatuses = Object.values(useStore(statusesStore)).some((e) => e.s);
  const newEps = useNewEpisodes();
  // записи с новой серией — первыми
  const history = [...useStore(historyStore)].sort((a, b) => Number(newEps.has(b.title.id)) - Number(newEps.has(a.title.id))).slice(0, 10);
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
            ? fresh.map((t, i) => <TitleCard key={t.id} title={t} showEpisode priority={i < 3} className={styles.railCard} />)
            : Array.from({ length: 6 }, (_, i) => <TitleCardSkeleton key={i} className={styles.railCard} />)}
        </Rail>}
      </section>

      {history.length === 0 && favorites.length === 0 && !hasStatuses && (
        <section className={styles.hint}>
          <b>{S.home.hintTitle}</b>
          <span>{S.home.hintBody}</span>
          <Link to="/sync">{S.home.hintLink}</Link>
        </section>
      )}

      {history.length > 0 && (
        <section className={styles.section}>
          <SectionHeader title={S.home.continue} />
          <div className={styles.continueRail}>
            <Rail>
              {history.map((h) => <ContinueCard key={h.title.id} entry={h} isNew={newEps.has(h.title.id)} className={styles.continueCard} />)}
            </Rail>
          </div>
          <ul className={styles.continueGrid}>
            {history.map((h) => <li key={h.title.id}><ContinueCard entry={h} isNew={newEps.has(h.title.id)} /></li>)}
          </ul>
        </section>
      )}

      {favorites.length > 0 && (
        <section className={styles.section}>
          <SectionHeader title={S.home.favorites} />
          <Rail>
            {favGroups.map((g) => <TitleCard key={g.title.id} title={g.title} badge={g.seasons > 1 ? `${g.seasons} ${seasonsWord(g.seasons)}` : undefined} className={styles.railCard} />)}
          </Rail>
        </section>
      )}

      <section className={styles.section}>
        <SectionHeader title={S.home.latest} to="/anime" label={S.home.latestAll} text={S.home.catalog} />
        {failed ? retry : first ? (
          <PosterGrid items={latest} showEpisode={false} />
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
