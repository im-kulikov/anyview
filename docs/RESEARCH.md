# Ресёрч источников (09.10.2026)

Зачем: выбрать источники для MVP и подготовить единый контракт (API_CONTRACT.md) под аниме, сериалы и фильмы. Всё проверялось живыми запросами 09.10.2026 из-за пределов РФ; доступность из РФ отдельно не проверялась. «Не проверено» — значит, подтвердить не удалось.

---

## 1. Аниме

### 1.1 Сводка

| Источник | Что даёт | Доступ | CORS | Риски |
|---|---|---|---|---|
| **animevost** `api.animetop.info/v1` (зеркало `api.animevost.org/v1`) | метаданные + MP4 SD/HD, кадры серий | без ключа | `*` | фан-даб, домены меняются, лимиты не опубликованы |
| **AniLiberty** (бывш. AniLibria) `aniliberty.top/api/v1` | метаданные, HLS 480/720/1080, расписание, торренты, Shikimori/MAL ID | без ключа для чтения | отражает Origin | старый API v3 отдаёт 410; в HLS могут быть рекламные вставки (флаг `isWithVideoAds`) |
| **Shikimori** `shikimori.io/api` (REST + GraphQL) | лучшие RU-метаданные: названия, жанры с RU, студии, оценки, постеры в нескольких размерах | без ключа для публичного; обязателен свой `User-Agent`; 5 запр/с и 90/мин | `*` | shikimori.one заблокирован в РФ с 22.01.2026, теперь `.io`; браузер не может выставить `User-Agent` → только с сервера |
| **Kodik** `kodik-api.com` | iframe-плеер с озвучками по shikimori/kinopoisk/imdb ID, покрывает и фильмы/сериалы | токен партнёра | не проверено | токен нельзя светить во фронтенде |
| **Anime365** `smotret-anime.com/api` | метаданные + переводы | видео только после логина | нет | только сервер |
| Jikan (MAL) / AniList / Kitsu | англ. метаданные; AniList — лучший источник баннеров (`bannerImage`) | без ключа | AniList и Kitsu `*` | нет русских названий; AniList запрещает массовый сбор |
| YummyAnime `api.yani.tv` | ID нескольких сайтов, iframe-плееры | токен приложения | `*` | «только для личного использования» — не для продукта |

ID-маппинг: `Fribb/anime-lists` (MAL ↔ AniList/Kitsu/AniDB/TMDB/IMDb/TVDB, обновляется; **без лицензии**), `manami-project/anime-offline-database` (ODbL, **заархивирован 04.07.2026**). Shikimori ID совпадает с MAL ID.

### 1.2 Что проверено у animevost

- Эндпоинты `last` (GET), `search` / `info` / `playlist` (POST, form-urlencoded), `genres` (GET). Расписания, фильтров по жанру/году нет.
- Не больше 40 тайтлов на страницу ленты; всего 3603 тайтла. Поиск отдаёт максимум 50 результатов без страниц.
- Пустой поиск — HTTP 404 **без CORS-заголовка**: в браузере выглядит как обрыв сети (обход — API_CONTRACT.md §5.1).
- Видео и кадры приходят как `http://…`, но по `https://` отдаются (206 на Range-запрос) — переписываем.
- `id`, `rating`, `votes` — числа; `year` — строка; `timer` — то строка, то число. `screenImage` — массив; у старых тайтлов в нём относительные пути к скриншотам на `static.openni.ru` (~711 × 400), у новых — пустые строки. `series` — строка с одинарными кавычками (не JSON). Описание — HTML. Рейтинг — сумма баллов, делим на голоса.
- Ответы не сжимаются (≈ 105 КБ на 30 тайтлов), постеры одного размера (155–180 КБ).
- Форматы в выборке из 400: `ТВ`, `ONA`, `полнометражный фильм`, `ТВ-спэшл`; в поиске встречаются ещё `Полнометражный фильм` и `короткометражный фильм`, а в счётчиках — префиксы `ОВА`, `OVA`, `Спешл`.

Детали маппинга — API_CONTRACT.md §5.

