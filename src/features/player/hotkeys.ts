export type KeyAction =
  | { type: 'toggle' }
  | { type: 'seek'; delta: number }
  | { type: 'volume'; delta: number }
  | { type: 'fullscreen' }
  | { type: 'mute' }
  | { type: 'next' };

export interface KeyInput {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  /** Цель — поле ввода (input, textarea, select, contenteditable). */
  inField: boolean;
  /** Цель — кнопка, ссылка или ползунок: пробел и стрелки принадлежат ей. */
  onInteractive: boolean;
  /** Фокус внутри контейнера плеера. */
  inPlayer: boolean;
  /** Видео играет, а фокус «нигде» (body): клавиши плеера работают, но только пока играет. */
  playingOnBody: boolean;
}

/**
 * Клавиша → действие плеера (десктоп). null — клавишу не трогаем (страница прокручивается как обычно).
 * Не срабатывает в полях ввода и не отбирает пробел и стрелки у кнопок.
 */
export function keyAction(i: KeyInput): KeyAction | null {
  if (i.metaKey || i.ctrlKey || i.altKey || i.inField) return null;
  if (!i.inPlayer && !i.playingOnBody) return null;
  const key = i.key.toLowerCase();
  if (key === 'n' && i.shiftKey) return { type: 'next' };
  if (i.shiftKey) return null;
  if (key === ' ') return i.onInteractive ? null : { type: 'toggle' };
  if (key === 'k') return { type: 'toggle' };
  if (key === 'f') return { type: 'fullscreen' };
  if (key === 'm') return { type: 'mute' };
  if (i.onInteractive) return null;
  if (key === 'arrowleft') return { type: 'seek', delta: -10 };
  if (key === 'arrowright') return { type: 'seek', delta: 10 };
  if (key === 'arrowup') return { type: 'volume', delta: 0.1 };
  if (key === 'arrowdown') return { type: 'volume', delta: -0.1 };
  return null;
}
