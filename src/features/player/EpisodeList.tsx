import { memo, useEffect, useRef } from 'react';
import { AudioLines, Check, Clock } from 'lucide-react';
import type { Episode, Title } from '../../api/contract';
import { S } from '../../lib/strings';
import { formatDay } from '../../lib/format';
import { isWatched, progressStore, useStore } from '../../lib/storage';
import styles from './EpisodeList.module.css';

function sub(ep: Episode, title: Title, p?: { position: number; duration: number }): string {
  if (!ep.available) return ep.airDate ? S.player.airs(formatDay(ep.airDate)) : S.player.soon;
  if (isWatched(p)) return S.player.watched;
  if (p && p.position > 0 && p.duration > 0) return S.player.left(Math.max(1, Math.round((p.duration - p.position) / 60)));
  if (title.status === 'ongoing' && title.latestEpisode && ep.number === title.latestEpisode.number) return S.player.isNew;
  return '';
}

export const EpisodeList = memo(function EpisodeList({ title, episodes, currentId, onPick, compact }: {
  /** Тесная версия для панели внутри плеера (строки ниже, кадр меньше). */
  compact?: boolean;
  title: Title;
  episodes: Episode[];
  currentId: string;
  onPick(ep: Episode): void;
}) {
  const progress = useStore(progressStore);
  const listRef = useRef<HTMLOListElement>(null);

  // Текущая серия видна в ближайшем контейнере со своей прокруткой (колонка, панель плеера, мобильный список); страницу не двигаем.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    for (let box = el?.parentElement ?? null; el && box; box = box.parentElement) {
      const oy = getComputedStyle(box).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) {
        box.scrollTop += el.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
        break;
      }
    }
  }, [currentId]);

  return (
    <ol ref={listRef} className={`${styles.list} ${compact ? styles.compact : ''}`}>
      {episodes.map((ep) => {
        const p = progress[ep.id];
        const text = sub(ep, title, p);
        if (!ep.available) {
          return (
            <li key={ep.id}>
              <div className={`${styles.row} ${styles.upcoming}`}>
                <span className={`${styles.still} ${styles.stillEmpty}`}><Clock size={20} aria-hidden="true" /></span>
                <span className={styles.text}><b>{ep.name}</b><span>{text}</span></span>
              </div>
            </li>
          );
        }
        const cur = ep.id === currentId;
        const pct = p && p.duration ? Math.min(100, (p.position / p.duration) * 100) : 0;
        return (
          <li key={ep.id}>
            <button type="button" className={`${styles.row} ${cur ? styles.cur : ''}`} aria-current={cur ? 'true' : undefined} onClick={() => onPick(ep)}>
              <span className={styles.still}>
                {ep.preview && <img src={ep.preview.url} alt="" loading="lazy" decoding="async" />}
                {cur && <span className={styles.playing} title={S.player.playing}><AudioLines size={22} aria-hidden="true" /></span>}
                {pct > 0 && <span className={styles.prog}><span style={{ width: `${pct}%` }} /></span>}
              </span>
              <span className={styles.text}><b>{ep.name}</b><span>{text}</span></span>
              {isWatched(p) && <Check size={20} className={styles.check} aria-label={S.player.watched} />}
            </button>
          </li>
        );
      })}
    </ol>
  );
});
