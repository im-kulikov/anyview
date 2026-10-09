# API-контракт anyview (v1)

Единый контракт для аниме, сериалов и фильмов. В MVP его реализует **адаптер в браузере** поверх API animevost. Потом тот же контракт будет отдавать наш сервер, и фронтенд переключится сменой провайдера, без переписывания экранов.

> Типы ниже — источник истины. В коде они лежат в `src/api/contract.ts` один в один.

---

## 1. Что общего у трёх типов контента

Анализ источников (animevost, AniLiberty, Shikimori, poiskkino/Кинопоиск, MyShows, TVmaze, TMDB) показал общее ядро:

| Поле | Аниме | Сериал | Фильм | Комментарий |
|---|---|---|---|---|
| id, тип | ✓ | ✓ | ✓ | |
| Название RU / оригинальное / альтернативные | ✓ | ✓ | ✓ | RU есть не у всех источников: см. RESEARCH.md |
| Год (начала/окончания) | ✓ | ✓ | ✓ | у сериалов — диапазон |
| Статус (анонс / выходит / вышел) | ✓ | ✓ | ✓ | у фильма почти всегда «вышел» |
| Постер, фон | ✓ | ✓ | ✓ | фона часто нет → размытый постер |
| Описание | ✓ | ✓ | ✓ | |
| Жанры, теги | ✓ | ✓ | ✓ | |
| Рейтинги (несколько источников) + голоса | ✓ | ✓ | ✓ | нормализуем к шкале 0–10 |
| Возрастной рейтинг | ✓ | ✓ | ✓ | |
| Режиссёры / студии | ✓ | ✓ | ✓ | |
| Сезоны → серии | ✓ | ✓ | — | **фильм = 1 сезон с 1 «серией»** |
| Источники видео (качество, озвучка, субтитры) | ✓ | ✓ | ✓ | |
| Внешние ID | MAL/Shikimori | IMDb/Кинопоиск/TMDB/TVmaze | IMDb/Кинопоиск/TMDB | |

Отличия по типам укладываются в необязательные поля: `format` (TV/OVA/ONA/фильм у аниме), абсолютная нумерация серий у аниме, озвучки-команды у аниме, дата выхода серий у сериалов.

**Главное решение:** всё, что можно посмотреть, — это `Episode`. У фильма ровно один эпизод. Поэтому плеер, плейлист, «продолжить просмотр» и выбор источника одинаковы для всех типов.

---

## 2. Типы

