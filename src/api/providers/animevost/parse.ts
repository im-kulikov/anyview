import type { Episode, Image, Rating, Tag, TitleFormat, TitleStatus, EpisodeCounter } from '../../contract';
import { https } from '../../../lib/https';
import { IMAGE_ORIGIN } from './urls';

export interface RawItem {
  id: number | string;
  title: string;
  description?: string;
  genre?: string;
  year?: number | string;
  type?: string;
  director?: string;
  urlImagePreview?: string;
  screenImage?: string[];
  rating?: number | string;
  votes?: number | string;
}

export interface RawPlaylistItem {
  name: string;
  hd?: string;
  std?: string;
  preview?: string;
}

export interface ParsedTitle {
  name: string;
  originalName?: string;
  episodes?: EpisodeCounter;
  nextEpisode?: { number: number; airDate?: string };
}

const MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

const COUNTER = /^(?:[A-Za-zА-Яа-яЁё]+\s+)?(\d+)(?:-(\d+))?\s+из\s+(\d+)(\+)?$/;
const NEXT = /^(\d+)\s+серия\s*-\s*(.+)$/i;
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Год выбирается так, чтобы дата попала в окно [now − 30 дн; now + 335 дн]. */
export function resolveAirDate(day: number, month: number, now: Date): string | undefined {
  const y = now.getFullYear();
  for (const year of [y, y + 1, y - 1]) {
    const t = Date.UTC(year, month - 1, day);
    const d = new Date(t);
    if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined; // 31 февраля и т. п.
    const base = Date.UTC(y, now.getMonth(), now.getDate());
    if (t >= base - 30 * DAY && t <= base + 335 * DAY) return `${year}-${pad(month)}-${pad(day)}`;
  }
  return undefined;
}

export function parseTitle(title: string, now: Date = new Date()): ParsedTitle {
  const brackets = [...title.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1].trim());
  const sep = title.indexOf(' / ');
  const cut = (s: string) => {
    const i = s.indexOf('[');
    return (i >= 0 ? s.slice(0, i) : s).trim();
  };
  const name = cut(sep >= 0 ? title.slice(0, sep) : title);
  const originalName = sep >= 0 ? cut(title.slice(sep + 3)) || undefined : undefined;

  let episodes: EpisodeCounter | undefined;
  for (const b of brackets) {
    const m = COUNTER.exec(b);
    if (m) {
      episodes = { released: Number(m[2] ?? m[1]), total: Number(m[3]) };
      if (m[4]) episodes.totalIsEstimate = true;
      break;
    }
  }

  let nextEpisode: ParsedTitle['nextEpisode'];
  for (const b of brackets) {
    const m = NEXT.exec(b);
    if (!m) continue;
    nextEpisode = { number: Number(m[1]) };
    const d = /^(\d{1,2})\s+([а-яё]+)$/i.exec(m[2].trim());
    const month = d && MONTHS[d[2].toLowerCase()];
    if (d && month) {
      const airDate = resolveAirDate(Number(d[1]), month, now);
      if (airDate) nextEpisode.airDate = airDate;
    }
    break;
  }
  return { name, originalName, episodes, nextEpisode };
}

export function statusOf(c?: EpisodeCounter): TitleStatus {
  if (!c) return 'unknown';
  return c.total !== undefined && c.released >= c.total && !c.totalIsEstimate ? 'released' : 'ongoing';
}

const FORMATS: Record<string, TitleFormat> = {
  'тв': 'tv',
  'полнометражный фильм': 'movie',
  'короткометражный фильм': 'short',
  'ona': 'ona',
  'ova': 'ova',
  'ова': 'ova',
  'тв-спэшл': 'special',
  'тв-спешл': 'special',
  'спешл': 'special',
};

export const formatOf = (type?: string): TitleFormat =>
  FORMATS[(type ?? '').trim().toLowerCase()] ?? 'unknown';

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…',
};

const codePoint = (cp: number, fallback: string) =>
  Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : fallback;

/** HTML описания → плоский текст без DOM. */
export function htmlToText(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>[ \t]*\n?/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)\s*>/gi, '\n') // конец блока — перенос строки
    .replace(/<\/?[a-z][^>]*>/gi, '') // «5 < 6 > 3» не тег
    .replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (all, dec, hex, name) => {
      if (dec) return codePoint(Number(dec), all);
      if (hex) return codePoint(parseInt(hex, 16), all);
      return ENTITIES[name.toLowerCase()] ?? all;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Сумма баллов 1–5 → шкала 0–10; при votes < 5 рейтинга нет. */
export function ratingOf(rating: unknown, votes: unknown): Rating | undefined {
  const r = Number(rating);
  const v = Number(votes);
  if (!Number.isFinite(r) || !Number.isFinite(v) || v < 5) return undefined;
  const value = Math.min(10, Math.round((r / v) * 2 * 10) / 10);
  return value > 0 ? { source: 'animevost', value, votes: v } : undefined;
}

export function genresOf(genre?: string): Tag[] {
  return (genre ?? '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => ({ id: g.toLowerCase(), name: g[0].toUpperCase() + g.slice(1) }));
}

/** Картинка animevost → абсолютный https (относительные пути — от хоста постеров); негодный адрес — без картинки. */
const imageOf = (url: string | null | undefined, base: string = IMAGE_ORIGIN): Image | undefined => {
  const abs = url ? https(url, base) : undefined;
  return abs ? { url: abs } : undefined;
};

export const posterOf = (raw: RawItem): Image | undefined => imageOf(raw.urlImagePreview);

export function backdropOf(raw: RawItem): Image | undefined {
  const path = (raw.screenImage ?? []).find((s) => typeof s === 'string' && s.trim());
  if (!path) return undefined;
  return imageOf(path, posterOf(raw)?.url);
}

const firstNumber = (s: string) => {
  const m = /\d+/.exec(s);
  return m ? Number(m[0]) : undefined;
};

export const videoIdOf = (p: RawPlaylistItem): string | undefined =>
  /(\d+)\.mp4/.exec(p.std ?? '')?.[1] ?? /(\d+)\.mp4/.exec(p.hd ?? '')?.[1];

/** Сортировка по первому числу в имени; без числа — в конец в исходном порядке. */
export function sortPlaylist<T extends { name: string }>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i, n: firstNumber(it.name) }))
    .sort((a, b) => (a.n ?? Infinity) - (b.n ?? Infinity) || a.i - b.i)
    .map((x) => x.it);
}

/** Серии плейлиста с уникальными id: повтор videoId получает суффикс -2, -3… (sources() ищет по тем же id). */
export function episodesOf(rawId: string, titleId: string, list: RawPlaylistItem[]): Episode[] {
  const seen = new Map<string, number>();
  return list.map((p, i) => {
    const e = episodeOf(rawId, titleId, p, i);
    const n = (seen.get(e.id) ?? 0) + 1;
    seen.set(e.id, n);
    return n === 1 ? e : { ...e, id: `${e.id}-${n}` };
  });
}

export function episodeOf(rawId: string, titleId: string, p: RawPlaylistItem, index: number): Episode {
  const videoId = videoIdOf(p) ?? `i${index}`;
  const number = firstNumber(p.name);
  return {
    id: `av-${rawId}-${videoId}`,
    titleId,
    season: 1,
    ...(number !== undefined && { number }),
    name: p.name,
    ...(imageOf(p.preview) && { preview: imageOf(p.preview) }),
    available: true,
  };
}
