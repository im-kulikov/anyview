# anyview

Сайт для просмотра аниме, позже — сериалов и фильмов. MVP (этапы M0–M6 смержены): SPA на React + Vite + TypeScript поверх публичного API animevost, деплой в GitHub Pages. Своего сервера нет.

Сайт: https://im-kulikov.github.io/anyview/

Лицензия не выбрана (по умолчанию «все права защищены»); выбор за владельцем репозитория.

## Документы

```
CLAUDE.md                    правила работы для Claude Code
CONTRIBUTING.md              этапы, ветки, PR, проверка перед PR
docs/SPEC.md                 ТЗ: экраны, поведение, этапы M0–M6 и приёмка
docs/STATUS.md               фактическое состояние: замеры, отступления, ограничения, что не проверено
docs/API_CONTRACT.md         единый контракт данных + адаптер animevost
docs/DESIGN.md               токены, компоненты, правила вёрстки
docs/design/mockups/         разметка макетов всех 10 экранов
docs/RESEARCH.md             ресёрч источников и план фазы 2 (торренты, фильмы, сериалы)
docs/ASSETS.md               логотип и иконки
docs/adr/                    журнал архитектурных решений
```

## Быстрый старт

Нужен Node 22 (так в CI).

```bash
npm ci
npm run dev        # http://localhost:5173/anyview/  (из-за base в адресе есть /anyview/)
npm run build      # tsc --noEmit + vite build, результат в dist/
npm run preview    # посмотреть сборку локально
npm run lint
npm run typecheck
npm test           # vitest в режиме watch; разово: npm test -- --run
npm test -- --run src/lib/format.test.ts   # один файл
```

Перед PR: `npm run lint && npm run typecheck && npm test -- --run && npm run build`.

## Переменные окружения

Задаются в `.env.local` (образец — `.env.example`).

| Переменная | По умолчанию | Статус |
|---|---|---|
| `VITE_BASE` | `/anyview/` | работает (`vite.config.ts`) |
| `VITE_ANIMEVOST_BASES` | `https://api.animetop.info/v1,https://api.animevost.org/v1` | работает (`src/api/index.ts`) |
| `VITE_PROVIDER` | `animevost` | `animevost` или `anyview` (заготовка: все вызовы падают ошибкой «not implemented»); `src/api/index.ts` |
| `VITE_API_BASE` | — | база своего API для `anyview`; пока только попадает в CSP и текст ошибки |
| `VITE_SITE_URL` | `https://im-kulikov.github.io` + `VITE_BASE` | абсолютный адрес для `og:image` (`config/htmlPlugin.ts`) |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (+ `_STORAGE_BUCKET`, `_MESSAGING_SENDER_ID`) | значения проекта в `.env.production` | публичная конфигурация синхронизации (не секреты); без них `/sync` пишет «Синхронизация недоступна» (`src/sync/config.ts`) |
| `VITE_GOOGLE_CLIENT_ID` | в `.env.production` | OAuth Web Client ID для входа Google |

`.env.production` лежит в репозитории и читается только при `npm run build`; в `npm run dev` и тестах синхронизация выключена (чтобы включить в dev, скопируйте значения в `.env.local`, а в консоли Google добавьте `http://localhost:5173` в Authorized JavaScript origins). Настройка консолей, правила Firestore и ручная проверка — [docs/SYNC.md](docs/SYNC.md).

`preconnect`, `preload` первой страницы ленты и `connect-src` в CSP собираются при сборке из `VITE_ANIMEVOST_BASES` и `FEED_PAGE_SIZE` (`config/htmlPlugin.ts`), вручную в `index.html` ничего менять не нужно.

## Структура

```
src/
  main.tsx            старт, предзагрузка ленты
  app/                router.tsx, Layout, ErrorBoundary (RouteError), queryClient
  api/                contract.ts (типы), provider.ts (интерфейс), hooks.ts, keys.ts, index.ts
    providers/        animevost/ (client, parse, index = адаптер и маппинг), comingSoon.ts
  features/           home, catalog, title, player, search, soon, notfound, sync (экран /sync)
  sync/               синхронизация (слияние, Firebase, расписание); только динамический import
  components/         общие компоненты (карточки, шапки, подвал, офлайн-плашка…)
  lib/                storage, format, strings (все тексты), https, хуки
  styles/             tokens.css, global.css
public/               manifest, brand/ (логотип, иконки)
```

Подробно — SPEC.md §3. Код animevost живёт только в `src/api/providers/animevost/`; компоненты знают лишь `contract.ts` и `ContentProvider`.

## Тесты

Vitest, окружение `node`, без DOM. Покрыты: парсеры и адаптер animevost, `storage`, `format`, `https`, `pickEpisode`, `chooseSource`. Не покрыты автотестами: компоненты, плеер, роутинг. Ручной чек-лист перед релизом — в `docs/STATUS.md`.

## Деплой

`push` в `main` → CI (lint, typecheck, test, build) → копии `index.html` для прямых ссылок → GitHub Pages. На `pull_request` выполняются только проверки. Откат: revert коммита (новый деплой ≈ 2–3 минуты) или `workflow_dispatch` на нужном коммите. Подробности — SPEC.md §10.

## Глоссарий

- **Title (тайтл)** — единица каталога: аниме, позже сериал или фильм. **Episode (серия)** — единица просмотра; в интерфейсе «серия», в `<dl>` строка «Эпизоды» — счётчик.
- **Source / Stream** — вариант видео серии (качество, озвучка) и способ его получить (`file`, позже `hls`/`iframe`).
- **Лента (Rail)** — горизонтальный ряд карточек; **сетка (PosterGrid)** — вертикальный каталог; **раздел** — пункт навигации (Главная, Аниме…); **экран** — страница по маршруту.
- **Онгоинг** — идущий тайтл (`status = ongoing`).

## Известные ограничения и что не проверено

Полный список — в `docs/STATUS.md`. Коротко:

- Lighthouse Performance на мобильном 73–78 при цели ≥ 90 (минимум 80): упирается в чужой API без сжатия и постеры одного размера. Решение — прокси фазы 2.
- Поиск без результатов отдаёт HTTP 404 без CORS-заголовка; пустой результат отличается от сети эвристикой (API_CONTRACT.md §5.1).
- iPhone: полноэкранный режим нативный, серию из него переключить нельзя (SPEC.md §5.5).
- Синхронизация (docs/SYNC.md): реальный вход и запись в Firestore на устройствах не проверены; Safari стирает данные сайта после 7 дней без посещений (прогресс вернётся из облака после входа); доступность Google и Firebase из РФ не проверена.
- Не проверено на реальных iPhone, Android, Firefox и Safari (только по описанию PR M6), а также доступ к API и видео из РФ: домены animevost могут блокироваться, на клиенте это не лечится.

## Окружение облачной сессии (Claude Code)

Стандартный уровень сети **Trusted** пускает к npm и GitHub, но не к API animevost, обложкам и опубликованному сайту. В настройках окружения: **Network access → Custom**, отметить **Also include default list of common package managers** и добавить в **Allowed domains**:

```
api.animetop.info
api.animevost.org
video.animetop.info
media.animetop.info
static.openni.ru
im-kulikov.github.io
fonts.gstatic.com
```