```ts
// src/api/contract.ts

export type ContentType = 'anime' | 'series' | 'movie';
export type TitleFormat = 'tv' | 'movie' | 'ova' | 'ona' | 'special' | 'short' | 'unknown';
export type TitleStatus = 'announced' | 'ongoing' | 'released' | 'unknown';

export interface Image {
  url: string;                                  // всегда абсолютный https
  width?: number;
  height?: number;
  srcset?: { url: string; width: number }[];    // если источник даёт размеры
}

export interface Rating {
  source: string;        // 'animevost' | 'shikimori' | 'kinopoisk' | 'imdb' | 'tmdb' | ...
  value: number;         // нормализовано к 0–10, одна цифра после точки
  votes?: number;
}

export interface Tag { id: string; name: string }

export interface EpisodeCounter {
  released: number;             // сколько серий вышло
  total?: number;               // сколько запланировано, если известно
  totalIsEstimate?: boolean;    // «12+» у animevost
}

/** Карточка в сетке/ленте. Минимум полей — быстрые списки. */
export interface TitleSummary {
  id: string;                   // непрозрачная строка; фронтенд не разбирает её
  type: ContentType;
  format: TitleFormat;
  name: string;                 // RU
  originalName?: string;
  year?: number;
  status: TitleStatus;
  poster?: Image;
  rating?: Rating;              // основной рейтинг для карточки
  episodes?: EpisodeCounter;
  latestEpisode?: { number: number; label: string };  // бейдж «7 серия»; только у онгоингов
  updatedAt?: string;           // ISO 8601
}

/** Страница тайтла. */
export interface Title extends TitleSummary {
  altNames: string[];
  description?: string;         // ПЛОСКИЙ текст, абзацы через \n. HTML источника не пропускаем.
  backdrop?: Image;
  genres: Tag[];
  tags: Tag[];
  ratings: Rating[];
  ageRating?: string;           // '16+'
  credits: { directors: string[]; studios: string[] };
  voiceovers: string[];         // команды озвучки, напр. ['AnimeVost']
  nextEpisode?: { number: number; airDate?: string /* YYYY-MM-DD */ };
  externalIds: ExternalIds;
  providers: string[];          // откуда собраны данные
}

export interface ExternalIds {
  shikimori?: string; mal?: string; anilist?: string; anidb?: string;
  kinopoisk?: string; imdb?: string; tmdb?: string; tmdbType?: 'movie' | 'tv';
  tvmaze?: string; myshows?: string; wikidata?: string;
  animevost?: string; aniliberty?: string;
}

export interface Season {
  number: number;               // 1 по умолчанию; у фильма всегда 1
  name?: string;
  episodes: Episode[];
}

export interface Episode {
  id: string;                   // непрозрачная строка
  titleId: string;
  season: number;
  number?: number;              // номер в сезоне; нет у спецвыпусков и фильмов
  absoluteNumber?: number;      // сквозной номер (аниме)
  name: string;                 // '7 серия' | 'Фильм' | 'OVA'
  airDate?: string;             // YYYY-MM-DD
  durationSec?: number;
  preview?: Image;              // кадр 16:9
  available: boolean;           // false = анонсирована, ещё не вышла
}

/** Вариант просмотра одной серии: конкретный файл, поток, плеер-iframe или торрент-релиз. */
export interface Source {
  id: string;
  episodeId: string;
  provider: string;             // 'animevost' | 'aniliberty' | 'torrent:rutor' | 'kodik' | ...
  label: string;                // что показать в выборе: 'HD 720p · AnimeVost'
  quality: { label: string; height?: number };   // 'SD'/'HD'/'1080p'; выбор качества — по height
  audio: AudioTrack[];
  subtitles: SubtitleTrack[];
  release?: string;             // сырое имя релиза (торренты)
  sizeBytes?: number;
  seeders?: number;
  /** Готовый поток, если источник играбелен сразу (animevost, AniLiberty, iframe). */
  stream?: Stream;
  /** Нет stream → нужен POST /v1/playback (торренты, перекодирование). */
  needsPlaybackSession?: boolean;
}

export interface Stream {
  kind: 'file' | 'hls' | 'dash' | 'iframe';
  url: string;                  // всегда https
  mime?: string;                // 'video/mp4', 'application/vnd.apple.mpegurl'
  expiresAt?: string;
}

export interface AudioTrack {
  lang: string;                 // BCP 47: 'ru', 'ja', 'en'
  kind: 'dub' | 'mvo' | 'avo' | 'original';
  studio?: string;              // 'AnimeVost', 'LostFilm'
  codec?: string;
  channels?: number;
}

export interface SubtitleTrack {
  lang: string;
  label?: string;
  format: 'vtt' | 'srt' | 'ass' | 'pgs';
  url?: string;
}

export interface Page<T> {
  items: T[];
  page: number;                 // с 1
  pageSize: number;
  total?: number;
  hasMore: boolean;
}

/** Ссылка на сезон франшизы (блок «Сезоны» на странице тайтла). */
export interface SeasonLink {
  id: string;                   // id тайтла-сезона; переход — обычная навигация
  number: number;               // номер сезона
  label: string;                // '2 сезон'
  year?: number;
  current: boolean;             // это открытый сейчас тайтл
}

/** Связи тайтла. Пустые списки — штатный ответ (связей нет или не удалось определить). */
export interface RelatedTitles {
  seasons: SeasonLink[];        // по возрастанию номера; UI показывает блок при ≥ 2
  similar: TitleSummary[];      // OVA, фильмы, спэшлы, спин-оффы, ремейки; без самого тайтла, по году; ≤ 40
}

/** Главный герой и его японский сейю. */
export interface CharacterInfo {
  name: string;
  voiceActor?: string;
}

/**
 * Дополнительные сведения о тайтле из внешних баз (отдельно от `Title`: грузятся вторым запросом, страницу не задерживают).
 * Пустой результат — штатный ответ: тайтл в базах не найден или сведений нет.
 */
export interface TitleDetails {
  genres: string[];             // RU, жанры и темы
  source?: string;              // первоисточник: 'Ранобэ', 'Манга'
  author?: string;              // автор оригинала
  ageRating?: string;           // 'PG-13', 'R-17'
  studios: string[];
  characters: CharacterInfo[];  // главные герои, ≤ 6
  providers: string[];          // откуда сведения: ['shikimori', 'anilist']
}

/** Что умеет бэкенд: фронтенд рисует «скоро» по status, а не по хардкоду. */
export interface CatalogInfo {
  types: { type: ContentType; label: string; status: 'available' | 'coming_soon' }[];
}

/** Единственный тип ошибки, который провайдер отдаёт наружу. */
export type ApiErrorKind = 'network' | 'http' | 'parse' | 'not_found';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}
```