### 1.3 Рекомендация

- **MVP (только фронтенд):** animevost как единственный источник. Работает из браузера напрямую, MP4 играет без hls.js.
- **Сервер (фаза 2):** видео — animevost + AniLiberty (склейка по MAL/Shikimori ID); метаданные — Shikimori GraphQL с правильным `User-Agent` и в пределах лимитов; баннеры — AniList по `idMal`; при желании шире по озвучкам — Kodik с партнёрским токеном на сервере. Все домены — в конфиге: у animevost, AniLiberty и Shikimori они уже менялись.

### 1.4 Если CORS у animevost закроют

Сейчас прокси не нужен. Если понадобится — бесплатный Cloudflare Worker (~20 строк), адрес в `VITE_ANIMEVOST_BASES`:

```js
// worker.js — прозрачный прокси к API animevost с CORS (набросок, не запускался)
const UPSTREAM = 'https://api.animetop.info';
const ALLOW = 'https://<user>.github.io';
export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/v1/')) return new Response('Not found', { status: 404 });
    const up = await fetch(UPSTREAM + url.pathname + url.search, {
      method: req.method, body: req.method === 'POST' ? await req.text() : undefined,
      headers: { 'Content-Type': req.headers.get('Content-Type') ?? 'application/x-www-form-urlencoded' },
    });
    const res = new Response(up.body, up);
    for (const [k, v] of Object.entries(cors())) res.headers.set(k, v);
    return res;
  },
};
const cors = () => ({ 'Access-Control-Allow-Origin': ALLOW, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
```

---

## 2. Фильмы и сериалы: метаданные

### 2.1 По вашим вариантам

- **IMDb** — для нас нет. Официальный API только через AWS Data Exchange (около $400 000 в год), бесплатные датасеты — строго некоммерческие и без постеров и описаний, парсинг сайта запрещён правилами.
- **MyShows** — да, как дополнение для сериалов. Публичные JSON-RPC методы без токена (`shows.GetById`, `shows.Search`, `shows.GetByExternalId` по kinopoisk/imdb/tvmaze), русские названия и описания, рейтинги Кинопоиска и IMDb, серии с датами. Минусы: нет ленты изменений, нет фонов, лимиты и условия API не опубликованы.

### 2.2 Сводка

| Источник | RU-название / описание | Рейтинги | Сезоны/серии | Обновления | Доступ и цена | Ограничения |
|---|---|---|---|---|---|---|
| **poiskkino.dev** (бывш. kinopoisk.dev) | ✓ / ✓ | КП, IMDb, TMDB + голоса | ✓ с датами и кадрами | фильтр `updatedAt` | ключ из Telegram-бота; 200 запр/день бесплатно, 2500 ₽ за 5000/день, 5000 ₽ безлимит | данные Кинопоиска без видимой лицензии — нужна юр. проверка |
| kinopoiskapiunofficial.tech | ✓ / ✓ | КП, IMDb | ✓ | нет | ключ; 500/день бесплатно, 25 запр/с | то же |
| **MyShows** | ✓ / ✓ | КП, IMDb | ✓ с датами | нет | без ключа (публичные методы) | только сериалы, условия не опубликованы |
| **TVmaze** | только название (akas) / нет | своя средняя | ✓ | `/updates/shows?since=day` | бесплатно, без ключа, ≥20 запр/10 с | лицензия CC BY-SA — единственная бесплатная, разрешающая коммерцию |
| TMDB | ✓ / ✓ (хороший `ru-RU`) | своя + голоса | ✓ | `/changes`, ежедневные дампы ID | ключ; коммерция — только по платному договору | **сам TMDB блокирует РФ и Беларусь с 2022** и не работает с российскими компаниями |
| OMDb | нет | IMDb/RT/MC | частично | нет | 1000/день | CC BY-NC (некоммерческая) |
| Trakt | — | — | — | — | ключ | правила запрещают копировать каталог |
| TheTVDB v4 | не проверено | — | ✓ | `/updates` | платно от $50k выручки | |
| **Wikidata** | — | — | — | — | бесплатно, CC0 | хаб внешних ID: P345 IMDb, P2603 Кинопоиск, P4947/P4983 TMDB movie/tv, P8600 TVmaze, P4835 TVDB |

