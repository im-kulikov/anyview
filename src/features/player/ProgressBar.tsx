import { useRef } from 'react';
import { S } from '../../lib/strings';
import { formatTime } from '../../lib/format';
import { percent } from './playerModel';
import styles from './Player.module.css';

interface Props {
  time: number;
  duration: number;
  buffered: number;
  /** Доля 0–1 во время перетаскивания; null — не тянем. */
  scrub: number | null;
  onScrub(v: number | null): void;
  onSeekTo(seconds: number): void;
  onSeekBy(delta: number): void;
}

/** Полоса перемотки: указатель (с захватом) и клавиатура (←/→ ±10 с). */
export function ProgressBar({ time, duration, buffered, scrub, onScrub, onSeekTo, onSeekBy }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const shown = scrub !== null ? scrub * duration : time;
  const at = scrub !== null ? scrub * 100 : percent(time, duration);

  const scrubFrom = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    onScrub(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

  return (
    <div
      ref={barRef}
      className={styles.bar}
      role="slider"
      tabIndex={0}
      aria-label={S.player.seek}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration) || 0}
      aria-valuenow={Math.round(shown)}
      aria-valuetext={`${formatTime(shown)} / ${formatTime(duration)}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubFrom(e); }}
      onPointerMove={(e) => scrub !== null && scrubFrom(e)}
      onPointerUp={() => { if (scrub !== null && duration) onSeekTo(scrub * duration); onScrub(null); }}
      onPointerCancel={() => onScrub(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeekBy(-10); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeekBy(10); }
      }}
    >
      <div className={styles.track}>
        <div className={styles.buffered} style={{ width: `${percent(buffered, duration)}%` }} />
        <div className={styles.played} style={{ width: `${at}%` }} />
        <div className={styles.knob} style={{ left: `${at}%` }} />
      </div>
    </div>
  );
}