TanStack Query не повторяет запрос при `kind` = `not_found` или `parse`.

---

## 3. Эндпоинты будущего сервера

Базовый путь `/api/v1`. JSON, UTF-8, сжатие gzip/br, CORS открыт для домена сайта. Ошибки — `application/problem+json` (`{type, title, status, detail}`), **с CORS-заголовками и на ошибках** (у animevost их нет на 404 — см. §5.1).

| Метод и путь | Ответ | Назначение |
|---|---|---|
| `GET /catalog` | `CatalogInfo` | какие разделы включены |
| `GET /updates?type=anime&page=1&pageSize=30` | `Page<TitleSummary>` | лента обновлений (главная, страница типа), курсор или стабильная сортировка, без дублей между страницами |
| `GET /titles?type=&genre=&year=&status=&sort=updated\|rating\|year&page=` | `Page<TitleSummary>` | каталог с фильтрами (после MVP) |
| `GET /titles/{id}` | `Title` | страница тайтла |
| `GET /titles/{id}/episodes` | `Season[]` | плейлист |
| `GET /titles/{id}/details` | `TitleDetails` | жанры, первоисточник, автор оригинала, возрастной рейтинг, студии, главные герои с сейю; нет данных = 200 и пустые поля |
| `GET /titles/{id}/related` | `RelatedTitles` | сезоны франшизы и «Похожие»; сервер знает связи сам, `seasons` — по номеру, `similar` — без самого тайтла; нет связей = 200 и пустые списки |
| `GET /episodes/{id}/sources` | `Source[]` | варианты просмотра серии |
| `POST /playback` `{sourceId, clientCaps}` | `{sessionId, stream: Stream, heartbeatUrl}` | запуск торрента/перекодирования (фаза 2) |
| `GET /search?q=&type=&page=&pageSize=` | `Page<TitleSummary>` | поиск, `q` ≥ 2 символов; «ничего не найдено» = 200 и пустой список |
| `GET /genres?type=` | `Tag[]` | справочник жанров |

`clientCaps` — что умеет браузер (результаты `canPlayType` для h264/hevc/av1/aac/ac-3, поддержка HLS/MSE). Сервер по ним выбирает: прямой файл, remux в HLS или перекодирование. Так делает Jellyfin; подробности в RESEARCH.md §4.

Кэширование на сервере: `Cache-Control` с `stale-while-revalidate`; списки 5 мин, тайтлы 1 ч, источники торрентов 15 мин. Картинки — в своём хранилище в нескольких размерах (`Image.srcset`).

---

## 4. Провайдер на фронтенде

```ts
// src/api/provider.ts
export interface ContentProvider {
  catalog(): Promise<CatalogInfo>;
  updates(p: { type: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
  title(id: string, signal?: AbortSignal): Promise<Title>;
  episodes(titleId: string, signal?: AbortSignal): Promise<Season[]>;
  sources(episodeId: string, signal?: AbortSignal): Promise<Source[]>;
  details(id: string, signal?: AbortSignal): Promise<TitleDetails>;
  related(id: string, signal?: AbortSignal): Promise<RelatedTitles>;
  search(p: { q: string; type?: ContentType; page: number; pageSize: number; signal?: AbortSignal }): Promise<Page<TitleSummary>>;
}
```