### 2.3 Рекомендация

- **Фильмы:** основной — poiskkino.dev (единственный, где сразу RU-названия и описания, рейтинги КП/IMDb, постер и фон, внешние ID, фильтр по дате изменения и доступ из РФ). До запуска — юридическая проверка лицензии данных.
- **Сериалы:** poiskkino (сезоны и серии на русском) + TVmaze (даты выхода и лента изменений, коммерческая лицензия) + MyShows (сверка и дозаполнение RU-описаний и рейтингов).
- **ID на каждом тайтле:** внутренний UUID, `imdb` (главный ключ склейки), `kinopoisk`, `tmdb` + тип, `tvmaze`, `myshows`, `tvdb`, `wikidata`. Все уникальные и необязательные; недостающие достраиваются через Wikidata, `shows.GetByExternalId`, `/lookup`.
- **Синхронизация:** первичная загрузка — постранично по poiskkino (курсор, 250 на страницу) и `shows.Ids` у MyShows; ежедневно — `updatedAt` за вчера у poiskkino и `/updates/shows?since=day` у TVmaze; раз в неделю — переобход MyShows только для идущих сериалов. Картинки — копировать в своё хранилище. Соблюдать 429/`Retry-After`.

Поля, общие для всех источников (легли в основу контракта): ID источника и IMDb ID, тип, оригинальное и локальное название, год(ы), жанры, длительность, средний рейтинг, постер, для сериалов — статус и сезоны с сериями (номер сезона, номер серии, название, дата). Почти везде есть: число голосов, описание, фон, страны.

---

## 3. Почему контракт устроен так

- **Всё, что смотрится, — `Episode`.** У фильма один эпизод. Так плеер, плейлист и прогресс одинаковы для всех типов (так же устроен протокол аддонов Stremio: `meta.videos[]` и поток на каждое видео).
- **`Source` отдельно от `Stream`.** Источник — это выбор пользователя (качество, озвучка, релиз, размер, сиды). Поток — то, что реально играет плеер (`file` / `hls` / `iframe`). Для торрентов поток появляется только после `POST /playback`.
- **Рейтингов несколько**, все нормализованы к 0–10, у каждого — источник и голоса.
- **ID непрозрачные** для фронтенда: смена провайдера не ломает ссылки внутри приложения (старые ссылки `av-…` новый сервер может редиректить).

---

## 4. Стриминг через торренты (фаза 2)

### 4.1 Можно ли смотреть торренты прямо в браузере через WebTorrent?

**Нет, для обычных торрентов — нет.** WebTorrent в браузере подключается только к WebRTC-пирам через WebSocket-трекеры. Раздачи на rutracker, rutor, kinozal идут через обычные UDP/HTTP-трекеры и раздаются клиентами, которые WebRTC не умеют. Поддержка WebTorrent появилась в libtorrent 2.1, но qBittorrent только начинает её выкатывать. Плюс в браузере те же ограничения по кодекам, что у обычного `<video>`.

Вывод: торрент качает **сервер**, браузер получает обычное HTTP-видео или HLS.

### 4.2 Серверный движок

| Движок | Статус | Как отдаёт браузеру |
|---|---|---|
| **TorrServer** (Go) | активен, релиз MatriX.144.5 от 13.09.2026 | `GET /stream?link=<magnet>&index=N&play` (HTTP Range), M3U; сборка `-gst` отдаёт HLS (fMP4) с WebVTT и умеет перекодировать в H.264/AAC; есть `/ffp` (ffprobe) и поиск Torznab |
| Node `webtorrent` 3.x | активен | `createServer()` с Range, последовательная загрузка по умолчанию |
| `torrent-stream`, `peerflix` | заброшены | не брать |

Рекомендация: начать с TorrServer (`-gst`) — это ближе всего к нужному результату без своего видеоконвейера.

### 4.3 Кодеки

