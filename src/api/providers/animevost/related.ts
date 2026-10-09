import type { RelatedTitles, SeasonLink, TitleSummary } from '../../contract';

/**
 * Связи тайтлов из одного поиска API (сервера у нас нет — правила эвристические, ADR-29).
 * Русский маркер сезона авторитетен; номер из оригинального названия не используется (цифры в конце — часть названия).
 */

/** Маркеры русского названия: сезон («второй сезон», «2-й сезон»), фильм, спецвыпуск/спэшл (в одном случае латинская c). */
const MARKERS = /\s*\((?:[а-яё]+\s+сезон|\d+\s*-?\s*й?\s*сезон|фильм[^)]*|спецвыпуск[^)]*|спэшл[^)]*|[cс]пэшлы)\)/gi;
const KIND = /\((?:фильм[^)]*|спецвыпуск[^)]*|спэшл[^)]*|[cс]пэшлы)\)/i;
const SEASON_WORD = /\(([а-яё]+)\s+сезон\)/i;
const SEASON_NUM = /\((\d+)\s*-?\s*й?\s*сезон\)/i;
const ORDINALS: Record<string, number> = {
  первый: 1, второй: 2, третий: 3, четвертый: 4, четвёртый: 4, пятый: 5, шестой: 6,
  седьмой: 7, восьмой: 8, девятый: 9, десятый: 10, одиннадцатый: 11, двенадцатый: 12,
};
/** Подзаголовок: «:», « - », « — », «. ». */
const SUBTITLE = /\s*:\s*|\s+[—–-]\s+|\.\s+/;

export const MIN_QUERY = 4;
export const MAX_SIMILAR = 40;

/** Регистр, ё→е, пунктуация и литеральные `\` перед кавычками → пробелы, пробелы схлопнуты. */
export function normTitle(s: string): string {
  return s.replace(/\\/g, '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}_\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Русское название без маркеров сезона, фильма и спэшла. */
export const baseName = (ru: string): string => ru.replace(/\\/g, '').replace(MARKERS, '').trim();

/** «Голова» — часть базового названия до первого подзаголовка. */
export const headName = (base: string): string => base.split(SUBTITLE)[0].trim();

/** Номер сезона по русскому маркеру; нет маркера — undefined. */
export function seasonMarker(ru: string): number | undefined {
  const w = SEASON_WORD.exec(ru);
  if (w && ORDINALS[w[1].toLowerCase()]) return ORDINALS[w[1].toLowerCase()];
  const n = SEASON_NUM.exec(ru);
  return n ? Number(n[1]) : undefined;
}

export const hasKindMarker = (ru: string): boolean => KIND.test(ru);

/**
 * Текст запроса: «голова» (если ≥ 4 символов), иначе база. Кавычки в API лежат экранированными (`\"`), поэтому
 * берём самый длинный кусок без них: подстрока найдётся в любом написании.
 */
export function relatedQuery(name: string): string {
  const base = baseName(name);
  const head = headName(base);
  const q = head.length >= MIN_QUERY ? head : base;
  return q.split(/["'`«»]+/).reduce((a, b) => (b.trim().length > a.trim().length ? b : a), '').trim();
}

const SEASON_FORMATS = new Set(['tv', 'ona']);
const numId = (t: TitleSummary) => Number(t.id.replace(/\D/g, ''));
const byYearId = (a: TitleSummary, b: TitleSummary) => (a.year ?? 0) - (b.year ?? 0) || numId(a) - numId(b);

/**
 * Классификация результатов поиска относительно текущего тайтла.
 * Кандидаты — совпадающая «голова» или база, начинающаяся с неё. Сезоны — та же база, формат ТВ/ONA, без маркеров
 * фильма/спэшла; дубль номера (ремейки) уходит в «Похожие». Текущий тайтл в «Похожие» не попадает.
 */
export function classifyRelated(current: TitleSummary, results: TitleSummary[]): RelatedTitles {
  const all = results.some((r) => r.id === current.id) ? results : [current, ...results];
  const cur = baseName(current.name);
  const B = normTitle(cur);
  const H = normTitle(headName(cur));
  const byNumber = new Map<number, TitleSummary[]>();
  const similar: TitleSummary[] = [];
  for (const x of all) {
    const base = baseName(x.name);
    const bx = normTitle(base);
    if (normTitle(headName(base)) !== H && !bx.startsWith(`${H} `)) continue;
    if (bx === B && !hasKindMarker(x.name) && SEASON_FORMATS.has(x.format)) {
      const n = seasonMarker(x.name) ?? 1;
      byNumber.set(n, [...(byNumber.get(n) ?? []), x]);
    } else similar.push(x);
  }
  const seasons: SeasonLink[] = [];
  for (const n of [...byNumber.keys()].sort((a, b) => a - b)) {
    const [t, ...dups] = byNumber.get(n)!;
    if (dups.length) similar.push(t, ...dups);
    else seasons.push({ id: t.id, number: n, label: `${n} сезон`, ...(t.year && { year: t.year }), current: t.id === current.id });
  }
  return { seasons, similar: similar.filter((x) => x.id !== current.id).sort(byYearId).slice(0, MAX_SIMILAR) };
}
