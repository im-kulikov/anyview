import type { CharacterInfo, TitleDetails } from '../../contract';
import { normTitle } from './related';

/**
 * Сведения из внешних баз (сервера у нас нет — сопоставление делает адаптер, ADR-30).
 * Цепочка: поиск в Shikimori по оригинальному названию + год → карточка (жанры RU, рейтинг, студия, MAL id) →
 * AniList по MAL id (первоисточник, автор, герои с сейю). Только строгое совпадение: лучше пусто, чем чужой тайтл.
 */
export const SHIKIMORI = 'https://shikimori.io/api';
export const ANILIST = 'https://graphql.anilist.co';
export const MAX_CHARACTERS = 6;

export interface ShikiListItem { id: number; name?: string; russian?: string; english?: string[]; synonyms?: string[]; aired_on?: string | null }
export interface ShikiAnime {
  myanimelist_id?: number | null;
  rating?: string | null;
  genres?: { russian?: string; name?: string }[];
  studios?: { filtered_name?: string; name?: string }[];
}
export interface AniListMedia {
  source?: string | null;
  staff?: { edges?: { role?: string; node?: { name?: { full?: string } } }[] };
  characters?: { edges?: { node?: { name?: { full?: string } }; voiceActors?: { name?: { full?: string } }[] }[] };
}

/** Поиск Shikimori по подстроке: выбираем запись, у которой название совпало точно и год ±1. */
export function pickShikimori(list: ShikiListItem[], names: string[], year?: number): ShikiListItem | undefined {
  const want = new Set(names.map(normTitle).filter(Boolean));
  const same = (c: ShikiListItem) =>
    [c.name, c.russian, ...(c.english ?? []), ...(c.synonyms ?? [])].some((n) => n && want.has(normTitle(n)));
  const gap = (c: ShikiListItem) => (year && c.aired_on ? Math.abs(Number(c.aired_on.slice(0, 4)) - year) : Infinity);
  return list.filter((c) => same(c) && gap(c) <= 1).sort((a, b) => gap(a) - gap(b))[0];
}

const AGE: Record<string, string> = { g: 'G', pg: 'PG', pg_13: 'PG-13', r: 'R-17', r_plus: 'R+', rx: 'Rx' };
const SOURCE: Record<string, string> = {
  ORIGINAL: 'Оригинал', MANGA: 'Манга', WEB_MANGA: 'Веб-манга', LIGHT_NOVEL: 'Ранобэ', WEB_NOVEL: 'Веб-роман', NOVEL: 'Роман',
  VISUAL_NOVEL: 'Визуальная новелла', VIDEO_GAME: 'Игра', GAME: 'Игра', COMIC: 'Комикс', DOUJINSHI: 'Додзинси',
  ANIME: 'Аниме', LIVE_ACTION: 'Игровое кино', MULTIMEDIA_PROJECT: 'Мультимедийный проект', PICTURE_BOOK: 'Книга с картинками',
};
const uniq = (a: (string | undefined)[]): string[] => [...new Set(a.filter((x): x is string => !!x?.trim()))];

export function toDetails(shiki: ShikiAnime, ani?: AniListMedia): TitleDetails {
  const characters: CharacterInfo[] = [];
  for (const e of ani?.characters?.edges ?? []) {
    const name = e.node?.name?.full;
    if (!name || characters.length >= MAX_CHARACTERS) continue;
    const voiceActor = e.voiceActors?.[0]?.name?.full;
    characters.push({ name, ...(voiceActor && { voiceActor }) });
  }
  const author = uniq((ani?.staff?.edges ?? []).filter((e) => /^original (story|creator)/i.test(e.role ?? '')).map((e) => e.node?.name?.full)).slice(0, 2).join(', ');
  const source = SOURCE[ani?.source ?? ''];
  const ageRating = AGE[shiki.rating ?? ''];
  return {
    genres: uniq((shiki.genres ?? []).map((g) => g.russian || g.name)),
    ...(source && { source }),
    ...(author && { author }),
    ...(ageRating && { ageRating }),
    studios: uniq((shiki.studios ?? []).map((s) => s.filtered_name || s.name)),
    characters,
    providers: ani ? ['shikimori', 'anilist'] : ['shikimori'],
  };
}

export const ANILIST_QUERY = `query($mal:Int){Media(idMal:$mal,type:ANIME){source(version:3) staff(perPage:25,sort:RELEVANCE){edges{role node{name{full}}}} characters(role:MAIN,sort:RELEVANCE,perPage:${MAX_CHARACTERS}){edges{node{name{full}} voiceActors(language:JAPANESE){name{full}}}}}}`;