- `animevostProvider` — MVP, адаптер ниже.
- `anyviewProvider` — будущий: тонкий `fetch` к `/api/v1/*`, без маппинга, потому что сервер уже отдаёт контракт.
- Выбор провайдера — **планируется** (фаза 2): переменная `VITE_PROVIDER` (`animevost` | `anyview`). Сейчас она кодом не читается, провайдер собирается вручную в `src/api/index.ts`. Для сериалов и фильмов в MVP `catalog()` возвращает `coming_soon`, но фронтенд MVP `catalog()` не вызывает: «скоро» задано жёстко (`soon` в `DesktopHeader`, маршруты `/series` и `/movies` рендерят `SoonPage`, подписи в `strings.ts`). Чтение `catalog()` для `soon` и навигации — задача перехода на свой сервер (комментарий к `CatalogInfo` в §2 описывает цель).
- Провайдер бросает только `ApiError`.
- Идентификаторы MVP (`av-<id>`, `av-<id>-<videoId>`) сохраняются в `localStorage` и в ссылках пользователей. Условие перехода на `anyview`: сервер принимает legacy-id `av-*` в `GET /titles/{id}` и `/episodes/{id}/sources`, а канонический id отдаёт в ответе; `Title.externalIds.animevost` остаётся для сопоставления. Дубли `videoId` внутри плейлиста получают суффикс `-2`, `-3`.

Компоненты и хуки знают только `ContentProvider` и типы контракта. Никаких полей animevost за пределами `src/api/providers/animevost/`.

---

## 5. Адаптер animevost (MVP)

Всё ниже проверено живыми запросами 09.10.2026.

### 5.1 Подключение и поведение API

**Внешние URL.** Любой адрес картинки или видео от провайдера проходит `https(url, base?)` (`lib/https.ts`): `http:` → `https:`, относительные и protocol-relative адреса разрешаются от `base` (для картинок animevost — хост постеров), любая другая схема или нечитаемый адрес даёт `undefined`, и поле (`poster`, `preview`, качество источника) просто отсутствует. Списка разрешённых хостов нет: CDN animevost меняются, ограничение по хостам — на стороне CSP (ADR-20). `Image.url` и `Stream.url` всегда абсолютные https.

**Отмена.** Запросы `title`, `episodes`, `sources` разделяют загрузку между вызовами (один `/info`, один `/playlist` на тайтл). У общей загрузки свой `AbortController`: он срабатывает, только когда отменены **все** ожидающие её вызовы; пока остался хотя бы один, запрос идёт. Каждый вызов при своей отмене сразу получает `AbortError`.

- Базы: `https://api.animetop.info/v1`, запасная `https://api.animevost.org/v1`. Обе отдают `Access-Control-Allow-Origin: *` на успешных ответах; `http://` редиректит на `https://`. Список баз — в конфиге; при **сетевой** ошибке (исключение `fetch`) пробуем следующую (кроме поиска, см. ниже); HTTP-ответы 5xx на запасную базу **не** переключают, они сразу превращаются в `ApiError('http')` и запоминаем рабочую до конца сессии.
- `GET /last?page=N&quantity=M` — лента обновлений. Больше **40** за страницу не отдаёт. `state.count` — всего тайтлов (3603).
- `POST /search`, `POST /info`, `POST /playlist` — тело `application/x-www-form-urlencoded` (`name=…` / `id=…`), кодировать через `URLSearchParams`. GET на них → 405.
- `GET /genres` — словарь `{"2":"Боевые искусства", …}`; ключ `"3":"Жанр"` — заголовок, выкинуть.
- Методов расписания, фильтров по жанру и году **нет**.
- Ответы не сжимаются (страница из 30 тайтлов ≈ 105 КБ). Лимиты не опубликованы. Кэшируем, не опрашиваем в фоне, лишних запросов не делаем.

**Ошибки и пустые ответы:**

| Ситуация | Ответ | Что делает адаптер |
|---|---|---|
| `/search` ничего не нашёл | **HTTP 404** `{"error":"Ничего не найдено"}` **без CORS-заголовка** → в браузере `fetch` падает с `TypeError` | см. «Поиск» ниже |
| `/search` нашёл много | максимум **50** результатов, `page`/`quantity` игнорируются | `{items, page:1, pageSize:n, total:n, hasMore:false}`; UI при 50 пишет «50+» |
| `/info` с неизвестным id | 200 `{"state":{"status":"fail",…},"data":[]}` | `ApiError('not_found')` |
| `/playlist` с неизвестным id | 200 `{"status":"fail","error":"Тайтл с таким id не найден"}` (объект, не массив) | `ApiError('not_found')` |
| `/last` за концом списка | `state.status: "fail"`, `data: []` | `page > 1` → `{items:[], hasMore:false}`; `page === 1` → `ApiError('network')` (сбой API повторяется, а не выглядит как «лента закончилась») |
| id не вида `av-<цифры>` | `POST /info` с нечисловым `id` (`id=abc`) даёт HTTP 500 с HTML | `ApiError('not_found')` без запроса (защита regexp `^av-\d+$`) |
| `/last?page=1` без `quantity` или `page=0` | HTTP 500 с HTML-страницей (не JSON); `quantity=0` → `state.status:"fail"`, `data:[]`; `GET /last` без параметров отдаёт 1 тайтл | адаптер всегда передаёт `page ≥ 1` и `quantity` |
| `/search` из 1 символа | принимается, до 50 результатов | порог 2 символов — решение фронтенда (SPEC §5.6), не ограничение API |