- Везде играет только **H.264 8-bit + AAC**. HEVC — Safari и часть Chrome с аппаратным декодером; AC-3/DTS почти нигде; MKV — не в Safari/iOS.
- Поэтому сервер решает по возможностям браузера (`clientCaps` из `canPlayType`, как в Jellyfin): прямая отдача → remux в HLS без перекодирования (почти бесплатно) → перекодирование аудио в AAC (дёшево) → перекодирование видео (дорого, нужны аппаратные кодеры).
- Выбор озвучки: каждая аудиодорожка — отдельный `EXT-X-MEDIA:TYPE=AUDIO` в HLS; в `NAME` писать студию (у русских релизов несколько дорожек `ru`). На клиенте — hls.js (`audioTracks`) или нативный HLS.

### 4.4 Поиск торрентов

- Агрегаторы **Jackett** / **Prowlarr** (Torznab API: `t=movie&imdbid=`, `t=tvsearch&season=&ep=`; отдают сиды, infohash, размер).
- RuTor — публичный, ищет по IMDb ID; RuTracker и Kinozal — нужен аккаунт, поиск только по тексту; NNM-Club — публичный; для аниме — Nyaa и торренты AniLiberty (через её API, с хешами и качеством).
- Разбор имени релиза: `parse-torrent-title` / PTT, `guessit`. Ни одна библиотека не знает русские студии озвучки (LostFilm, HDRezka, AniDub…) — нужен свой словарь.
- Сопоставление серий: список файлов торрента → номер SxxEyy или абсолютный → сохраняем `(titleId, season, episode) → (infoHash, fileIdx)`. Для аниме с абсолютной нумерацией — маппинг через Shikimori/TMDB.

### 4.5 Готовые решения, на которые стоит посмотреть

- **Stremio addon protocol** — `manifest` / `catalog` / `meta` / `stream`; поток с `url` или `infoHash` + `fileIdx`. Идеи взяты в контракт.
- **Lampa + Lampac** (.NET, AGPL) — по сути та самая архитектура, которую вы описали: десятки источников, TorrServer как подпроцесс, Jackett-совместимый агрегатор, HLS-перекодирование. Полезно изучить, прежде чем писать своё.
- **Jellyfin** — схема «браузер сообщает кодеки → сервер выбирает прямую отдачу, remux или перекодирование».

### 4.6 Альтернатива торрентам — iframe-«балансеры»

Kodik, Alloha, Vibix, Collaps, Lumex и др. отдают готовый плеер по ID Кинопоиска / IMDb / Shikimori. Плюсы: мгновенный старт, ноль трафика и перекодирования на нашей стороне, озвучки внутри. Минусы: чужой плеер и реклама, не ложится в наш единый выбор дорожек, нужен партнёрский доступ, их часто блокируют. В контракте это `Stream.kind = 'iframe'`.

### 4.7 Схема фазы 2

1. **Каталог** + таблица внешних ID (tmdb, imdb, kinopoisk, shikimori/mal, aniliberty).
2. **Резолвер источников** `GET /episodes/{id}/sources`: опрашивает Prowlarr/Jackett, AniLiberty, балансеры, прямые файлы; разбирает и ранжирует; кэширует `infoHash → файлы → серия`. Ничего не скачивает.
3. **Сессия просмотра** `POST /playback`: добавляет торрент в пул TorrServer (общий на infoHash, LRU-кэш на диске, TTL простоя), ждёт первые куски, ffprobe, выбирает режим по `clientCaps`, отдаёт `Stream` (`file` или `hls`) и heartbeat. Лимит одновременных перекодирований.
4. **Клиент** не меняется: тот же плеер, плюс выбор озвучки из HLS-дорожек и iframe-режим.
5. **Трафик:** ~5–10 Мбит/с на зрителя 1080p исходящего (≈1 Гбит/с на 100 одновременных) + столько же входящего из роя при промахе кэша. Это главный расход, а не CPU.

---

## 5. Юридические и операционные риски

Кратко и фактически; это не юридическая консультация.

