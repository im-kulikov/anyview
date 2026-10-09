import { useRef } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import type { TitleSummary } from '../api/contract';
import { provider } from '../api/index';
import { keys, STALE } from '../api/keys';
import { S } from '../lib/strings';
import { cardMeta, ratingText } from '../lib/format';
import { Cover } from './Cover';
import { RatingPill } from './RatingPill';
import { Skeleton } from './Skeleton';
import styles from './TitleCard.module.css';

interface Props {
  title: TitleSummary;
  /** Бейдж «N серия» — только в лентах обновлений. */
  showEpisode?: boolean;
  priority?: boolean;
  showOriginal?: boolean;
  className?: string;
  onOpen?: () => void;
}

export function TitleCard({ title: t, showEpisode, priority, showOriginal, className = '', onOpen }: Props) {
  const qc = useQueryClient();
  const meta = cardMeta(t);
  // Префетч только на десктопе по наведению (SPEC §5.3): тайтл берётся из кэша адаптера.
  // С задержкой: пробег мыши по сетке не должен порождать десятки запросов.
  const hover = useRef(0);
  const prefetch = () => {
    if (!matchMedia('(pointer: fine)').matches) return;
    window.clearTimeout(hover.current);
    hover.current = window.setTimeout(() => {
      void qc.prefetchQuery({
        queryKey: keys.episodes(t.id),
        queryFn: ({ signal }) => provider.episodes(t.id, signal),
        staleTime: STALE.item,
      });
    }, 150);
  };
  // Имя ссылки собираем по порядку «название, мета, серия, рейтинг»: иначе числа склеиваются без пояснений.
  const label = [
    t.name,
    showOriginal && t.originalName,
    meta,
    showEpisode && t.latestEpisode && S.card.episode(t.latestEpisode.number),
    t.rating && `${S.card.rating} ${ratingText(t.rating.value)}`,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Link to={`/title/${t.id}`} aria-label={label} className={`${styles.card} ${className}`} onMouseEnter={prefetch} onMouseLeave={() => window.clearTimeout(hover.current)} onClick={onOpen}>
      <Cover src={t.poster?.url} name={t.name} priority={priority} className={styles.cover}>
        {showEpisode && t.latestEpisode && <span className={styles.badge}>{S.card.episode(t.latestEpisode.number)}</span>}
        {t.rating && <RatingPill value={t.rating.value} />}
      </Cover>
      <span className={styles.text}>
        {meta && <span className={styles.meta}>{meta}</span>}
        <span className={styles.name}>{t.name}</span>
        {showOriginal && t.originalName && <span className={styles.orig}>{t.originalName}</span>}
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