**Поиск.** Отличить «ничего не нашли» от обрыва сети по самому ответу браузер не может: на 404 нет CORS-заголовка. Правило: для `/search` не перебираем базы и не повторяем запрос; если `fetch` упал с `TypeError` и `navigator.onLine !== false`, делаем один контрольный запрос `GET /last?page=1&quantity=1` к той же базе (CORS на успешных ответах открыт). Контрольный ответил `2xx` — сервер жив, значит это 404 «ничего не найдено» → пустая страница; иначе `ApiError('network')`. Прежнее условие «база уже отвечала в этой сессии» снято: оно давало ложную сетевую ошибку при открытии ссылки `/search?q=…` до прихода ленты. Цена — один лишний маленький запрос на пустой результат. Пометка `shortcut:` остаётся; правильное решение — прокси с CORS на всех ответах (RESEARCH.md §1.4) или свой сервер.

**Страница:** `page` — запрошенная, `pageSize` — запрошенный (≤ 40), `total = state.count`, `hasMore = page * pageSize < total`.

### 5.2 Форма ответа

`/last`, `/info`, `/search` → `{ state: {status, rek, page, count}, data: Item[] }`. Осмысленны `page` и `count` только у `/last`; у `/search` и `/info` они равны 0, поле `rek` везде 1 и не используется. Типы полей «плавают» — приводить через `Number(...)` / `String(...)`:

```json
{
  "id": 4020,
  "title": "Волшебник ледяного клинка правит миром (второй сезон) / Hyouken no Majutsushi ga Sekai wo Suberu II [1 из 12+] [2 серия - 15 октября]",
  "description": "…HTML: текст с <br> и переводами строк…",
  "genre": "фэнтези, школа",
  "year": "2026",
  "type": "ТВ",
  "director": "Таката Масахиро",
  "urlImagePreview": "https://static.openni.ru/uploads/posts/2026-09/1789888848_1.jpg",
  "screenImage": ["", "", ""],
  "rating": 137,
  "votes": 43,
  "timer": "1792094876",
  "isFavorite": 0,
  "isLikes": 0,
  "series": "{'1 серия':'605012250'}"
}
```

У старых тайтлов `screenImage` — **относительные** пути: `["/uploads/posts/2022-01/1641826701_2.jpg", …]` (у ~9 % тайтлов). `timer` бывает и числом, и строкой.

`/playlist` → массив:

```json
[{ "name": "1 серия", "hd": "http://video.animetop.info/720/605012250.mp4",
   "std": "http://video.animetop.info/605012250.mp4", "preview": "http://media.animetop.info/img/605012250.jpg" }]
```

### 5.3 Маппинг

