# AGENTS.md — ips-admin-frontend

Инструкции для работы в `services/ips-admin-frontend`. Все пути ниже относительны этому каталогу, если не указано иное. Общая архитектура и команды стека — в [README](../../README.md).

## Назначение и готовность

Отдельное React-приложение для управления генераторами телеметрии. Это не раздел пользовательского UI и не сервер авторизации. Единственная страница — `/dashboard`; `/` перенаправляет на неё через React Router.

Сборка и запуск работают, но часть административных функций пока не имеет серверной реализации:

| Возможность                                    | Текущее состояние                                                                                      |
|------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Загрузка сценариев                             | Использует существующий `GET /api/v1/scenarios` telemetry                                              |
| Создание/запуск генератора                     | `CreateGeneratorBlock` передаёт выбранный сценарий и введённый `pump_id` в существующий POST telemetry |
| Остановка одной помпы                          | POST telemetry существует, но UI строки зависит от отсутствующего API списка                           |
| Список генераторов, фильтры, поиск, сортировка | UI и хук готовы; `GET /api/v1/generators` в telemetry не реализован и возвращает 404                   |
| Массовая остановка с подтверждением            | UI готов; `POST /api/v1/scenario/stop/all` в telemetry не реализован и возвращает 404                  |
| Переключатель «Блокировка»                     | Только локальный `useState`, не блокирует серверные или UI-операции                                    |
| Кнопка «Лимит»                                 | Поле ввода есть, обработчик кнопки пустой; серверный лимит не устанавливается                          |
| Проверка `checkHealth()`                       | Обёртка для отсутствующего backend `/api/v1/health`, в UI сейчас не вызывается                         |

Не заменяйте 404 фиктивным успешным ответом или пустым списком и не описывайте заглушки как рабочие ограничения доступа. Реализация недостающего API требует согласованных изменений в telemetry/backend и типах админки.

## Стек и команды

- React 19.2, React DOM 19.2, React Router 7.
- TypeScript 6.0, Vite 8.2, `@vitejs/plugin-react` 6.
- Tailwind CSS v4 с `@tailwindcss/vite`, Axios, Oxlint.
- Декларации зависимостей — `package.json`, воспроизводимые версии — `package-lock.json`.
- Для разработки рекомендуется Node.js 24 LTS и npm, как в Docker builder (`node:24-alpine`). Технический минимум Vite — 20.19+ в ветке 20 либо 22.12+, но Node.js 20 уже не поддерживается.

Из корня репозитория для локальной разработки:

```bash
cd services/ips-admin-frontend
npm ci
npm run dev
```

Dev-сервер: `http://localhost:5174`. Нужны отдельно запущенные API backend на 8000 и telemetry на 8001.

Из каталога сервиса:

```bash
npm run lint
npm run build
npm run preview
```

`lint` запускает **Oxlint**, не ESLint; конфигурация — `.oxlintrc.json`. `build` выполняет `tsc -b && vite build` и создаёт `dist/`. `preview` — предпросмотр сборки, а не проверка production-конфига nginx. Скрипта `npm test` и проектных UI-тестов пока нет.

В `tsconfig.app.json` включены `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` и **`erasableSyntaxOnly: true`**. `strict` не включён. Не добавляйте обычные TypeScript `enum` без согласования конфигурации; используйте union-типы или объекты `as const`. Не считайте отсутствие `strict` разрешением использовать `any`.

## Структура

```text
src/
├── main.tsx                            # React root, BrowserRouter
├── App.tsx                             # Layout, / → /dashboard
├── index.css                           # @theme, @layer components, admin-* стили
├── config/polling.ts                   # интервалы и лимит ошибок
├── services/api/
│   ├── client.ts                       # api и telemetryApi
│   ├── api.ts                          # типизированные HTTP-функции
│   └── types.ts                        # ScenarioInfo, GeneratorInfo, GeneratorsResponse
├── hooks/
│   ├── useScenarios.ts                 # загрузка списка сценариев
│   └── useGenerators.ts                # polling, действия, фильтрация/сортировка
├── components/
│   ├── Layout.tsx                      # навигация и Outlet
│   ├── CreateGeneratorBlock.tsx        # pump_id + сценарий + запуск
│   ├── LockToggle.tsx                  # локальная визуальная заглушка
│   ├── StopAllButton.tsx               # подтверждение массовой остановки
│   └── ConfirmModal.tsx
└── pages/DashboardPage.tsx             # статистика, список, строка GeneratorItem
```

## API и прокси

Все HTTP-вызовы добавляйте в `src/services/api/api.ts`, типы — в `types.ts`. Не импортируйте Axios-клиенты напрямую в компоненты и хуки. В `client.ts` два клиента с таймаутом 10 секунд:

