import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { TitleSummary } from '../api/contract';
import { provider } from '../api/index';
import { keys, STALE } from '../api/keys';
import { S } from '../lib/strings';
import { cardMeta } from '../lib/format';
import { Cover } from './Cover';
import { RatingPill } from './RatingPill';
import { Skeleton } from './Skeleton';
import styles from './TitleCard.module.css';

interface Props {
  title: TitleSummary;
  /** Бейдж «N серия» — только в лентах обновлений. */
  showEpisode?: boolean;
  priority?: boolean;
  className?: string;
  onOpen?: () => void;
}

export function TitleCard({ title: t, showEpisode, priority, className = '', onOpen }: Props) {
  const qc = useQueryClient();
  const meta = cardMeta(t);
  // Префетч только на десктопе по наведению (SPEC §5.3): тайтл берётся из кэша адаптера.
  const prefetch = () => {
    if (!matchMedia('(pointer: fine)').matches) return;
    void qc.prefetchQuery({
      queryKey: keys.episodes(t.id),
      queryFn: ({ signal }) => provider.episodes(t.id, signal),
      staleTime: STALE.item,
    });
  };
  return (
    <Link to={`/title/${t.id}`} className={`${styles.card} ${className}`} onMouseEnter={prefetch} onClick={onOpen}>
      <Cover src={t.poster?.url} name={t.name} priority={priority} className={styles.cover}>
        {showEpisode && t.latestEpisode && <span className={styles.badge}>{S.card.episode(t.latestEpisode.number)}</span>}
        {t.rating && <RatingPill value={t.rating.value} />}
      </Cover>
      <span className={styles.text}>
        {meta && <span className={styles.meta}>{meta}</span>}
        <span className={styles.name}>{t.name}</span>
      </span>
    </Link>
  );
}

export function TitleCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`${styles.card} ${className}`} aria-hidden="true">
      <Skeleton className={styles.skelCover} />
      <Skeleton className={styles.skelLine} style={{ width: '45%' }} />
      <Skeleton className={styles.skelLine} style={{ width: '80%', height: 14 }} />
    </div>
  );
}
