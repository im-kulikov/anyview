# anyview — инструкции для Claude Code

Сайт для просмотра аниме (MVP), позже — сериалы и фильмы. SPA на React + Vite + TypeScript, деплой в GitHub Pages. Своего сервера нет: данные берём из API animevost через адаптер.

## Документы (прочитать перед работой)

1. `docs/SPEC.md` — ТЗ: экраны, поведение, этапы M0–M6 и критерии приёмки.
2. `docs/API_CONTRACT.md` — типы контракта (копировать в `src/api/contract.ts` один в один), интерфейс провайдера, маппинг animevost.
3. `docs/DESIGN.md` + `docs/design/mockups/*.dc.html` — токены, компоненты, макеты всех экранов (телефон 390 px и десктоп 1440 px).
4. `docs/RESEARCH.md` — источники и фаза 2 (для контекста, в MVP не реализуем).
5. `docs/ASSETS.md` — логотип и иконки.
6. `docs/STATUS.md` — фактическое состояние: замеры, отступления, ограничения, что не проверено. `docs/SYNC.md` — синхронизация между устройствами (Firebase, правила, чек-лист). `docs/adr/` — журнал решений. `README.md` и `CONTRIBUTING.md` — запуск, структура, процесс.

## Правила

- **Работаем по этапам** из SPEC.md §11: один этап — одна ветка — один PR в `main`. В описании PR — чек-лист критериев приёмки этапа и что проверено.
- **Компоненты не знают об animevost.** Только типы из `src/api/contract.ts` и `ContentProvider`. Код animevost — только в `src/api/providers/animevost/`.
- **Все внешние URL картинок и видео — через `https()`** из адаптера. Никакого `http://` на странице.
- **Описание тайтла — только плоский текст.** `dangerouslySetInnerHTML` запрещён.
- **Минимум зависимостей.** Перед добавлением пакета — проверить, нельзя ли платформой или уже установленным. Разрешено по ТЗ: `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `lucide-react` (только нужные иконки); для разработки — `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`, `vitest`, `eslint` + `typescript-eslint` (и плагины React hooks/refresh, `@eslint/js` и `globals` из шаблона Vite). Также `firebase` (ADR-28) — только `firebase/app`, `firebase/auth`, `firebase/firestore/lite`, только в `src/sync/firebase.ts` и только ленивым чанком синхронизации (не в стартовом бандле). Остальное — с обоснованием в PR. jsdom/happy-dom не нужны: тесты адаптера работают без DOM.
- **Производительность:** бюджеты SPEC.md §8. Страница тайтла (вместе с плеером) — ленивый чанк. Поиск — в основном чанке: на iOS фокус поля должен ставиться синхронно в касании (SPEC.md §4, §5.6); не делать его ленивым. Под каждую картинку зарезервировано место.
- **Доступность:** SPEC.md §9 — настоящие кнопки и ссылки, `aria-label` у иконок, фокус виден, зоны нажатия ≥ 44 px.
- **Тексты интерфейса** — в `src/lib/strings.ts`, на русском, как в макетах.
- **Дизайн:** значения из DESIGN.md §2 как CSS-переменные. Если источники расходятся — порядок приоритетов в DESIGN.md §0 (здесь не пересказываем).
- **iOS Safari** — полноценная целевая платформа: запуск видео и фокус поиска только синхронно в обработчике касания (SPEC.md §5.5, §5.6). Любое поле ввода — `font-size` ≥ 16 px, иначе iOS зумит страницу при фокусе (SPEC.md §9); зум через `viewport` не отключаем.
- Версии пакетов — актуальные стабильные на момент установки.

## Команды

```bash
npm run dev         # локальная разработка
npm run build       # прод-сборка в dist/
npm run preview     # проверить сборку локально
npm run lint
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

## Проверка перед PR

`npm run lint && npm run typecheck && npm test -- --run && npm run build` — всё зелёное. Экраны этапа сверены с макетами на ширине 375 и 1440 px. Нет ошибок в консоли. (`npm run build` уже включает `tsc --noEmit`, отдельный `typecheck` в CI дублирует его намеренно: падает раньше и с понятным именем шага.) Описание PR — по `.github/pull_request_template.md`.

## Деплой

`.github/workflows/deploy.yml` (SPEC.md §10): на `pull_request` — только проверки (lint, typecheck, test, build), без публикации; на push в `main` (и вручную) — те же проверки → сборка → копии `index.html` для прямых ссылок (`anime.html`, `series.html`, `movies.html`, `search.html`, `sync.html`, `404.html`) → GitHub Pages. `base` берётся из `VITE_BASE` (по умолчанию `/anyview/`). Pages включён; если когда-нибудь окажется выключен — Settings → Pages → Source: GitHub Actions. Путь `/pages` через прокси облачной сессии недоступен (проверен только GET, 403), поэтому не пытаться включать Pages через `gh api`, а написать владельцу, что нажать.

В облачной сессии GraphQL недоступен целиком: `gh pr create/view/list/checks/merge` отвечают 403. PR создавать и читать через REST (`gh api repos/im-kulikov/anyview/pulls ...`) или MCP-инструменты GitHub; мержить через REST: `gh api -X PUT repos/im-kulikov/anyview/pulls/<N>/merge -f merge_method=squash` (или MCP `merge_pull_request`). Ревью-треды, auto-merge и ready-for-review прокси открывает отдельными маршрутами `.../ccr/...` (подсказка есть в тексте 403).
