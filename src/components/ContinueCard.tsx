import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { S } from '../lib/strings';
import type { HistoryEntry } from '../lib/storage';
import { Cover } from './Cover';
import styles from './ContinueCard.module.css';

export function ContinueCard({ entry: e, className = '' }: { entry: HistoryEntry; className?: string }) {
  const pct = e.duration > 0 ? Math.min(100, (e.position / e.duration) * 100) : 0;
  const left = e.duration > 0 && e.position > 0 ? S.player.left(Math.max(1, Math.round((e.duration - e.position) / 60))) : '';
  return (
    <Link to={`/title/${e.title.id}?episode=${encodeURIComponent(e.episodeId)}`} className={`${styles.card} ${className}`}>
      <Cover src={e.still ?? e.title.poster?.url} name={e.title.name} ratio="16 / 9" className={styles.cover}>
        <span className={styles.play}>
          <Play size={18} fill="currentColor" aria-hidden="true" />
        </span>
        {pct > 0 && (
          <span className={styles.bar}>
            <span style={{ width: `${pct}%` }} />
          </span>
        )}
      </Cover>
      <span className={styles.text}>
        <b>{e.title.name}</b>
        <span>{[e.episodeName, left].filter(Boolean).join(' · ')}</span>
      </span>
    </Link>
  );
}
