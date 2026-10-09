import { useEffect } from 'react';
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

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', onPlay);
    ms.setActionHandler('pause', onPause);
    ms.setActionHandler('previoustrack', onPrev);
    ms.setActionHandler('nexttrack', hasNext ? onNext : null);
    return () => {
      for (const a of ['play', 'pause', 'previoustrack', 'nexttrack'] as const) ms.setActionHandler(a, null);
    };
  }, [hasNext, onPlay, onPause, onNext, onPrev]);
}
