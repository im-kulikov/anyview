import { expect, test } from 'vitest';
import { pickShikimori, toDetails } from './details';

const list = [
  { id: 1, name: 'Tantei wa Mou, Shindeiru.', russian: 'Детектив уже мёртв', english: ['The Detective Is Already Dead'], aired_on: '2021-07-04' },
  { id: 2, name: 'Tantei wa Mou, Shindeiru.', aired_on: '2010-01-01' },
];

test('pickShikimori: точное имя и год ±1; чужой год и чужое имя отбрасываются', () => {
  expect(pickShikimori(list, ['Tantei wa Mou Shindeiru'], 2021)?.id).toBe(1);
  expect(pickShikimori(list, ['Tantei wa Mou Shindeiru'], 2022)?.id).toBe(1);
  expect(pickShikimori(list, ['Tantei wa Mou Shindeiru'], 2015)).toBeUndefined();
  expect(pickShikimori(list, ['Tantei'], 2021)).toBeUndefined();
  expect(pickShikimori(list, ['Детектив уже мертв'], 2021)?.id).toBe(1); // ё→е
  expect(pickShikimori(list, ['Tantei wa Mou Shindeiru'], undefined)).toBeUndefined();
});

test('toDetails: жанры RU, рейтинг, первоисточник, автор, герои с сейю', () => {
  const d = toDetails(
    { rating: 'pg_13', genres: [{ russian: 'Комедия' }, { name: 'Mystery' }], studios: [{ filtered_name: 'ENGI' }] },
    {
      source: 'LIGHT_NOVEL',
      staff: { edges: [{ role: 'Original Creator', node: { name: { full: 'Nigozyu' } } }, { role: 'Director', node: { name: { full: 'X' } } }] },
      characters: { edges: [{ node: { name: { full: 'Kimihiko' } }, voiceActors: [{ name: { full: 'Yoshitsugu Matsuoka' } }] }, { node: { name: { full: 'Siesta' } }, voiceActors: [] }] },
    },
  );
  expect(d).toEqual({
    genres: ['Комедия', 'Mystery'], source: 'Ранобэ', author: 'Nigozyu', ageRating: 'PG-13', studios: ['ENGI'],
    characters: [{ name: 'Kimihiko', voiceActor: 'Yoshitsugu Matsuoka' }, { name: 'Siesta' }], providers: ['shikimori', 'anilist'],
  });
});

test('toDetails без AniList: только поля Shikimori', () => {
  const d = toDetails({ rating: 'none', genres: [] });
  expect(d).toEqual({ genres: [], studios: [], characters: [], providers: ['shikimori'] });
});

import { afterEach, vi } from 'vitest';
import { createAnimevostProvider } from '.';

const BASE = 'https://a.test';
afterEach(() => vi.unstubAllGlobals());

function stub(opts: { shiki?: unknown; ani?: 'fail' }) {
  const f = vi.fn((url: string) => {
    const json = (b: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(b), { status }));
    if (url.startsWith(BASE)) return json({ state: { status: 'ok' }, data: [{ id: 5, title: 'Детектив уже мёртв / Tantei wa Mou, Shindeiru. [1-12 из 12]', year: '2021', type: 'ТВ' }] });
    if (url.includes('/animes?')) return json(opts.shiki ?? [{ id: 46471, name: 'Tantei wa Mou, Shindeiru.', aired_on: '2021-07-04' }]);
    if (url.includes('/animes/46471')) return json({ myanimelist_id: 46471, rating: 'pg_13', genres: [{ russian: 'Комедия' }] });
    return opts.ani === 'fail' ? json({}, 500) : json({ data: { Media: { source: 'LIGHT_NOVEL' } } });
  });
  vi.stubGlobal('fetch', f);
  return f;
}

test('provider.details: цепочка Shikimori → AniList; нет строгого совпадения — пусто без запроса карточки', async () => {
  const f = stub({});
  const d = await createAnimevostProvider([BASE]).details('av-5');
  expect(d).toMatchObject({ genres: ['Комедия'], ageRating: 'PG-13', source: 'Ранобэ', providers: ['shikimori', 'anilist'] });
  expect(String(f.mock.calls.find(([u]) => String(u).includes('/animes?'))?.[0])).toContain(encodeURIComponent('Tantei wa Mou, Shindeiru.'));

  const g = stub({ shiki: [{ id: 9, name: 'Other', aired_on: '2021-01-01' }] });
  expect((await createAnimevostProvider([BASE]).details('av-5')).providers).toEqual([]);
  expect(g.mock.calls.some(([u]) => String(u).includes('/animes/'))).toBe(false);
});

test('provider.details: сбой AniList не роняет Shikimori-часть', async () => {
  stub({ ani: 'fail' });
  expect((await createAnimevostProvider([BASE]).details('av-5')).providers).toEqual(['shikimori']);
});
