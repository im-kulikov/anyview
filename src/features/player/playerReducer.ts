import { COUNTDOWN_S, type EndedAction } from './playerModel';

/** Состояние воспроизведения. started — видео загружено хотя бы раз (скрывает «Продолжаем с…»). */
export interface PlaybackState {
  started: boolean;
  playing: boolean;
  loading: boolean;
  failed: boolean;
  /** Секунды до автоперехода; null — отсчёта нет. */
  countdown: number | null;
  /** Уже пробовали другое качество после ошибки. */
  triedAlt: boolean;
}

export const initialPlayback: PlaybackState = { started: false, playing: false, loading: false, failed: false, countdown: null, triedAlt: false };

export type PlaybackEvent =
  | { type: 'load'; alt?: boolean } // src выставлен; alt — повтор в другом качестве после ошибки
  | { type: 'reset' } // серия сменилась снаружи
  | { type: 'play' }
  | { type: 'playRejected' }
  | { type: 'ready' } // playing / canplay
  | { type: 'waiting' }
  | { type: 'pause' }
  | { type: 'ended'; action: EndedAction }
  | { type: 'fail' }
  | { type: 'tick' }
  | { type: 'cancelCountdown' };

export function playbackReducer(s: PlaybackState, e: PlaybackEvent): PlaybackState {
  switch (e.type) {
    case 'load': return { ...s, started: true, failed: false, countdown: null, loading: true, triedAlt: !!e.alt };
    case 'reset': return initialPlayback;
    case 'play': return { ...s, playing: true };
    case 'playRejected': return { ...s, playing: false };
    case 'ready': return { ...s, loading: false };
    case 'waiting': return { ...s, loading: true };
    case 'pause': return { ...s, playing: false, loading: false };
    case 'ended': return { ...s, playing: false, loading: false, countdown: e.action === 'countdown' ? COUNTDOWN_S : s.countdown };
    case 'fail': return { ...s, failed: true, playing: false, loading: false, countdown: null };
    case 'tick': return s.countdown === null ? s : { ...s, countdown: s.countdown - 1 };
    case 'cancelCountdown': return s.countdown === null ? s : { ...s, countdown: null };
  }
}