| Контракт | animevost | Правило |
|---|---|---|
| `id` | `id` | `av-{id}` |
| `type` | — | всегда `anime` |
| `format` | `type` | поле ненадёжно: «Врата Штейна (фильм)» приходит как `ТВ`, «Призрак в доспехах: Синдром одиночки — Фильм» как `ТВ-спэшл`; встречались значения `ТВ`, `ONA`, `OVA`, `ТВ-спэшл`, `полнометражный фильм`, `Полнометражный фильм`, `короткометражный фильм`. От `format !== 'movie'` зависят `latestEpisode` и строка «Эпизоды», так что неверно определённый фильм получит серию. Известное ограничение MVP. Правило **без учёта регистра**: `тв`→`tv`, `полнометражный фильм`→`movie`, `короткометражный фильм`→`short`, `ona`→`ona`, `ova`/`ова`→`ova`, `тв-спэшл`/`спешл`→`special`, иначе `unknown` |
| `name` | `title` | часть до первого ` / ` (пробел-слэш-пробел), без хвостовых `[…]` |
| `originalName` | `title` | часть после первого ` / ` до первого `[`; нет ` / ` — поля нет |
| `episodes` | `title` | первая скобка вида `[<слово?> A(-B)? из C(+)?]`, слово-префикс (`ОВА`, `OVA`, `Спешл`) допускается: `[1-15 из 26]` → `{released:15,total:26}`; `[1 из 12+]` → `{released:1,total:12,totalIsEstimate:true}`; `[0-11 из 11]` → `{released:11,total:11}`; `[ОВА 1-2 из 2]` → `{released:2,total:2}` |
| `status` | `episodes` | `released ≥ total` и нет `+` → `released`; иначе `ongoing`; счётчика нет → `unknown` |
| `latestEpisode` | `episodes.released` | `{number, label:'{n} серия'}` **только при `status === 'ongoing'`**, `format !== 'movie'` и `released ≥ 1` |
| `nextEpisode` | `title` | `[2 серия - 15 октября]` → `{number:2, airDate}`; год выбрать так, чтобы дата попала в окно [сегодня − 30 дней; сегодня + 335 дней] (`now` передаётся в функцию — для тестов). `[N серия - в 2027 году]` → `{number:N}` без даты |
| `year` | `year` | `Number`; `NaN` или `≤ 0` → нет поля |
| `poster` | `urlImagePreview` | `{url: https(...)}` |
| `backdrop` | `screenImage` | первый непустой элемент → `new URL(path, origin(urlImagePreview))`. Это скриншоты ~711×400: UI всегда показывает фон размытым. Пустой массив → поля нет (UI берёт размытый постер) |
| `description` | `description` | `htmlToText()` — **строковая** функция без DOM: `<br>` (с идущим за ним `\n`) → один `\n`, остальные теги удалить, сущности `&nbsp; &amp; &lt; &gt; &quot; &#39; &laquo; &raquo; &mdash; &ndash; &hellip;` и числовые `&#…;` декодировать, 3+ переводов строк → 2, trim |
| `genres` | `genre` | split по `,`, trim, первая буква заглавная, `id` = исходное слово в нижнем регистре |
| `rating`, `ratings[0]` | `rating`, `votes` | `value = round(rating / votes * 2, 1)` (сумма баллов 1–5 → шкала 10); при `votes < 5` рейтинга нет |
| `credits.directors` | `director` | `[director]`, если не пусто |
| `voiceovers` | — | `['AnimeVost']` |
| `externalIds.animevost` | `id` | |
| Сезоны | `/playlist` | один сезон `number: 1`; серии сортировать по первому числу в `name`, без числа — в конец в исходном порядке |
| `Episode.id` | `id`, файл | `av-{rawId}-{videoId}`, `videoId` — число из имени mp4 (`605012250`); нет числа — запасной `av-{rawId}-i{index}` |
| `Episode.number` | `name` | первое число в `name`; нет — поля нет |
| `Episode.preview` | `preview` | через `https()` |
| `Episode.available` | — | `true` для серий из плейлиста; плюс синтетическая серия из `nextEpisode`: `id = av-{rawId}-next-{n}`, `available: false` |
| `details(id)` | Shikimori `GET /animes?search=`, `GET /animes/{id}`; AniList `POST` GraphQL по `idMal` | поиск по оригинальному названию (часть после `/`) и год ±1; принимается только точное совпадение имени (`name`/`russian`/`english`/`synonyms`, нормализация как в `related`) — иначе пустой результат. Shikimori: жанры RU, рейтинг, студии, MAL id. AniList: `source` → RU, штат `Original Story/Creator` → автор, 6 главных героев с первым японским сейю. Сбой Shikimori → `ApiError` (не кэшируется), сбой AniList → поля AniList пропускаются. Совпало 101 из 120 (84 %), ложных нет (ADR-30, `docs/research/title-details.md`) |
| `related(id)` | `POST /search` | **один** поиск на франшизу: запрос — «голова» названия (часть до первого `:`, ` - `, ` — `, `. `), если она ≥ 4 символов, иначе базовое название; результаты кэшируются по нормализованному запросу с TTL адаптера, одновременные вызовы делят промис. Нормализация: регистр, `ё`→`е`, пунктуация и литеральные `\` перед кавычками → пробел. Маркеры русского названия: `(второй сезон)`…`(двенадцатый)`, `(2 сезон)`, `(2-й сезон)` — сезон; `(фильм …)`, `(спецвыпуск N)`, `(спэшл N)`, `(cпэшлы)` (латинская `c`) — не сезон. Номер из оригинального названия **не используется**. Кандидаты: «голова» совпала или база начинается с «головы» + пробел (поиск идёт по подстроке — «Саки» найдёт «Осаки», такие отсекаются). **Сезоны** — кандидаты с той же базой, `format` ТВ/ONA, без маркеров фильма/спэшла; номер = маркер, без маркера 1; дубль номера (ремейки) уходит в «Похожие»; текущий тайтл включается с `current: true`, даже если поиск его не вернул. **Похожие** — остальные кандидаты без самого тайтла, по году и id, не более 40. «Ничего не найдено» (404 без CORS, правило §5.1) → пустой результат; сетевой сбой и не-200 → `ApiError` без повторов (чтобы «связей нет» не закэшировалось на час); интерфейс ошибку `related` молча игнорирует. Ограничения: франшизы с разными русскими названиями («Наруто»/«Боруто») не связываются, разрыв номеров возможен (Pokémon), связь с ремейком «(2021)» односторонняя. Правила проверены на 881 тайтле из 336 сохранённых поисков (ADR-29) |
| `Source` (×2) | `std`, `hd` | `SD 480p` (`std`, `height: 480`) и `HD 720p` (`hd`, `height: 720`); `Source.id = {episodeId}-{height}`; `stream = {kind:'file', url: https(...), mime:'video/mp4'}`; `audio = [{lang:'ru', kind:'dub', studio:'AnimeVost'}]`; у `hd` пустой строки источника нет |

Не заполняются (всегда пусто): `Title.altNames`, `tags`, `credits.studios`. `GET /genres` документирован, но в MVP кодом не используется. `htmlToText` декодирует и шестнадцатеричные сущности (`&#x…;`), неизвестные именованные оставляет как есть.

