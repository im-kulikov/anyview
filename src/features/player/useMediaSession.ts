import { useEffect, useRef } from 'react';
import type { Episode, Title } from '../../api/contract';

interface Opts {
  title: Title;
  episode: Episode;
  hasNext: boolean;
  onPlay(): void;
  onPause(): void;
  onNext(): void;
  onPrev(): void;
}

/** Название, серия, обложка и кнопки «следующая/предыдущая» на экране блокировки. */
export function useMediaSession({ title, episode, hasNext, onPlay, onPause, onNext, onPrev }: Opts) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const artwork = title.poster ? [{ src: title.poster.url }] : [];
    navigator.mediaSession.metadata = new MediaMetadata({ title: title.name, artist: episode.name, album: 'anyview', artwork });
  }, [title, episode]);

  // Колбэки читаем из ref: обработчики регистрируются один раз, а не при каждом рендере плеера (4 раза в секунду).
  const cb = useRef({ onPlay, onPause, onNext, onPrev });
  useEffect(() => {
    cb.current = { onPlay, onPause, onNext, onPrev };
  });

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => cb.current.onPlay());
    ms.setActionHandler('pause', () => cb.current.onPause());
    ms.setActionHandler('previoustrack', () => cb.current.onPrev());
    ms.setActionHandler('nexttrack', hasNext ? () => cb.current.onNext() : null);
    return () => {
      for (const a of ['play', 'pause', 'previoustrack', 'nexttrack'] as const) ms.setActionHandler(a, null);
    };
  }, [hasNext]);
}
