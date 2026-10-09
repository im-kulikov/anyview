import { useEffect, useRef, type RefObject } from 'react';
import { keyAction, type KeyAction } from './hotkeys';

/**
 * Клавиатура плеера (десктоп): слушатель один на всё время жизни, действия читаются из ref.
 * Решение «что за клавиша» — чистая keyAction; здесь только сбор входных данных из DOM.
 */
export function useHotkeys(wrapRef: RefObject<HTMLElement | null>, videoRef: RefObject<HTMLVideoElement | null>, run: (a: KeyAction) => void) {
  const cb = useRef(run);
  useEffect(() => {
    cb.current = run;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const v = videoRef.current;
      const action = keyAction({
        key: e.key,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        inField: !!t?.closest('input, textarea, select, [contenteditable="true"]'),
        onInteractive: !!t?.closest('button, a, [role="slider"]'),
        inPlayer: !!t && !!wrapRef.current?.contains(t),
        playingOnBody: !!v && !v.paused && (t === document.body || !t),
      });
      if (!action) return;
      if (action.type !== 'fullscreen' && action.type !== 'mute' && action.type !== 'next') e.preventDefault();
      cb.current(action);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [wrapRef, videoRef]);
}