| Клиент         | Browser baseURL     | Vite-цель                                                      | Docker nginx-цель                                           |
|----------------|---------------------|----------------------------------------------------------------|-------------------------------------------------------------|
| `api`          | `/api/v1`           | `http://127.0.0.1:8000`, путь сохраняется                      | `http://backend:8000/api/` для location `/api/`             |
| `telemetryApi` | `/telemetry-api/v1` | `http://127.0.0.1:8001`, `/telemetry-api` заменяется на `/api` | `http://telemetry:8000/api/` для location `/telemetry-api/` |

Таким образом, `/telemetry-api/v1/scenarios` должен попасть в telemetry как `/api/v1/scenarios`. Не теряйте `/v1`, не дублируйте `/api` и не направляйте запросы к telemetry через backend случайно. При изменении адресов сверяйте **оба** файла: `vite.config.ts` и `nginx.conf`.

Текущие обёртки (пути указаны так, как их видит браузер):

| Функция                                | Запрос                                                | Наличие маршрута на сервере |
|----------------------------------------|-------------------------------------------------------|-----------------------------|
| `getScenarios()`                       | `GET /telemetry-api/v1/scenarios`                     | Есть                        |
| `startGeneratorScenario(name, pumpId)` | `POST /telemetry-api/v1/scenarios/{name}?pump_id=...` | Есть                        |
| `stopGeneratorScenario(pumpId)`        | `POST /telemetry-api/v1/scenario/stop?pump_id=...`    | Есть                        |
| `getGenerators()`                      | `GET /telemetry-api/v1/generators`                    | Нет                         |
| `stopAllScenarios()`                   | `POST /telemetry-api/v1/scenario/stop/all`            | Нет                         |
| `checkHealth()`                        | `GET /api/v1/health`                                  | Нет                         |

Контракт, ожидаемый UI от списка и массовой остановки:

```typescript
interface GeneratorsResponse {
  total: number
  running: number
  generators: {
    pump_id: string
    scenario_name: string
    is_running: boolean
  }[]
}
```

Это **ожидаемый**, а не уже доступный HTTP-контракт. Python-методы telemetry `get_status_all()` и `stop_all()` пока не подключены к роутерам. Текущий `stop()` удаляет запись из `_tasks` и очищает имя сценария: один только экспорт этих методов не обеспечит историю остановленных генераторов и их повторный запуск из списка.

`pump_id` вводится в форме и передаётся явно через аргументы функций и query-параметры Axios. Здесь нет `getPumpId()`, `ips_pump_id` или выбора одной текущей помпы через localStorage, как в пользовательском frontend. Не переносите этот механизм в админку автоматически. При изменениях URL кодируйте path-сегменты, не собирайте query-строки вручную.

В `types.ts` сейчас есть повторные объявления нескольких интерфейсов, которые TypeScript объединяет. Не добавляйте новые дубликаты и не меняйте контракт лишь в одной копии.

## Состояние, polling и операции

- `useScenarios` загружает список при монтировании и вручную через `reload`; периодического опроса у него нет.
- `useGenerators` опрашивает сервер через последовательный `setTimeout`. После успешного ответа ждёт `POLLING_INTERVAL_MS=3000` мс.
- После ошибки задержка линейная: `ERROR_RETRY_DELAY_MS=2000 × число ошибок`, не exponential backoff, несмотря на старый комментарий в конфиге.
- После `MAX_ERROR_RETRIES=5` последовательных ошибок опрос останавливается. «Обновить» сбрасывает счётчик и возобновляет его.
- `pendingAction` хранит один `pump_id`, `isStoppingAll` — отдельный флаг. Это UI-индикаторы, не серверная блокировка конкурентных операций и не реестр всех параллельных запросов.
- После start/stop перечитывается список; массовая остановка ожидает `GeneratorsResponse` прямо в ответе POST.
- `fetchGenerators()` сам перехватывает ошибки. Поэтому после успешного POST и неудачного обновления может появиться `loadError`, хотя `actionError` не установлен. Различайте ошибку команды и ошибку чтения результата.
- Поиск по `pump_id`, фильтры статуса и сортировка выполняются на клиенте через `useMemo`. Сравнение массивов сохраняет ссылку при неизменных данных.

При добавлении polling или действий очищайте таймеры, обрабатывайте ошибки и не применяйте устаревшие ответы. Тип таймера — `ReturnType<typeof setTimeout>`. Текущий `cancelled` предотвращает планирование следующего опроса, но не отменяет уже отправленный HTTP-запрос.

## UI и соглашения

