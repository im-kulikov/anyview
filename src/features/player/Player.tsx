import { forwardRef, useCallback, useEffect, useImperativeHandle, useReducer, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Play, SkipBack, SkipForward } from 'lucide-react';
import type { Episode, Source, Title } from '../../api/contract';
import { useSources } from '../../api/hooks';
import { keys, STALE } from '../../api/keys';
import { provider } from '../../api/index';
import { S } from '../../lib/strings';
import { formatTime } from '../../lib/format';
import { getPrefs, progressStore, resetProgress, saveProgress, setPrefs, useStore, usePrefs } from '../../lib/storage';
import { Controls } from './Controls';
import { EpisodePanel } from './EpisodePanel';
import { nextEpisode, prevEpisode } from './pickEpisode';
import { chooseSource } from './chooseSource';
import { bufferedEnd, createRequestGate, endedAction, engineFor, errorAction, HIDE_MS, resumeFrom, SAVE_MS, stepVolume } from './playerModel';
import { initialPlayback, playbackReducer } from './playerReducer';
import type { KeyAction } from './hotkeys';
import { useHotkeys } from './useHotkeys';
import { useMediaSession } from './useMediaSession';
import styles from './Player.module.css';

export interface PlayerHandle {
  /** Запуск серии. Вызывать синхронно из обработчика касания (iOS Safari). */
  play(ep: Episode): void;
  current(): Source | undefined;
}

interface Props {
  title: Title;
  episodes: Episode[];
  current: Episode;
  onSelect(ep: Episode): void;
  onSourceChange(s: Source | undefined): void;
}

type VideoEl = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };

