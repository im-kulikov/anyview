import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListVideo, Maximize, Minimize, Pause, PictureInPicture2, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import type { Episode, Source, Title } from '../../api/contract';
import { useSources } from '../../api/hooks';
import { keys, STALE } from '../../api/keys';
import { provider } from '../../api/index';
import { S } from '../../lib/strings';
import { formatTime } from '../../lib/format';
import { getPrefs, isWatched, progressStore, resetProgress, saveProgress, setPrefs, useStore, usePrefs } from '../../lib/storage';
import { EpisodeList } from './EpisodeList';
import { nextEpisode, prevEpisode } from './pickEpisode';
import { chooseSource } from './chooseSource';
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

const savedPos = (ep: Episode) => {
  const p = progressStore.get()[ep.id];
  return p && p.position > 5 && !isWatched(p) ? p.position : 0;
};

type VideoEl = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };

const HIDE_MS = 3000;
const SAVE_MS = 5000;

export const Player = forwardRef<PlayerHandle, Props>(function Player({ title, episodes, current, onSelect, onSourceChange }, ref) {
  const qc = useQueryClient();
  const prefs = usePrefs();
  const progress = useStore(progressStore);
  const videoRef = useRef<VideoEl>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const loadedEp = useRef<string | null>(null);
  const loadedSource = useRef<Source | undefined>(undefined);
  const pendingSeek = useRef(0);
  const lastSave = useRef(0);
  const triedAlt = useRef(false);
  const req = useRef(0); // номер последнего запроса запуска серии: поздний ответ сети не перебивает новый выбор
  const pointerType = useRef('');
  const hideTimer = useRef<number>(undefined);
  const latest = useRef({ title, episodes, current });
  useEffect(() => {
    latest.current = { title, episodes, current };
  });

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const [uiVisible, setUiVisible] = useState(true);
  const [failed, setFailed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFs, setIsFs] = useState(false);
  const [source, setSource] = useState<Source | undefined>();
  const [panel, setPanel] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const loadSource = useCallback((ep: Episode, s: Source, seek: number, autoplay: boolean) => {
    const v = videoRef.current;
    if (!v || !s.stream) return;
    persist(true);
    req.current++;
    pendingSeek.current = seek;
    loadedEp.current = ep.id;
    loadedSource.current = s;
    triedAlt.current = false;
    setSource(s);
    onSourceChange(s);
    setStarted(true);
    setFailed(false);
    setCountdown(null);
    setLoading(true);
    v.src = s.stream.url;
    if (autoplay) v.play().catch(() => setPlaying(false));
  }, [persist, onSourceChange]);

  const playEpisode = useCallback((ep: Episode) => {
    if (!ep.available) return;
    const seek = savedPos(ep);
    const my = ++req.current;
    onSelect(ep);
    const cached = qc.getQueryData<Source[]>(keys.sources(ep.id));
    const go = (list: Source[]) => {
      const s = chooseSource(list, getPrefs().quality);
      if (s) loadSource(ep, s, seek, true);
      else setFailed(true);
    };
    // Синхронный путь — источники уже загружены; иначе ждём сеть (на iOS элемент к этому моменту уже «разблокирован»).
    if (cached) go(cached);
    else qc.fetchQuery({ queryKey: keys.sources(ep.id), queryFn: ({ signal }) => provider.sources(ep.id, signal), staleTime: STALE.item }).then((list) => { if (my === req.current) go(list); }, () => { if (my === req.current) setFailed(true); });
  }, [qc, onSelect, loadSource]);

  useImperativeHandle(ref, () => ({ play: playEpisode, current: () => loadedSource.current }), [playEpisode]);

  // Серия сменилась снаружи (не нашим обработчиком) — сбрасываем видео до постера.
  useEffect(() => {
    const v = videoRef.current;
    if (v && loadedEp.current && loadedEp.current !== current.id) {
      persist(true);
      req.current++;
      v.pause();
      v.removeAttribute('src');
      v.load();
      loadedEp.current = null;
      loadedSource.current = undefined;
      setStarted(false);
      setPlaying(false);
      setSource(undefined);
      onSourceChange(undefined);
      setTime(0);
      setDuration(0);
      setBuffered(0);
      setFailed(false);
      setCountdown(null);
      setLoading(false);
    }
  }, [current.id, persist, onSourceChange]);

  // Громкость из настроек.
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = prefs.volume;
      v.muted = prefs.muted;
    }
  }, [prefs.volume, prefs.muted]);

  // Сохранение позиции при уходе на другую вкладку и со страницы.
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
      setCountdown(null);
      if (next) playEpisode(next);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? c : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, next, playEpisode]);

  const startPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!loadedEp.current) playEpisode(latest.current.current);
    else v.play().catch(() => setPlaying(false));
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

  // Клавиатура (десктоп). Не срабатывает в полях ввода и на интерактивных элементах.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const interactive = !!t?.closest('button, a, [role="slider"]');
      const v = videoRef.current;
      // Клавиши плеера — только при фокусе внутри него или пока играет видео: иначе пробел и стрелки прокручивают страницу.
      const inPlayer = !!t && !!wrapRef.current?.contains(t);
      if (!inPlayer && !(v && !v.paused && (t === document.body || !t))) return;
      const key = e.key.toLowerCase();
      if (key === 'n' && e.shiftKey) return goNext();
      if (e.shiftKey) return;
      if ((key === ' ' || key === 'k') && !(interactive && key === ' ')) {
        e.preventDefault();
        togglePlay();
      } else if (key === 'arrowleft' && !interactive) { e.preventDefault(); seekBy(-10); }
      else if (key === 'arrowright' && !interactive) { e.preventDefault(); seekBy(10); }
      else if (key === 'arrowup' && !interactive && v) { e.preventDefault(); setPrefs({ volume: Math.min(1, Math.round((v.volume + 0.1) * 10) / 10), muted: false }); }
      else if (key === 'arrowdown' && !interactive && v) { e.preventDefault(); setPrefs({ volume: Math.max(0, Math.round((v.volume - 0.1) * 10) / 10) }); }
      else if (key === 'f') toggleFullscreen();
      else if (key === 'm' && v) setPrefs({ muted: !v.muted });
      else return;
      bump();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, seekBy, toggleFullscreen, goNext, bump]);

  const goPrev = useCallback(() => {
    const q = prevEpisode(latest.current.episodes, latest.current.current.id);
    if (q) playEpisode(q);
  }, [playEpisode]);
  const pauseVideo = useCallback(() => videoRef.current?.pause(), []);
  useMediaSession({ title, episode: current, hasNext: !!next, onPlay: startPlay, onPause: pauseVideo, onNext: goNext, onPrev: goPrev });

  const onError = () => {
    const ep = episodes.find((e) => e.id === loadedEp.current);
    const list = srcQ.data;
    const other = list?.find((s) => s.id !== loadedSource.current?.id && s.stream);
    if (ep && other && !triedAlt.current) {
      const v = videoRef.current;
      const pos = v?.currentTime || pendingSeek.current;
      loadSource(ep, other, pos, true);
      triedAlt.current = true; // loadSource сбрасывает флаг, поэтому ставим после
    } else {
      setFailed(true);
      setPlaying(false);
      setLoading(false);
    }
  };

  const retry = () => {
    const ep = episodes.find((e) => e.id === loadedEp.current) ?? current;
    const s = loadedSource.current ?? chooseSource(srcQ.data ?? [], getPrefs().quality);
    if (s) loadSource(ep, s, videoRef.current?.currentTime || savedPos(ep), true);
    else playEpisode(ep);
  };

  const changeQuality = (height: number) => {
    setPrefs({ quality: height <= 480 ? 'sd' : 'hd' });
    const v = videoRef.current;
    const ep = episodes.find((e) => e.id === loadedEp.current);
    const s = srcQ.data?.find((x) => x.quality.height === height);
    if (v && ep && s && s.id !== loadedSource.current?.id) loadSource(ep, s, v.currentTime, !v.paused);
  };

  const pct = (x: number) => (duration ? Math.min(100, (x / duration) * 100) : 0);
  const shownTime = scrub !== null ? scrub * duration : time;
  const p = progress[current.id];
  const savedHere = !started && p && p.position > 5 && !isWatched(p) ? p.position : 0;
  const showBig = !playing && !failed && countdown === null && !loading;
  const controlsHidden = playing && !uiVisible && scrub === null;
  const pipOk = typeof document !== 'undefined' && document.pictureInPictureEnabled;
  const qualities = srcQ.data?.filter((s) => s.stream) ?? [];

  const scrubFrom = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect();
    setScrub(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };

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
          onPlay={() => { setPlaying(true); bump(); }}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onPause={() => { setPlaying(false); setLoading(false); setUiVisible(true); persist(true); }}
          onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); persist(); }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            if (pendingSeek.current > 0) { v.currentTime = Math.min(pendingSeek.current, v.duration - 1); pendingSeek.current = 0; }
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onProgress={(e) => { const b = e.currentTarget.buffered; setBuffered(b.length ? b.end(b.length - 1) : 0); }}
          onVolumeChange={(e) => setPrefs({ volume: e.currentTarget.volume, muted: e.currentTarget.muted })}
          onError={onError}
          onEnded={() => {
            persist(true);
            setPlaying(false);
            setLoading(false);
            if (!next || !prefs.autoNext) return;
            const v = videoRef.current;
            if (v?.webkitDisplayingFullscreen) playEpisode(next); // нативный полный экран iPhone: оверлеев нет
            else setCountdown(5);
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
            <button type="button" className={styles.overlayBtn} onClick={() => setCountdown(null)}>{S.player.cancel}</button>
          </div>
        )}

        <div className={styles.controls} onPointerDown={(e) => e.stopPropagation()}>
          <div
            ref={barRef}
            className={styles.bar}
            role="slider"
            tabIndex={0}
            aria-label={S.player.seek}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration) || 0}
            aria-valuenow={Math.round(shownTime)}
            aria-valuetext={`${formatTime(shownTime)} / ${formatTime(duration)}`}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrubFrom(e); }}
            onPointerMove={(e) => scrub !== null && scrubFrom(e)}
            onPointerUp={() => { if (scrub !== null && videoRef.current && duration) videoRef.current.currentTime = scrub * duration; setScrub(null); }}
            onPointerCancel={() => setScrub(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-10); }
              if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(10); }
            }}
          >
            <div className={styles.track}>
              <div className={styles.buffered} style={{ width: `${pct(buffered)}%` }} />
              <div className={styles.played} style={{ width: `${scrub !== null ? scrub * 100 : pct(time)}%` }} />
              <div className={styles.knob} style={{ left: `${scrub !== null ? scrub * 100 : pct(time)}%` }} />
            </div>
          </div>
          <div className={styles.row}>
            {prev && (
              <button type="button" className={styles.btn} aria-label={S.player.prev} onClick={() => playEpisode(prev)}>
                <SkipBack size={20} fill="currentColor" aria-hidden="true" />
              </button>
            )}
            <button type="button" className={styles.btn} aria-label={playing ? S.player.pause : S.player.play} onClick={togglePlay}>
              {playing ? <Pause size={22} fill="currentColor" aria-hidden="true" /> : <Play size={22} fill="currentColor" aria-hidden="true" />}
            </button>
            {next && (
              <button type="button" className={styles.btn} aria-label={S.player.next} onClick={goNext}>
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
            <span className={styles.time}>{formatTime(shownTime)} / {duration ? formatTime(duration) : '--:--'}</span>
            <span className={styles.spacer} />
            {source && <span className={styles.quality}>{source.quality.label}</span>}
            <button type="button" className={styles.btn} aria-label={S.player.episodes} aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
              <ListVideo size={20} aria-hidden="true" />
            </button>
            {pipOk && (
              <button type="button" className={`${styles.btn} ${styles.pip}`} aria-label={S.player.pip} onClick={() => void (document.pictureInPictureElement ? document.exitPictureInPicture() : videoRef.current?.requestPictureInPicture())}>
                <PictureInPicture2 size={20} aria-hidden="true" />
              </button>
            )}
            <button type="button" className={styles.btn} aria-label={isFs ? S.player.exitFullscreen : S.player.fullscreen} onClick={toggleFullscreen}>
              {isFs ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {panel && (
          // Панель внутри контейнера плеера: видна и в полноэкранном режиме (Fullscreen API: iPad, десктоп).
          <div className={styles.panel} role="dialog" aria-label={S.player.episodes} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && setPanel(false)}>
            <div className={styles.panelHead}>
              <b>{S.player.episodes}</b>
              <button type="button" className={styles.btn} aria-label={S.player.closePanel} autoFocus onClick={() => setPanel(false)}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.panelList}>
              {/* playEpisode вызывается синхронно из клика: iOS разрешает play() только в обработчике касания */}
              <EpisodeList compact title={title} episodes={episodes} currentId={current.id} onPick={(ep) => { playEpisode(ep); setPanel(false); }} />
            </div>
          </div>
        )}
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