- Используйте функциональные компоненты, хуки `use*`, типизированные props, `PascalCase` для компонентов и `camelCase` для функций.
- Общую сетевую логику держите в API-слое, состояние операций — в хуках, отображение — в компонентах/страницах.
- Новые дизайн-токены и компонентные стили добавляйте в `src/index.css` с существующими префиксами `admin-*`, `generator-*`, `modal-*` и т. п. В JSX уже используются Tailwind utility-классы и inline-стили; не создавайте новые CSS-модули без необходимости и согласования.
- Tailwind v4 конфигурируется через CSS `@theme` и `@layer components`, не через v3 `tailwind.config.js`.
- Массовая остановка проходит через `StopAllButton` и `ConfirmModal`; не убирайте подтверждение при подключении серверной функции.
- `LockToggle` и «Лимит» пока не обеспечивают защиту. Не делайте вид, что локальный переключатель заменяет серверные проверки, лимиты или авторизацию.
- При добавлении страницы обновляйте `src/App.tsx`, `navItems` в `Layout.tsx` и стили. Комментарии о будущих `/users`, `/pumps`, `/settings` не означают, что эти маршруты реализованы.
- Не редактируйте вручную `dist/`, `node_modules/` и `.tsbuildinfo`; зависимости меняйте вместе с lock-файлом.

## Docker и диагностика

Из корня репозитория на VDS после настройки DNS и TCP 80/443 по README:

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose exec -T admin-frontend nginx -t
docker compose logs --tail=100 admin-frontend telemetry
curl --fail http://localhost:8080/health
curl --fail http://localhost:8080/telemetry-api/v1/scenarios
```

На VDS публичный UI доступен по **`https://ips-admin.alexgallax-edu.ru`** через Caddy, без авторизации по выбранной конфигурации. Диагностический HTTP-порт хоста — 8080 (`ADMIN_FRONTEND_PORT`) — остаётся только на `127.0.0.1`; внутри контейнера nginx также слушает **8080**. Runtime-образ — `nginxinc/nginx-unprivileged:1.30-alpine`, master и workers работают через `USER nginx`, не root. `nginx.conf` — **HTTP-фрагмент** (`map` и `server`), копируемый в `/etc/nginx/conf.d/default.conf`; глобальный конфиг с PID и временными путями в `/tmp` наследуется от образа. Это отличается от полного конфига пользовательского UI.

Swagger telemetry находится не на домене админки, а на **`https://telemetry.alexgallax-edu.ru/docs`**, его OpenAPI — `/openapi.json` того же хоста. Admin UI продолжает использовать прежние `/api/v1` и `/telemetry-api/v1`: Caddy передаёт их этому nginx. Сохраняйте `map` и `X-Forwarded-Proto`, чтобы HTTPS-схема не терялась на втором прокси.

Healthcheck обращается к `http://127.0.0.1:8080/health` с таймаутом 3 с. Compose ждёт здоровые backend и telemetry. Builder копирует явно HTML, Vite/TypeScript-конфигурации, `src/` и `public/`; конфигурация nginx попадает только в runtime-стадию. Добавляя файл, необходимый сборке, обновляйте соответствующий `COPY`, а не возвращайте `COPY . .`.

Общий блок `x-app-options` задаёт `no-new-privileges:true`, `cap_drop: [ALL]` и драйвер Docker-логов `local` с `max-size: 10m`, `max-file: 3`. Не убирайте его наследование. Dev-прокси используют `127.0.0.1`, чтобы смешанный запуск с Docker API не зависел от IPv6-разрешения `localhost`.

При 502 проверьте DNS-имя сервиса и внутренний порт 8000. При 404 у `/generators`, `/scenario/stop/all` или `/api/v1/health` сначала учитывайте отсутствие соответствующего серверного маршрута. Успешный `/health` подтверждает nginx, а не работоспособность всех функций админки. `index.html` вместо JSON означает ошибку маршрутизации/SPA fallback.

## Проверки перед завершением задачи

- [ ] `npm run lint` и `npm run build` выполнены; предупреждения не выданы за отсутствие замечаний.
- [ ] `/dashboard` открывается напрямую и после обновления страницы; загружаются собранные JS/CSS.
- [ ] Проверены оба прокси и формат ответов, а не только доступность HTML.
- [ ] Проверены ошибка чтения списка, остановка polling после 5 ошибок и ручное восстановление.
- [ ] Если менялись действия: проверены правильный `pump_id`, pending/error-состояния и подтверждение массовой операции.
- [ ] Отсутствующие серверные маршруты и заглушки не замаскированы фиктивным успехом; добавленные API согласованы с telemetry/backend и документацией.
- [ ] Новые автоматические тесты и команда их запуска описаны, если они добавлены; готового `npm test` сейчас нет.

Связанные сервисы: [Telemetry Service](../ips-telemetry-service/AGENTS.md), [Backend](../ips-backend/AGENTS.md), [пользовательский Frontend](../ips-frontend/AGENTS.md).