export const Player = forwardRef<PlayerHandle, Props>(function Player({ title, episodes, current, onSelect, onSourceChange }, ref) {
  const qc = useQueryClient();
  const prefs = usePrefs();
  const progress = useStore(progressStore);
  const videoRef = useRef<VideoEl>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadedEp = useRef<string | null>(null);
  const loadedSource = useRef<Source | undefined>(undefined);
  const pendingSeek = useRef(0);
  const lastSave = useRef(0);
  const [gate] = useState(createRequestGate); // последний запрос запуска серии выигрывает: поздний ответ сети не перебивает новый выбор
  const pointerType = useRef('');
  const hideTimer = useRef<number>(undefined);
  const latest = useRef({ title, episodes, current });
  useEffect(() => {
    latest.current = { title, episodes, current };
  });

  const [pb, dispatch] = useReducer(playbackReducer, initialPlayback);
  const { started, playing, failed, countdown, loading } = pb;
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [source, setSource] = useState<Source | undefined>();
  const [panel, setPanel] = useState(false);

  const next = nextEpisode(episodes, current.id);
  const prev = prevEpisode(episodes, current.id);
  const srcQ = useSources(current.id);
  useSources(next?.id); // следующая серия подгружается заранее (SPEC §5.4)

  const persist = useCallback((force = false, el: VideoEl | null = videoRef.current) => {
    const v = el;
    const id = loadedEp.current;
    if (!v || !id || !v.duration || v.currentTime === 0) return;
    const now = Date.now();
    if (!force && now - lastSave.current < SAVE_MS) return;
    lastSave.current = now;
    const { title: t, episodes: list } = latest.current;
    const ep = list.find((e) => e.id === id);
    if (ep) saveProgress({ title: t, episode: ep, next: nextEpisode(list, id), position: v.currentTime, duration: v.duration });
  }, []);

  const bump = useCallback(() => {
    setUiVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      // Контролы не прячем, пока на них клавиатурный фокус (SPEC §9).
      if (videoRef.current && !videoRef.current.paused && !wrapRef.current?.querySelector(':focus-visible')) setUiVisible(false);
    }, HIDE_MS);
  }, []);

  const loadSource = useCallback((ep: Episode, s: Source, seek: number, autoplay: boolean, alt = false) => {
    const v = videoRef.current;
    if (!v || !s.stream || engineFor(s.stream) !== 'native') return;
    persist(true);
    gate.invalidate();
    pendingSeek.current = seek;
    loadedEp.current = ep.id;
    loadedSource.current = s;
    setSource(s);
    onSourceChange(s);
    dispatch({ type: 'load', alt });
    v.src = s.stream.url;
    if (autoplay) v.play().catch(() => dispatch({ type: 'playRejected' }));
  }, [persist, gate, onSourceChange]);

  const playEpisode = useCallback((ep: Episode) => {
    if (!ep.available) return;
    const seek = resumeFrom(progressStore.get()[ep.id]);
    const my = gate.next();
    onSelect(ep);
    const cached = qc.getQueryData<Source[]>(keys.sources(ep.id));
    const go = (list: Source[]) => {
      const s = chooseSource(list, getPrefs().quality);
      if (s) loadSource(ep, s, seek, true);
      else dispatch({ type: 'fail' });
    };
    // Синхронный путь — источники уже загружены; иначе ждём сеть (на iOS элемент к этому моменту уже «разблокирован»).
    if (cached) go(cached);
    else qc.fetchQuery({ queryKey: keys.sources(ep.id), queryFn: ({ signal }) => provider.sources(ep.id, signal), staleTime: STALE.item }).then((list) => { if (gate.isCurrent(my)) go(list); }, () => { if (gate.isCurrent(my)) dispatch({ type: 'fail' }); });
  }, [qc, gate, onSelect, loadSource]);

  useImperativeHandle(ref, () => ({ play: playEpisode, current: () => loadedSource.current }), [playEpisode]);

  // Серия сменилась снаружи (не нашим обработчиком) — сбрасываем видео до постера.
  useEffect(() => {
    const v = videoRef.current;
    if (v && loadedEp.current && loadedEp.current !== current.id) {
      persist(true);
      gate.invalidate();
      v.pause();
      v.removeAttribute('src');
      v.load();
      loadedEp.current = null;
      loadedSource.current = undefined;
      dispatch({ type: 'reset' });
      setSource(undefined);
      onSourceChange(undefined);
      setTime(0);
      setDuration(0);
      setBuffered(0);
    }
  }, [current.id, persist, gate, onSourceChange]);

  // Громкость из настроек.
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = prefs.volume;
      v.muted = prefs.muted;
    }
  }, [prefs.volume, prefs.muted]);

  // Сохранение позиции при уходе на другую вкладку и со страницы; состояние полного экрана.
  useEffect(() => {
    const v = videoRef.current; // в cleanup ref уже null: элемент запоминаем заранее
    const onHide = () => document.visibilityState === 'hidden' && persist(true);
    document.addEventListener('visibilitychange', onHide);
    const onPageHide = () => persist(true);
    window.addEventListener('pagehide', onPageHide);
    const onFs = () => setIsFs(!!(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      persist(true, v);
      window.clearTimeout(hideTimer.current);
    };
  }, [persist]);

  // Автопереход: обратный отсчёт.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      dispatch({ type: 'cancelCountdown' });
      if (next) playEpisode(next);
      return;
    }
    const t = window.setTimeout(() => dispatch({ type: 'tick' }), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, next, playEpisode]);

  const startPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!loadedEp.current) playEpisode(latest.current.current);
    else v.play().catch(() => dispatch({ type: 'playRejected' }));
  }, [playEpisode]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (v && loadedEp.current && !v.paused) v.pause();
    else startPlay();
  }, [startPlay]);

  const seekBy = useCallback((d: number) => {
    const v = videoRef.current;
    if (v && v.duration) v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + d));
  }, []);

  const seekTo = useCallback((s: number) => {
    if (videoRef.current) videoRef.current.currentTime = s;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current;
    const wrap = wrapRef.current;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (wrap?.requestFullscreen && document.fullscreenEnabled) void wrap.requestFullscreen();
    else v?.webkitEnterFullscreen?.(); // iPhone: нативный полный экран со своими контролами
  }, []);

  const goNext = useCallback(() => {
    const n = nextEpisode(latest.current.episodes, latest.current.current.id);
    if (n) playEpisode(n);
  }, [playEpisode]);

  const goPrev = useCallback(() => {
    const q = prevEpisode(latest.current.episodes, latest.current.current.id);
    if (q) playEpisode(q);
  }, [playEpisode]);

  useHotkeys(wrapRef, videoRef, (a: KeyAction) => {
    const v = videoRef.current;
    if (a.type === 'toggle') togglePlay();
    else if (a.type === 'seek') seekBy(a.delta);
    else if (a.type === 'volume' && v) setPrefs(a.delta > 0 ? { volume: stepVolume(v.volume, a.delta), muted: false } : { volume: stepVolume(v.volume, a.delta) });
    else if (a.type === 'fullscreen') toggleFullscreen();
    else if (a.type === 'mute' && v) setPrefs({ muted: !v.muted });
    else if (a.type === 'next') goNext();
    bump();
  });

  const closePanel = useCallback(() => setPanel(false), []);
  const pauseVideo = useCallback(() => videoRef.current?.pause(), []);
  useMediaSession({ title, episode: current, hasNext: !!next, onPlay: startPlay, onPause: pauseVideo, onNext: goNext, onPrev: goPrev });

  const onError = () => {
    const ep = episodes.find((e) => e.id === loadedEp.current);
    const other = srcQ.data?.find((s) => s.id !== loadedSource.current?.id && s.stream);
    if (ep && other && errorAction({ hasEpisode: true, hasAlt: true, triedAlt: pb.triedAlt }) === 'alt') {
      loadSource(ep, other, videoRef.current?.currentTime || pendingSeek.current, true, true);
    } else {
      dispatch({ type: 'fail' });
    }
  };

  const retry = () => {
    const ep = episodes.find((e) => e.id === loadedEp.current) ?? current;
    const s = loadedSource.current ?? chooseSource(srcQ.data ?? [], getPrefs().quality);
    if (s) loadSource(ep, s, videoRef.current?.currentTime || resumeFrom(progressStore.get()[ep.id]), true);
    else playEpisode(ep);
  };

  const changeQuality = (height: number) => {
    setPrefs({ quality: height <= 480 ? 'sd' : 'hd' });
    const v = videoRef.current;
    const ep = episodes.find((e) => e.id === loadedEp.current);
    const s = srcQ.data?.find((x) => x.quality.height === height);
    if (v && ep && s && s.id !== loadedSource.current?.id) loadSource(ep, s, v.currentTime, !v.paused);
  };

  const savedHere = started ? 0 : resumeFrom(progress[current.id]);
  const showBig = !playing && !failed && countdown === null && !loading;
  const controlsHidden = playing && !uiVisible && scrub === null;
  const pipOk = typeof document !== 'undefined' && document.pictureInPictureEnabled;
  const qualities = srcQ.data?.filter((s) => s.stream) ?? [];

  return (
    <div className={styles.block}>
      <div
        ref={wrapRef}
        className={`${styles.player} ${controlsHidden ? styles.idle : ''}`}
        onPointerMove={bump}
        onPointerDown={(e) => { pointerType.current = e.pointerType; if (e.pointerType === 'touch') bump(); }}
        onFocusCapture={bump}
        onKeyDown={bump}
      >
        <video
          ref={videoRef}
          className={styles.video}
          playsInline
          preload="none"
          poster={current.preview?.url}
          onClick={() => {
            // На тач-экране первое касание показывает контролы, второе — пауза.
            if (pointerType.current === 'touch' && controlsHidden) bump();
            else togglePlay();
          }}
          onPlay={() => { dispatch({ type: 'play' }); bump(); }}
          onPlaying={() => dispatch({ type: 'ready' })}
          onCanPlay={() => dispatch({ type: 'ready' })}
          onWaiting={() => dispatch({ type: 'waiting' })}
          onPause={() => { dispatch({ type: 'pause' }); setUiVisible(true); persist(true); }}
          onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); persist(); }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            if (pendingSeek.current > 0) { v.currentTime = Math.min(pendingSeek.current, v.duration - 1); pendingSeek.current = 0; }
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onProgress={(e) => setBuffered(bufferedEnd(e.currentTarget.buffered))}
          onVolumeChange={(e) => setPrefs({ volume: e.currentTarget.volume, muted: e.currentTarget.muted })}
          onError={onError}
          onEnded={() => {
            persist(true);
            const action = endedAction({ hasNext: !!next, autoNext: prefs.autoNext, nativeFullscreen: !!videoRef.current?.webkitDisplayingFullscreen });
            dispatch({ type: 'ended', action });
            if (action === 'next' && next) playEpisode(next); // нативный полный экран iPhone: оверлеев нет
          }}
        />

        {savedHere > 0 && (
          <div className={styles.resume}>
            {S.player.resume(formatTime(savedHere))} ·{' '}
            <button type="button" onClick={() => resetProgress(current.id)}>{S.player.fromStart}</button>
          </div>
        )}

        {showBig && (
          <button type="button" className={styles.big} aria-label={S.player.play} onClick={togglePlay}>
            <Play size={28} fill="currentColor" aria-hidden="true" />
          </button>
        )}

        {loading && !failed && countdown === null && (
          <div className={styles.spinner} role="status" aria-label={S.player.loading} />
        )}

        {failed && (
          <div className={styles.overlay} role="alert">
            <p>{S.player.failed}</p>
            <button type="button" className={styles.overlayBtn} onClick={retry}>{S.common.retry}</button>
          </div>
        )}

        {countdown !== null && (
          <div className={styles.overlay} role="status">
            <p>{S.player.nextIn(countdown)}</p>
            <button type="button" className={styles.overlayBtn} onClick={() => dispatch({ type: 'cancelCountdown' })}>{S.player.cancel}</button>
          </div>
        )}

        <Controls
          playing={playing}
          time={time}
          duration={duration}
          buffered={buffered}
          scrub={scrub}
          onScrub={setScrub}
          onSeekTo={seekTo}
          onSeekBy={seekBy}
          prefs={prefs}
          hasPrev={!!prev}
          hasNext={!!next}
          onPrev={() => prev && playEpisode(prev)}
          onNext={goNext}
          onToggle={togglePlay}
          source={source}
          panelOpen={panel}
          onTogglePanel={() => setPanel((v) => !v)}
          pipOk={pipOk}
          onPip={() => void (document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture())}
          isFs={isFs}
          onFullscreen={toggleFullscreen}
        />

        {panel && <EpisodePanel title={title} episodes={episodes} currentId={current.id} onPick={playEpisode} onClose={closePanel} />}
      </div>

      <div className={styles.under}>
        {qualities.length > 1 && (
          <div role="group" aria-label={S.player.quality} className={styles.seg}>
            {qualities.map((s) => {
              const on = (source ?? chooseSource(qualities, getPrefs().quality))?.id === s.id;
              return (
                <button key={s.id} type="button" aria-pressed={on} className={on ? styles.segOn : ''} onClick={() => s.quality.height && changeQuality(s.quality.height)}>
                  {s.quality.label} {s.quality.height}p
                </button>
              );
            })}
          </div>
        )}
        <span className={styles.spacer} />
        <button type="button" className={styles.round} aria-label={S.player.prev} disabled={!prev} onClick={() => prev && playEpisode(prev)}>
          <SkipBack size={18} aria-hidden="true" />
        </button>
        <button type="button" className={styles.round} aria-label={S.player.next} disabled={!next} onClick={goNext}>
          <SkipForward size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});