- Раздача чужого контента: в РФ — блокировки по 149-ФЗ (ст. 15.2, «вечная» блокировка по ст. 15.6 за повторные нарушения), блокировки зеркал.
- Серверный торрент-клиент по умолчанию ещё и раздаёт: IP сервера виден в рое, антипиратские компании шлют жалобы хостеру. Мы сами передаём поток пользователю, поэтому защита «пассивного хостинга» вряд ли применима.
- Большинство хостеров в ЕС/США отключают серверы после повторных жалоб.
- Данные: TMDB — коммерция только по договору и блок РФ; IMDb-датасеты и OMDb — некоммерческие; перепродавцы данных Кинопоиска — лицензия не видна; Trakt запрещает копировать каталог.

До фазы 2 стоит определить юрлицо и юрисдикцию и проверить схему с юристом.

## 6. Открытые вопросы

1. Юрлицо и юрисдикция фазы 2; раздаём ли что-то в рой вообще.
2. Бюджет на трафик и перекодирование на одного зрителя.
3. Разрешают ли RuTracker/Kinozal автоматический доступ; какие балансеры дадут партнёрский доступ.
4. Поддерживаемые устройства (iPhone, Smart TV?).
5. Внешние субтитры (OpenSubtitles?).

## Источники

- animevost: живые запросы к `api.animetop.info/v1` и `api.animevost.org/v1`; пример клиента — [CelWeb/AnimeCloud api.js](https://github.com/CelWeb/AnimeCloud/blob/main/components/api/api.js)
- [AniLiberty API docs](https://aniliberty.top/api/docs/v1), [история AniLibria 2012–2025](https://dtf.ru/4140393-istoriya-anilibria-2012-2025)
- [Shikimori API](https://shikimori.io/api/doc), [блокировка shikimori.one](https://mel.fm/novosti/2501986-roskomnadzor-zablokiroval-dostup-k-russkoyazychnoy-entsiklopedii-anime-i-mangi-shikimori)
- [AnimeParsers (неофиц. описание Kodik API)](https://github.com/YaNesyTortiK/AnimeParsers), [AniList rate limiting](https://docs.anilist.co/guide/rate-limiting), [AniList terms](https://docs.anilist.co/guide/terms-of-use)
- [Fribb/anime-lists](https://github.com/Fribb/anime-lists), [anime-offline-database](https://github.com/manami-project/anime-offline-database)
- [TMDB docs](https://developer.themoviedb.org), [TMDB о блокировке РФ](https://www.themoviedb.org/talk/67c21908104765853253ae0b), [TMDB rate limiting](https://developer.themoviedb.org/docs/rate-limiting)
- [IMDb non-commercial datasets](https://developer.imdb.com/non-commercial-datasets/), [IMDb API на AWS](https://aws.amazon.com/marketplace/pp/prodview-nzspap6vaousm)
- [poiskkino.dev docs](https://poiskkino.dev/documentation), [MyShows API](https://api.myshows.me/shared/doc/), [TVmaze API](https://www.tvmaze.com/api), [Trakt developer](https://developer.trakt.tv), [TheTVDB pricing](https://thetvdb.com/api-information)
- [WebTorrent](https://github.com/webtorrent/webtorrent), [WebTorrent FAQ](https://github.com/webtorrent/webtorrent/blob/master/docs/faq.md), [libtorrent 2.1 upgrade notes](https://libtorrent.org/upgrade_to_2.1-ref.html), [qBittorrent news](https://qbittorrent.org/news)
- [TorrServer](https://github.com/YouROK/TorrServer), [Jackett](https://github.com/Jackett/Jackett), [Torznab spec](https://torznab.github.io/spec-1.3-draft/torznab/Specification-v1.3.html)
- [Jellyfin codec support](https://jellyfin.org/docs/general/clients/codec-support/), [Apple HLS authoring spec](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices.md)
- [Stremio addon SDK docs](https://github.com/Stremio/stremio-addon-sdk/tree/master/docs), [Torrentio](https://github.com/TheBeastLT/torrentio-scraper), [Lampa](https://github.com/yumata/lampa), [Lampac NextGen](https://github.com/lampac-nextgen/lampac)
