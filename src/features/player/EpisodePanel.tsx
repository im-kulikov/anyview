import { X } from 'lucide-react';
import type { Episode, Title } from '../../api/contract';
import { S } from '../../lib/strings';
import { EpisodeList } from './EpisodeList';
import styles from './Player.module.css';

interface Props {
  title: Title;
  episodes: Episode[];
  currentId: string;
  /** Вызывается синхронно из клика: iOS разрешает play() только в обработчике касания. */
  onPick(ep: Episode): void;
  onClose(): void;
}

/** Панель «Список серий» внутри контейнера плеера: видна и в полноэкранном режиме (Fullscreen API: iPad, десктоп). */
export function EpisodePanel({ title, episodes, currentId, onPick, onClose }: Props) {
  return (
    <div className={styles.panel} role="dialog" aria-label={S.player.episodes} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className={styles.panelHead}>
        <b>{S.player.episodes}</b>
        <button type="button" className={styles.btn} aria-label={S.player.closePanel} autoFocus onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.panelList}>
        <EpisodeList compact title={title} episodes={episodes} currentId={currentId} onPick={(ep) => { onPick(ep); onClose(); }} />
      </div>
    </div>
  );
}
