/**
 * Наборы localStorage, которые реально бывают у пользователей. Ключи и форма — SPEC §7 (`src/lib/storage.ts`).
 * Инцидент волны 3 (главная падала при истории из ≥ 2 записей) проходил все проверки, потому что ни одна не запускала экран с данными.
 */
import last from './fixtures/last.json' with { type: 'json' };

type Raw = { id: number; title: string; year: string | number; type: string };
const raw = last.data as unknown as Raw[];

const summary = (r: Raw, ep = 3) => ({
  id: `av-${r.id}`, type: 'anime', format: 'tv', name: r.title.split(' / ')[0], year: Number(r.year) || 2025, status: 'ongoing',
  latestEpisode: { number: ep, label: `${ep} серия` },
});
const NOW = Date.now();
const historyOf = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const r = raw[i % raw.length];
    // для n > числа тайтлов id различаются суффиксом: одна запись на тайтл
    const t = { ...summary(r, 1 + (i % 4)), id: `av-${r.id}${i >= raw.length ? `${i}` : ''}` };
    return { title: t, episodeId: `${t.id}-i${i}`, episodeName: `${1 + (i % 4)} серия`, position: 100 + i, duration: 1400, updatedAt: NOW - i * 1000 };
  });

export type Seed = Record<string, string>;

export const seeds: Record<string, Seed> = {
  empty: {},
  history2: { 'anyview:schema': '2', 'anyview:v1:history': JSON.stringify(historyOf(2)) },
  history50: { 'anyview:schema': '2', 'anyview:v1:history': JSON.stringify(historyOf(50)) },
  full: {
    'anyview:schema': '2',
    'anyview:v1:history': JSON.stringify(historyOf(5)),
    'anyview:v1:favorites': JSON.stringify([summary(raw[0], 2), summary(raw[1], 5)]),
    'anyview:v1:favoritesMeta': JSON.stringify({ [`av-${raw[0].id}`]: { at: NOW }, [`av-${raw[1].id}`]: { at: NOW } }),
    'anyview:v1:statuses': JSON.stringify({
      [`av-${raw[2].id}`]: { s: 'watching', at: NOW, t: summary(raw[2], 1) },
      [`av-${raw[3].id}`]: { s: 'done', at: NOW - 5, t: summary(raw[3], 12) },
      [`av-${raw[4].id}`]: { s: null, at: NOW - 9 }, // «надгробие»: карточки быть не должно
    }),
  },
  // данные до версионирования: нет ключа схемы, нет favoritesMeta
  legacyV1: {
    'anyview:v1:history': JSON.stringify(historyOf(3)),
    'anyview:v1:favorites': JSON.stringify([summary(raw[0], 2)]),
  },
  // мусор и чужие формы во всех ключах: приложение обязано открыться
  corrupt: {
    'anyview:schema': 'abc',
    'anyview:v1:history': '{not json',
    'anyview:v1:favorites': '"строка"',
    'anyview:v1:favoritesMeta': '[1,2]',
    'anyview:v1:statuses': '{"x":{"s":"bogus","at":"1"}}',
    'anyview:v1:progress': 'null',
    'anyview:v1:prefs': '{"speed":"fast","volume":"loud"}',
    'anyview:v1:recentSearches': '{"a":1}',
    'anyview:v1:feed': '{"savedAt":"x","items":5}',
  },
  // схема новее, чем знает код (откат деплоя)
  futureSchema: { 'anyview:schema': '99', 'anyview:v1:history': JSON.stringify(historyOf(2)) },
  // записи с неверными типами полей внутри валидных контейнеров
  wrongFields: {
    'anyview:schema': '2',
    'anyview:v1:history': JSON.stringify([{ title: { id: 'av-1', name: null }, position: '12' }, ...historyOf(2)]),
    'anyview:v1:favorites': JSON.stringify([{ id: 5 }, summary(raw[0])]),
  },
};