Не используем: `timer` (не совпадает с датой следующей серии), `series` (строка с одинарными кавычками, не JSON; серии надёжнее брать из `/playlist`), `isFavorite`, `isLikes`.

**Как связаны методы провайдера:**

- `updates()` и `search()` кладут сырые элементы в кэш адаптера по `id`.
- `title(id)` сначала берёт элемент из этого кэша (у `/info` те же поля, что у `/last` и `/search`) и только при прямом заходе по ссылке вызывает `POST /info`.
- `episodes(titleId)` и `sources(episodeId)` используют **одну** мемоизированную загрузку `playlist(rawId)` (промис в `Map`, общий на вкладку). `sources()` разбирает `av-{rawId}-{videoId}`, ждёт `playlist(rawId)` и находит серию по `videoId`. Синтетическая серия `…-next-…` → пустой список источников.
- **Кэш адаптера живёт до перезагрузки вкладки.** `rawCache` и `playlists` — `Map` без инвалидации и лимита (удаляется только упавший промис). `staleTime` Query не помогает: повторный `provider.episodes()` вернёт тот же плейлист, поэтому новая серия онгоинга в долгой вкладке не появится до перезагрузки. Известное ограничение MVP; нужен лимит и сброс при `refetch` (ADR-12 в [adr/](adr/README.md)).

`https(url)` — одна функция: `http://` → `https://`. Проверено: `video.animetop.info` (206 на Range) и `media.animetop.info` (200) работают по HTTPS. Без этого GitHub Pages (HTTPS) заблокирует видео как смешанный контент.

### 5.4 Обязательные тесты адаптера (Vitest, окружение `node`)

Разбор `title` на реальных строках:

- `Волшебник ледяного клинка правит миром (второй сезон) / Hyouken no Majutsushi ga Sekai wo Suberu II [1 из 12+] [2 серия - 15 октября]`
- `Наруто / Naruto [1-220 из 220]` → `released`, без `latestEpisode`
- `Наруто OVA-1 / Naruto OVA-1 [1 из 1]`
- счётчики с префиксом: `[ОВА 1-2 из 2]`, `[OVA 1 из 1]`, `[Спешл 1-3 из 3]`; два счётчика `[1 из 1] [OVA 1 из 1]` → берётся первый
- `[0-11 из 11]`
- следующая серия «в году»: `[13 серия - в 2027 году]` → без `airDate`
- оригинал с `/` без пробелов (`Fate/Zero`) — не режется
- строка без `[...]` и без ` / `

