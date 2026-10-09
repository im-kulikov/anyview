import type { Stream } from '../../api/contract';
import { isWatched } from '../../lib/storage';

/** Позиция не больше порога (с) — серия «не начата»: ни «Продолжить», ни возобновления (SPEC §5.4). Единый порог для плеера, CTA и pickEpisode. */
export const RESUME_MIN = 5;
/** Пауза между автосохранениями позиции (SPEC §5.5). */
export const SAVE_MS = 5000;
/** Через сколько скрывать контролы при бездействии. */
export const HIDE_MS = 3000;
/** Обратный отсчёт до автоперехода, с. */
export const COUNTDOWN_S = 5;

type Pos = { position: number; duration: number };

/** Серия начата и не досмотрена: можно продолжить. */
export const isResumable = (p?: Pos): p is Pos => !!p && p.position > RESUME_MIN && !isWatched(p);

/** Откуда начинать воспроизведение, с. */
export const resumeFrom = (p?: Pos): number => (isResumable(p) ? p.position : 0);

/** Доля 0–100 для ширины полос; без длительности — 0. */
export const percent = (x: number, duration: number): number => (duration > 0 ? Math.min(100, Math.max(0, (x / duration) * 100)) : 0);

/** Конец последнего буферизованного диапазона. */
export const bufferedEnd = (r: { length: number; end(i: number): number }): number => (r.length ? r.end(r.length - 1) : 0);

/** Шаг громкости 0.1 без накопления погрешности. */
export const stepVolume = (cur: number, delta: number): number => Math.min(1, Math.max(0, Math.round((cur + delta) * 10) / 10));

export type EndedAction = 'none' | 'countdown' | 'next';

/** Что делать, когда серия доиграла: нативный полный экран iPhone без оверлеев — сразу дальше, иначе отсчёт с «Отменой». */
export function endedAction(o: { hasNext: boolean; autoNext: boolean; nativeFullscreen: boolean }): EndedAction {
  if (!o.hasNext || !o.autoNext) return 'none';
  return o.nativeFullscreen ? 'next' : 'countdown';
}

export type ErrorAction = 'alt' | 'fail';

/** Ошибка видео: один раз пробуем другое качество с той же позиции, затем экран ошибки. */
export function errorAction(o: { hasEpisode: boolean; hasAlt: boolean; triedAlt: boolean }): ErrorAction {
  return o.hasEpisode && o.hasAlt && !o.triedAlt ? 'alt' : 'fail';
}

/** Счётчик запросов: поздний ответ сети не перебивает более новый выбор серии («последний клик выигрывает»). */
export function createRequestGate() {
  let n = 0;
  return {
    /** Новый запрос; старые перестают быть актуальными. */
    next: () => ++n,
    /** Отменить все ожидающие запросы. */
    invalidate: () => void ++n,
    isCurrent: (id: number) => id === n,
  };
}

export type Engine = 'native' | 'unsupported';

/**
 * Заготовка под Stream.kind (ARCH-07): сегодня играем только прямые файлы через <video src>.
 * hls (нативно в Safari / hls.js отдельным чанком), dash и iframe — фаза 2; сюда добавляется их движок.
 */
export function engineFor(stream: Pick<Stream, 'kind'> | undefined): Engine {
  return stream?.kind === 'file' ? 'native' : 'unsupported';
}
