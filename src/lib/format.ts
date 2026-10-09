import type { TitleFormat, TitleStatus, TitleSummary, EpisodeCounter } from '../api/contract';

const RU_PLURAL = new Intl.PluralRules('ru');
const RU_NUMBER = new Intl.NumberFormat('ru');

/** forms: [один, несколько, много] — «серия / серии / серий». */
export function plural(n: number, forms: [string, string, string]): string {
  const c = RU_PLURAL.select(n);
  return c === 'one' ? forms[0] : c === 'few' ? forms[1] : forms[2];
}

export const formatNumber = (n: number) => RU_NUMBER.format(n);

export const titlesWord = (n: number) => plural(n, ['тайтл', 'тайтла', 'тайтлов']);
export const votesWord = (n: number) => plural(n, ['голос', 'голоса', 'голосов']);
export const episodesWord = (n: number) => plural(n, ['серия', 'серии', 'серий']);

const FORMAT_SHORT: Record<TitleFormat, string> = {
  tv: 'ТВ', movie: 'Фильм', short: 'Короткометражка', ova: 'OVA', ona: 'ONA', special: 'Спешл', unknown: '',
};
const FORMAT_LONG: Record<TitleFormat, string> = {
  tv: 'ТВ-сериал', movie: 'Полнометражный фильм', short: 'Короткометражный фильм',
  ova: 'OVA', ona: 'ONA', special: 'ТВ-спешл', unknown: '',
};
const STATUS: Record<TitleStatus, string> = { ongoing: 'Онгоинг', released: 'Вышел', announced: 'Анонс', unknown: '' };

export const formatShort = (f: TitleFormat) => FORMAT_SHORT[f];
export const formatLong = (f: TitleFormat) => FORMAT_LONG[f];
export const statusLabel = (s: TitleStatus) => STATUS[s];

/** «Тип · Год» для карточек. */
export const cardMeta = (t: Pick<TitleSummary, 'format' | 'year'>) =>
  [FORMAT_SHORT[t.format], t.year].filter(Boolean).join(' · ');

export const ratingText = (value: number) => value.toFixed(1);

/** «7 из 12», «1 из 12+», «7». */
export function episodesText(c?: EpisodeCounter): string | undefined {
  if (!c) return undefined;
  if (c.total === undefined) return String(c.released);
  return `${c.released} из ${c.total}${c.totalIsEstimate ? '+' : ''}`;
}

/** 754 с → «12:34», 3 725 с → «1:02:05». */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** «16 октября» из YYYY-MM-DD. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru', { day: 'numeric', month: 'long' });
}
