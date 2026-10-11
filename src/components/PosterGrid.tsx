import type { TitleSummary } from '../api/contract';
import { TitleCard, TitleCardSkeleton } from './TitleCard';
import { usePrefs } from '../lib/storage';
import styles from './PosterGrid.module.css';

export function PosterGrid({ items, badges, showEpisode = true, skeletons = 0, priorityCount = 0, showOriginal = false, onOpen }: {
  items: TitleSummary[];
  /** Бейджи по id карточки (например, число сезонов в избранном). */
  badges?: Record<string, string>;
  showEpisode?: boolean;
  skeletons?: number;
  priorityCount?: number;
  showOriginal?: boolean;
  onOpen?: () => void;
}) {
  const { cols } = usePrefs(); // на телефоне 2 или 3 колонки (кнопка в каталоге)
  return (
    <div className={styles.grid} data-cols={cols}>
      {items.map((t, i) => (
        <TitleCard key={t.id} title={t} badge={badges?.[t.id]} showEpisode={showEpisode} priority={i < priorityCount} showOriginal={showOriginal} onOpen={onOpen} />
      ))}
      {Array.from({ length: skeletons }, (_, i) => (
        <TitleCardSkeleton key={`s${i}`} />
      ))}
    </div>
  );
}
