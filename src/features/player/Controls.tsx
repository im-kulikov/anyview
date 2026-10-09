import { ListVideo, Maximize, Minimize, Pause, PictureInPicture2, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import type { Source } from '../../api/contract';
import { S } from '../../lib/strings';
import { formatTime } from '../../lib/format';
import { setPrefs, type Prefs } from '../../lib/storage';
import { ProgressBar } from './ProgressBar';
import styles from './Player.module.css';

interface Props {
  playing: boolean;
  time: number;
  duration: number;
  buffered: number;
  scrub: number | null;
  onScrub(v: number | null): void;
  onSeekTo(seconds: number): void;
  onSeekBy(delta: number): void;
  prefs: Prefs;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev(): void;
  onNext(): void;
  onToggle(): void;
  source?: Source;
  panelOpen: boolean;
  onTogglePanel(): void;
  pipOk: boolean;
  onPip(): void;
  isFs: boolean;
  onFullscreen(): void;
}

/** Нижняя панель плеера: перемотка и ряд кнопок. Только отображение, состояния держит Player. */
export function Controls(p: Props) {
  const shown = p.scrub !== null ? p.scrub * p.duration : p.time;
  const { prefs } = p;
  return (
    <div className={styles.controls} onPointerDown={(e) => e.stopPropagation()}>
      <ProgressBar time={p.time} duration={p.duration} buffered={p.buffered} scrub={p.scrub} onScrub={p.onScrub} onSeekTo={p.onSeekTo} onSeekBy={p.onSeekBy} />
      <div className={styles.row}>
        {p.hasPrev && (
          <button type="button" className={styles.btn} aria-label={S.player.prev} onClick={p.onPrev}>
            <SkipBack size={20} fill="currentColor" aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.btn} aria-label={p.playing ? S.player.pause : S.player.play} onClick={p.onToggle}>
          {p.playing ? <Pause size={22} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
        </button>
        {p.hasNext && (
          <button type="button" className={styles.btn} aria-label={S.player.next} onClick={p.onNext}>
            <SkipForward size={20} fill="currentColor" aria-hidden="true" />
          </button>
        )}
        <button type="button" className={`${styles.btn} ${styles.volBtn}`} aria-label={prefs.muted ? S.player.unmute : S.player.mute} onClick={() => setPrefs({ muted: !prefs.muted })}>
          {prefs.muted || prefs.volume === 0 ? <VolumeX size={20} aria-hidden="true" /> : prefs.volume < 0.5 ? <Volume1 size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        </button>
        <input
          type="range"
          className={styles.volume}
          aria-label={S.player.volume}
          min={0}
          max={1}
          step={0.05}
          value={prefs.muted ? 0 : prefs.volume}
          onChange={(e) => setPrefs({ volume: Number(e.target.value), muted: false })}
        />
        <span className={styles.time}>{formatTime(shown)} / {p.duration ? formatTime(p.duration) : '--:--'}</span>
        <span className={styles.spacer} />
        {p.source && <span className={styles.quality}>{p.source.quality.label}</span>}
        <button type="button" className={styles.btn} aria-label={S.player.episodes} aria-expanded={p.panelOpen} onClick={p.onTogglePanel}>
          <ListVideo size={20} aria-hidden="true" />
        </button>
        {p.pipOk && (
          <button type="button" className={`${styles.btn} ${styles.pip}`} aria-label={S.player.pip} onClick={p.onPip}>
            <PictureInPicture2 size={20} aria-hidden="true" />
          </button>
        )}
        <button type="button" className={styles.btn} aria-label={p.isFs ? S.player.exitFullscreen : S.player.fullscreen} onClick={p.onFullscreen}>
          {p.isFs ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