`related`: нормализация и маркеры на реальных строках (`\'`, `\"`, `(фильм  второй)`, латинская `cпэшлы`, ё/е), классификация на фрагментах реальных ответов (три сезона «Пощади меня, великий господин!», «Золотое божество», «О моём перерождении в слизь», «Реинкарнация безработного…: Часть 2», «Король шаманов (2021)», «Когда плачут цикады» — дубль номера, «Наруто»), 404/`TypeError` → пусто, один поиск на франшизу, запрос по базе при короткой «голове», текущий вне выдачи, лимит 40.

Плюс: формат `Полнометражный фильм` (заглавная) и `короткометражный фильм`; рейтинг при 0 и < 5 голосах; сортировка серий; `https()`; `htmlToText()` на строке с `<br>\n` и сущностями; дата следующей серии на стыке года (`now` = 20 декабря, «5 января» → следующий год; `now` = 3 января, «30 декабря» → прошлый год); относительный `screenImage` → абсолютный URL; ответы `fail` из §5.1; поиск, когда `fetch` отклонён с `TypeError` (замоканный `fetch`).

---

## 6. Маппинг будущих источников (для сервера)

Кратко, детали и ссылки — в RESEARCH.md.

| Контракт | AniLiberty | Shikimori (GraphQL) | poiskkino (Кинопоиск) | MyShows | TVmaze |
|---|---|---|---|---|---|
| `name` | `name.main` | `russian` | `name` | `title` | akas (RU) |
| `originalName` | `name.english` | `name`/`japanese` | `alternativeName`/`enName` | `titleOriginal` | `name` |
| `poster` | `poster.optimized` | `poster.mainUrl` | `poster.url` | `image` | `image.original` |
| `backdrop` | `background_covers` | — | `backdrop.url` | — | — |
| `description` | `description` | `description` (BBCode) | `description` | `description` (HTML) | `summary` (EN) |
| `ratings` | `shikimori.rating`, `mal.rating` | `score` | `rating.kp/imdb`, `votes` | `kinopoiskRating`, `imdbRating` | `rating.average` |
| эпизоды | `episodes[]` + `hls_480/720/1080` | `episodes`, `episodesAired` | `/v1.5/season` | `episodes[]` | `/shows/{id}/episodes` |
| внешние ID | `shikimori.id`, `mal.id` | `malId` | `externalId.imdb/tmdb` | `kinopoiskId`, `imdbId` | `externals.imdb/thetvdb` |
| синхронизация | `/anime/releases/latest` | — | фильтр `updatedAt` | нет (переобход онгоингов) | `/updates/shows?since=day` |

Ключ склейки: аниме — MAL ID (= Shikimori ID), фильмы и сериалы — IMDb ID, плюс Кинопоиск ID. Связи достраиваются через Wikidata (P345 IMDb, P2603 Кинопоиск, P4947/P4983 TMDB, P8600 TVmaze).

---

## 7. Источники видео в фазе 2 (торренты)

Чистый WebTorrent в браузере обычные публичные торренты играть не сможет: браузер видит только WebRTC-пиров, а раздают обычные клиенты по TCP/UDP. Поэтому торрент качает **сервер** (TorrServer или Node `webtorrent`) и отдаёт браузеру HTTP или HLS. Контракт к этому готов:

1. `GET /episodes/{id}/sources` возвращает торрент-релизы как `Source` без `stream`, с `needsPlaybackSession: true`, `release`, `sizeBytes`, `seeders`, `audio[]` (озвучки из имени релиза или ffprobe).
2. Пользователь выбирает релиз → `POST /playback {sourceId, clientCaps}`.
3. Сервер поднимает торрент, проверяет кодеки, отдаёт `stream: {kind:'hls'}` (дорожки озвучки — HLS audio renditions) и `heartbeatUrl`.

Плеер на фронтенде при этом не меняется: он всегда получает `Stream` вида `file` / `hls` / `iframe`. Торрент — деталь сервера.
