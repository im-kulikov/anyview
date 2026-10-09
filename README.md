# anyview

Сайт для просмотра аниме, позже — сериалов и фильмов. MVP: SPA на React + Vite + TypeScript поверх публичного API animevost, деплой в GitHub Pages.

Сайт (после первого деплоя): https://im-kulikov.github.io/anyview/

## Документы

```
CLAUDE.md                    правила работы для Claude Code
docs/SPEC.md                 ТЗ: экраны, поведение, этапы M0–M6 и приёмка
docs/API_CONTRACT.md         единый контракт данных + адаптер animevost
docs/DESIGN.md               токены, компоненты, правила вёрстки
docs/design/mockups/         разметка макетов всех 10 экранов
docs/RESEARCH.md             ресёрч источников и план фазы 2 (торренты, фильмы, сериалы)
docs/ASSETS.md               логотип и иконки + промпты для Codex
```

Макет (холст в Claude, приватный): https://claude.ai/artifact/LWLWRufQYRp74bwTnUqZR2

## Перед стартом

1. **GitHub Pages.** Settings → Pages → Build and deployment → Source: **GitHub Actions**. Для приватного репозитория Pages работает только на платном плане GitHub (Pro/Team); на бесплатном репозиторий нужно сделать публичным.
2. Желательно: выгрузить PNG экранов из холста (Share → Export) в `docs/design/screens/` — разметку макетов вне холста не запустить, картинки помогают сверять вёрстку. Что главнее при расхождениях — DESIGN.md §0.
3. Логотип: промпты из `docs/ASSETS.md` для Codex, результат — в `public/brand/`.

## Запуск Claude Code

Откройте репозиторий в Claude Code (лучше в auto mode, чтобы ходы шли без подтверждений) и отправьте:

```text
/goal Реализован MVP anyview по CLAUDE.md и docs/ (SPEC.md, API_CONTRACT.md, DESIGN.md): по порядку пройдены все этапы M0–M6 из docs/SPEC.md §11. Каждый этап — отдельная ветка и PR в main; в описании PR — чек-лист критериев приёмки этапа и как проверен каждый пункт; PR смержен только после зелёного CI, после мержа деплой в GitHub Pages успешен. Готово, когда в переписке показано: (1) на последнем коммите main `npm run lint && npm run typecheck && npm test -- --run && npm run build` завершилась с кодом 0; (2) последний запуск workflow деплоя для main — success (вывод gh run list или gh run view), а `curl -sI` по https://im-kulikov.github.io/anyview/ и https://im-kulikov.github.io/anyview/anime вернул 200 — если сеть окружения не пускает на github.io, достаточно success деплоя; (3) список ссылок на смерженные PR M0, M1, M2, M3, M4, M5, M6; (4) тесты адаптера из docs/API_CONTRACT.md §5.4 есть и проходят; (5) в PR M3 и M6 приведён замер Lighthouse mobile для / и /anime по docs/SPEC.md §8, а если Lighthouse в окружении не запускается — сказано почему и что проверено вместо него; (6) в итоговом сообщении перечислено, что проверить из окружения нельзя (реальный iPhone, доступ из РФ). Ограничения: поведение и дизайн не расходятся с docs без записи об этом в PR; расхождения реального API с docs/API_CONTRACT.md исправлены в самом документе тем же PR; новые зависимости вне списка из CLAUDE.md — только с обоснованием в PR; ничего не мержится с красным CI. Если GitHub Pages не включён и включить его нельзя — остановись и напиши, что нажать. Остановись не позже чем через 100 ходов с отчётом, на каком этапе работа.
```

Проверять работу по шагам: `/goal` без аргументов — статус, `/goal clear` — остановить. Хотите смотреть каждый этап до мержа — замените в условии «PR смержен только после зелёного CI» на «PR открыт» и запускайте Goal по одному этапу (`…пройден этап M0 из docs/SPEC.md §11…`).
