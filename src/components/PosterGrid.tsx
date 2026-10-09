import type { TitleSummary } from '../api/contract';
import { TitleCard, TitleCardSkeleton } from './TitleCard';
import styles from './PosterGrid.module.css';

export function PosterGrid({ items, showEpisode = true, skeletons = 0, priorityCount = 0 }: {
  items: TitleSummary[];
  showEpisode?: boolean;
  skeletons?: number;
  priorityCount?: number;
}) {
  return (
    <div className={styles.grid}>
      {items.map((t, i) => (
        <TitleCard key={t.id} title={t} showEpisode={showEpisode} priority={i < priorityCount} />
      ))}
      {Array.from({ length: skeletons }, (_, i) => (
        <TitleCardSkeleton key={`s${i}`} />
      ))}
    </div>
  );
}
