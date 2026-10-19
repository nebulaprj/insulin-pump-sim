# Инсулиновая Помпа (Insulin Pump Simulator)

Учебная распределённая система — симулятор инсулиновой помпы с пользовательским интерфейсом, админ-панелью, REST API и генератором телеметрии. Backend хранит отдельное состояние для каждого `pump_id`; это разделение данных, а не авторизация доступа. У генератора сценариев пока есть ограничения изоляции, перечисленные ниже.

> [⚠️ WARNING]
> **Только для учебных целей.** Проект предназначен исключительно для обучения и демонстрации программных решений. Он не является медицинским устройством и **не может использоваться для реальных медицинских задач**: диагностики, мониторинга состояния пациентов, принятия клинических решений, расчёта или введения доз инсулина и управления реальными медицинскими устройствами.
>
> Алгоритмы, значения и сообщения симулятора не являются медицинскими рекомендациями. Не подключайте проект к реальным инсулиновым помпам или другим устройствам, от которых зависят здоровье и жизнь людей.

---

## Содержание

- [Обзор системы](#-обзор-системы)
- [Архитектура](#-архитектура)
- [Быстрый старт](#-быстрый-старт)
- [Структура проекта](#-структура-проекта)
- [API](#-api)
- [Сервисы](#-сервисы)
- [Конфигурация](#-конфигурация)
- [Примеры использования](#-примеры-использования)
- [Разработка](#-разработка)
- [Дополнительная документация](#-дополнительная-документация)
- [Ограничения текущей архитектуры](#-ограничения-текущей-архитектуры)

---

## Обзор системы

В монорепозитории **четыре прикладных сервиса**:

| Сервис                | Стек                                                                  | Роль                                                                            |
|-----------------------|-----------------------------------------------------------------------|---------------------------------------------------------------------------------|
| **Frontend**          | React 19.2 + TypeScript 6.0 + Vite 8.2 + Tailwind v4 + React Router 7 | Мониторинг, настройки, тревоги, сценарии; кнопка болюса пока является заглушкой |
| **Backend**           | Python 3.14 + FastAPI + Pydantic v2                                   | Симулятор помпы: хранит состояние, обрабатывает телеметрию, управляет тревогами |
| **Telemetry Service** | Python 3.14 + FastAPI                                                 | Генерирует тестовую телеметрию по сценариям и отправляет её на бэкенд           |
| **Admin Frontend**    | React 19.2 + TypeScript 6.0 + Vite 8.2 + Tailwind v4 + React Router 7 | UI управления генераторами; часть серверного API ещё не реализована             |

Compose запускает четыре приложения и **Caddy** — публичный HTTPS-шлюз для VDS. Базы данных нет: состояние помп и генераторов хранится в памяти и теряется при перезапуске. Точные зависимости Python закреплены в `requirements.txt`, интерфейсов — в `package-lock.json` каждого сервиса.

### Ключевые особенности

- **Разделение по `pump_id`**: собственные состояние, настройки, последнее измерение и журнал тревог в backend
- **Автоматическое управление инсулином**: match/case логика обработки глюкозы с уровнями NORMAL / LOW / HIGH
- **Система тревог**: 3 уровня (NOTIFICATION, WARNING, CRITICAL) с автоматической записью в историю
- **Сценарии телеметрии**: предопределённые паттерны изменения глюкозы (рост, падение, скачки)
- **Админ-панель**: создание генератора по `pump_id`, выбор сценария, UI списка и массовых операций; готовность отдельных функций описана в разделе сервисов

---

## Архитектура

```text
Интернет ── HTTPS :443 ──> Caddy
  ips.alexgallax-edu.ru       ──> Frontend; /docs, /redoc, /openapi.json ──> Backend
  ips-admin.alexgallax-edu.ru ──> Admin Frontend
  telemetry.alexgallax-edu.ru ──> Telemetry (Swagger и API)

Frontend       /api/v1/* ────────────────> Backend
Admin Frontend /api/v1/* ────────────────> Backend
Admin Frontend /telemetry-api/v1/* ──────> Telemetry /api/v1/*

Backend ── httpx2: управление сценариями ──> Telemetry
Backend <── httpx2: POST телеметрии ──────── Telemetry
```

Локально API слушают порты **8000** (backend) и **8001** (telemetry), Vite — **5173** и **5174**. В Docker оба Python-сервиса слушают **8000 внутри своих контейнеров**, оба nginx — **8080**. Единственная публичная точка входа на VDS — Caddy: TCP **80/443** хоста перенаправляются на его непривилегированные **8080/8443**. Frontend больше не публикует собственный порт на хосте. Прямые диагностические порты backend:8000, telemetry:8001 и админки:8080 остаются **только на `127.0.0.1`**.

Интерфейсы собираются на `node:24-alpine`, в runtime используется `nginxinc/nginx-unprivileged:1.30-alpine`. Builder копирует только HTML, конфигурации Vite/TypeScript, `src/` и `public/`, поэтому изменение nginx не пересобирает JS/CSS.

Vite и nginx пользовательского UI сохраняют `/api/`. Прокси админки дополнительно заменяет `/telemetry-api/` на `/api/` при обращении к telemetry.

Caddy автоматически получает и продлевает публичные TLS-сертификаты, перенаправляет HTTP на HTTPS и работает с HTTP/1.1 и HTTP/2. HTTP/3 и UDP-порт в этой конфигурации не включены. Публичные Swagger и OpenAPI обслуживаются по исходным путям без префиксов, поэтому «Try it out» использует правильный API на том же хосте.

Nginx сохраняет `X-Forwarded-Proto: https` от Caddy, а Uvicorn в Compose получает `FORWARDED_ALLOW_IPS=*`. Это допустимо при текущей изоляции: прямые API доступны только внутри доверенной Docker-сети и с loopback хоста. Не публикуйте эти порты на внешних интерфейсах без пересмотра доверия proxy-заголовкам.

### Поток данных при запуске сценария

1. **Frontend** → `POST /api/v1/pumps/{pump_id}/scenarios/{name}` → **Backend**
2. **Backend** → `POST /api/v1/scenarios/{name}?pump_id=...` → **Telemetry Service** (запуск задачи)
3. **Telemetry Service** запускает `asyncio.Task`, которая:
   - Генерирует значение глюкозы по сценарию
   - `POST /api/v1/pumps/{pump_id}/telemetry` → **Backend**
   - Ожидает заданный интервал (по умолчанию 5 секунд) перед следующим измерением
4. **Backend** обрабатывает телеметрию, обновляет `PumpState`, регистрирует тревоги
5. **Frontend** (polling `/status` каждые 3 сек) получает обновления и рисует UI

---

## Быстрый старт

### Вариант 1: Развёртывание Docker Compose на VDS

Нужны Linux VDS, Docker Engine и Compose v2 с поддержкой `--wait`. Перенесите проект на сервер, включая корневой `Caddyfile` и `infrastructure/caddy/Dockerfile`. Команды выполняются из корня репозитория. Корневой `.env` необязателен: значения портов заданы в Compose.

Перед запуском:

1. Создайте DNS-записи **A** для `ips.alexgallax-edu.ru`, `ips-admin.alexgallax-edu.ru` и `telemetry.alexgallax-edu.ru`, указывающие на публичный IPv4 VDS.
2. Если есть записи **AAAA**, они также должны указывать на доступный IPv6 этого VDS; неверные AAAA нужно исправить или удалить.
3. Разрешите входящие **TCP 80 и 443** в firewall VDS и сетевых правилах провайдера. Эти порты не должны занимать другой веб-сервер или Compose-проект.
4. Дождитесь применения DNS. Серверу нужен исходящий доступ для ACME и загрузки образов/зависимостей. Сертификаты выдаются автоматически; вручную копировать ключи не требуется.

```bash
# Из корня этого репозитория (сервисы находятся в services/):
docker compose config --quiet
docker compose up --build -d --wait
```

Публичные адреса:

| Назначение | URL |
|---|---|
| Пользовательский интерфейс | https://ips.alexgallax-edu.ru |
| Админ-панель | https://ips-admin.alexgallax-edu.ru |
| Swagger backend | https://ips.alexgallax-edu.ru/docs |
| Swagger telemetry | https://telemetry.alexgallax-edu.ru/docs |

ReDoc доступен на `/redoc`, OpenAPI — на `/openapi.json` соответствующего API-хоста. Telemetry API доступен на `https://telemetry.alexgallax-edu.ru/api/v1/...`.

**По выбранной конфигурации авторизации нет:** админка, оба Swagger и API доступны всем, кто может обратиться к доменам. HTTPS шифрует трафик, но не ограничивает права. Для доверенного учебного использования учитывайте этот риск; при необходимости ограничьте доступ отдельно.

Проверить состояние и посмотреть логи:

```bash
docker compose ps
docker compose logs --tail=100
docker compose logs --tail=100 caddy
```

Диагностические HTTP-адреса на самом VDS: `http://127.0.0.1:8000/docs`, `http://127.0.0.1:8001/docs` и `http://127.0.0.1:8080`. Они не публикуются на внешних интерфейсах.

После изменения `Caddyfile` проверьте и перечитайте конфигурацию без остановки шлюза:

```bash
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Остановить стек, сохранив контейнеры: `docker compose stop`. Состояние помп и задач в памяти при остановке будет потеряно.

Backend запускается до сервиса телеметрии; HTTP-клиент backend не требует
готовности телеметрии при старте. Это исключает циклическую зависимость сервисов.

Проверки здоровья: `/docs` у Python-сервисов (127.0.0.1, порт из настроек приложения, HTTP-таймаут 3 с), `/health` у обоих nginx на внутреннем порту 8080 и локальный admin API Caddy на `127.0.0.1:2019/config/` внутри его контейнера. Порт 2019 не публикуется. Это проверки процессов, а не корректности алгоритмов или завершения выдачи TLS-сертификатов: проверьте также публичные HTTPS-адреса и логи Caddy. `GET /api/v1/health` у backend не реализован.

Все пять контейнеров запускаются без root, с `no-new-privileges:true` и `cap_drop: [ALL]`. Docker-логи используют драйвер `local` с ротацией: `max-size: 10m`, `max-file: 3` на контейнер. Том `caddy_data` сохраняет сертификаты, ключи и ACME-аккаунты, `caddy_config` — служебную конфигурацию Caddy. Сохраняйте их при обновлениях и делайте защищённые резервные копии `caddy_data`; не используйте `docker compose down -v` без намерения удалить эти данные. Состояния помп эти тома не сохраняют.

### Вариант 2: Локальная разработка (4 терминала)

Каждый блок начинается из корня репозитория. Docker-стек с теми же портами предварительно остановите. Для Python-сервисов используйте отдельные виртуальные окружения; внешнее хранилище не требуется.

Этот вариант не требует доменов, Caddy или публичных сертификатов. Для смешанного запуска можно поднять только API командой `docker compose up --build -d --wait backend telemetry`, затем запустить оба Vite-сервера на хосте.

**Терминал 1 — Backend:**
```bash
cd services/ips-backend
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m src.ips_backend.main
# → http://localhost:8000
```

**Терминал 2 — Telemetry Service:**
```bash
cd services/ips-telemetry-service
python3.14 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m src.ips_telemetry_service.main
# → http://localhost:8001
```

**Терминал 3 — Frontend:**
```bash
cd services/ips-frontend
npm ci
npm run dev
# → http://localhost:5173
```

**Терминал 4 — Admin Frontend:**

```bash
cd services/ips-admin-frontend
npm ci
npm run dev
# → http://localhost:5174
```

---

## Структура проекта

### Общая структура

```
insulin-pump-sim/
├── docker-compose.yml                    # четыре приложения + Caddy, без БД
├── Caddyfile                             # три HTTPS-хоста, маршруты UI и Swagger
├── README.md
├── infrastructure/
│   └── caddy/Dockerfile                  # Caddy без root и file capabilities
└── services/
    ├── ips-backend/
    │   ├── AGENTS.md
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   ├── config/
    │   └── src/ips_backend/
    ├── ips-telemetry-service/
    │   ├── AGENTS.md
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   ├── config/
    │   └── src/ips_telemetry_service/
    ├── ips-frontend/
    │   ├── AGENTS.md
    │   ├── Dockerfile
    │   ├── nginx.conf                    # полный конфиг → /etc/nginx/nginx.conf
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── vite.config.ts
    │   └── src/
    └── ips-admin-frontend/
        ├── AGENTS.md
        ├── Dockerfile
        ├── nginx.conf                    # HTTP-фрагмент map + server → conf.d/default.conf
        ├── package.json
        ├── package-lock.json
        ├── vite.config.ts
        └── src/
```

### services/ips-frontend/src/ — Фронтенд

```
src/
├── main.tsx                              # точка входа: ReactDOM.createRoot + BrowserRouter
├── App.tsx                               # React Router: Layout + маршруты страниц
├── index.css                             # дизайн-токены и компонентные стили Tailwind v4
│
├── config/                               # статические конфигурации
│   ├── polling.ts                        # POLLING_INTERVAL_MS, MAX_ERROR_RETRIES
│   └── pump.ts                           # управление pump_id через localStorage + CustomEvent
│
├── services/                             # инфраструктурные сервисы
│   └── api/                              # слой работы с HTTP API
│       ├── types.ts                      # TypeScript-типы и enum'ы (PumpState, AlertLevel, ...)
│       ├── client.ts                     # axios instance (baseURL: '/api/v1')
│       └── api.ts                        # функции запросов (getPumpStatus, resetPumpBlock, ...)
│
├── context/                              # React Context (глобальное состояние)
│   └── AlertsContext.tsx                 # глобальное состояние тревог + polling для alerts_count
│
├── hooks/                                # кастомные React-хуки
│   ├── usePumpState.ts                   # состояние помпы + polling + bolus override
│   ├── usePumpSettings.ts                # форма настроек + валидация + сохранение
│   ├── usePumpId.ts                      # управление pump_id в PumpHeader
│   └── useTelemetryScenarios.ts          # список сценариев + запуск/остановка
│
├── components/                           # переиспользуемые UI-компоненты
│   ├── Layout.tsx                        # сайдбар (навигация + DevPanel) + Outlet
│   ├── PumpHeader.tsx                    # заголовок с полем ввода pump_id
│   ├── DevPanel.tsx                      # панель разработчика (ручная отправка телеметрии)
│   ├── GlucoseDisplay.tsx                # большой дисплей текущей глюкозы
│   ├── BolusPanel.tsx                    # управление болюсом (Ввести / Снять блокировку)
│   ├── BasalRateCard.tsx                 # карточка базальной скорости с прогресс-баром
│   ├── MessageFeed.tsx                   # лента сообщений (React.memo)
│   └── StatusBadge.tsx                   # универсальный бейдж статуса
│
└── pages/                                # страницы-маршруты
    ├── DashboardPage.tsx                 # /dashboard — главный экран
    ├── TelemetryPage.tsx                 # /telemetry — сценарии генерации
    ├── AlertsPage.tsx                    # /alerts — список активных тревог
    └── SettingsPage.tsx                  # /settings — пороги и лимиты
```

### services/ips-backend/src/ — Бэкенд

```
src/
├── __init__.py
│
└── ips_backend/
    ├── __init__.py
    ├── main.py                                 # точка входа: uvicorn.run()
    │
    ├── app/                                    # HTTP-слой (FastAPI)
    │   ├── app.py                              # FastAPI instance + lifespan + CORS + роутеры
    │   │
    │   ├── config/
    │   │   └── logger_setup.py                 # инициализация JSON-логирования
    │   │
    │   ├── dependencies/
    │   │   └── dependencies.py                 # Depends(get_telemetry_client)
    │   │
    │   ├── models/                             # Pydantic-модели запросов/ответов
    │   │   ├── pump/
    │   │   │   ├── alert_request.py            # AlertRequest (для DELETE)
    │   │   │   ├── alert_response.py           # AlertResponse
    │   │   │   ├── bolus_deliver_response.py
    │   │   │   ├── pump_state_response.py      # PumpStateResponse + alerts_count
    │   │   │   └── reset_block_response.py
    │   │   │
    │   │   ├── settings/
    │   │   │   ├── settings_request.py         # SettingsRequest + is_valid()
    │   │   │   └── settings_response.py        # SettingsResponse + SettingsRange
    │   │   │
    │   │   └── telemetry/
    │   │       ├── telemetry_request.py        # TelemetryRequest
    │   │       └── telemetry_response.py       # TelemetryResponse
    │   │
    │   └── routers/                            # API эндпоинты
    │       ├── pumps_router.py                 # /pumps/{pump_id}/status, alerts, bolus, block
    │       ├── telemetry_router.py             # /pumps/{pump_id}/telemetry (приём данных)
    │       ├── telemetry_service_router.py     # /pumps/{pump_id}/scenarios (прокси)
    │       └── settings_router.py              # /pumps/{pump_id}/settings
    │
    ├── pump/                                   # бизнес-логика; settings_control пока связан с API-моделью
    │   ├── pump.py                             # класс Pump — агрегатор компонентов
    │   ├── pumps_registry.py                   # PumpsRegistry (singleton) — dict[pump_id, Pump]
    │   │
    │   ├── control/                            # алгоритмы управления
    │   │   ├── pump_auto_control.py            # обработка телеметрии (match/case)
    │   │   ├── pump_manual_control.py          # bolus, reset блока, on/off
    │   │   ├── pump_setting_control.py         # изменение настроек
    │   │   └── alerts_recorder.py              # deque(maxlen) для истории тревог
    │   │
    │   ├── data/                               # dataclass-модели домена
    │   │   ├── pump_state.py                   # PumpState + merge_state()
    │   │   ├── pump_settings.py                # PumpSettings с computed_field
    │   │   ├── status.py                       # Enum'ы: GlucoseLevel, AlertLevel, BolusStatus
    │   │   ├── telemetry.py                    # Telemetry dataclass
    │   │   └── alert.py                        # Alert dataclass
    │   │
    │   └── telemetry/
    │       └── receiver.py                     # приём и хранение последней телеметрии
    │
    ├── telemetry_client/                       # HTTP-клиент к Telemetry Service
    │   ├── client.py                           # TelemetryClient (httpx2.AsyncClient)
    │   └── models/
    │       ├── scenario_response.py
    │       ├── start_scenario_response.py
    │       └── stop_scenario_response.py
    │
    └── config/                                 # конфигурация приложения
        ├── loader/
        │   ├── settings.py                     # AppSettings (pydantic-settings)
        │   ├── aggregated_source.py            # AggregatedConfigSource (deep merge)
        │   └── paths.py                        # PROJECT_ROOT
        ├── app_config.py                       # AppConfig (alerts_limit)
        ├── service_config.py                   # ServiceConfig (host, port, timeouts)
        ├── logger_config.py                    # LoggerConfig (path, level)
        └── telemetry_client_config.py          # TelemetryClientConfig (base_url, port)

config/                                         # YAML-конфиги (читаются AggregatedConfigSource)
├── app.yaml                                    # app.alerts_limit
├── service.yaml                                # host, port, timeouts, reload
├── logger.yaml                                 # path, level, write_to_file
└── telemetry_client.yaml                       # base_url, port, timeout
```

### services/ips-telemetry-service/src/ — Сервис телеметрии

```
src/
├── __init__.py
│
└── ips_telemetry_service/
    ├── __init__.py
    ├── main.py                             # точка входа: uvicorn.run()
    │
    ├── app/                                # HTTP-слой (FastAPI)
    │   ├── app.py                          # FastAPI instance + lifespan + CORS
    │   │
    │   ├── config/
    │   │   └── logger_setup.py             # инициализация JSON-логирования
    │   │
    │   ├── dependencies/
    │   │   └── dependencies.py             # Depends(get_telemetry_service)
    │   │
    │   └── routers/
    │       └── scenario_router.py          # /scenarios (управление генерацией)
    │
    ├── service/
    │   └── telemetry_service.py            # TelemetryService — ядро:
    │                                       # - dict[pump_id, asyncio.Task]
    │                                       # - dict[pump_id, httpx2.AsyncClient]
    │                                       # - _generation_loop()
    │
    ├── scenarios/                          # сценарии генерации
    │   ├── scenario.py                     # Scenario + ScenarioStep (dataclass)
    │   ├── scenarios_registry.py           # словарь {name: Scenario}
    │   │
    │   └── data/                           # предопределённые сценарии
    │       ├── raising_scenario.py         # постепенный рост глюкозы
    │       └── low_high_scenario.py        # скачок с 1.0 до 10.0
    │
    └── config/                             # конфигурация
        ├── loader/
        │   ├── settings.py                 # AppSettings (pydantic-settings)
        │   ├── aggregated_source.py        # AggregatedConfigSource (deep merge)
        │   └── paths.py                    # PROJECT_ROOT
        ├── service_config.py               # ServiceConfig
        ├── telemetry_config.py             # TelemetryConfig (backend_url, interval, dry_run)
        └── logger_config.py                # LoggerConfig

config/                                     # YAML-конфиги
├── service.yaml                            # host, port
├── telemetry.yaml                          # backend_url, interval, dry_run
└── logger.yaml                             # path, level
```

---

### services/ips-admin-frontend/src/ — Админ-панель

```text
src/
├── main.tsx / App.tsx                   # BrowserRouter, / → /dashboard
├── index.css                           # тема admin-* и компонентные стили
├── config/polling.ts
├── services/api/
│   ├── client.ts                       # api и telemetryApi — два Axios-клиента
│   ├── api.ts
│   └── types.ts
├── hooks/
│   ├── useGenerators.ts                # polling, действия, поиск, фильтры, сортировка
│   └── useScenarios.ts
├── components/
│   ├── Layout.tsx
│   ├── CreateGeneratorBlock.tsx
│   ├── LockToggle.tsx                   # локальное состояние, без серверного действия
│   ├── StopAllButton.tsx
│   └── ConfirmModal.tsx
└── pages/DashboardPage.tsx
```

## API

### Общие принципы

- **Префикс прикладного API:** `/api/v1`; пути в таблицах ниже указаны без этого префикса. `/docs`, `/redoc` и `/openapi.json` находятся вне него.
- **`pump_id`** — строка, идентификатор помпы (multi-tenancy)
- **Формат данных:** JSON (`Content-Type: application/json`)
- **Ожидаемая единица глюкозы:** `mmol/L`. Генератор и UI используют её, но backend пока не проверяет единицы и не конвертирует их.

---

### Backend (ips-backend, порт 8000)

#### Группа **Pumps** — управление помпой

| Метод  | Путь                             | Описание                              | Тело запроса  | Ответ                                                   |
|--------|----------------------------------|---------------------------------------|---------------|---------------------------------------------------------|
| `GET`  | `/pumps/{pump_id}/status`        | Текущее состояние помпы               | —             | `PumpStateResponse`                                     |
| `POST` | `/pumps/{pump_id}/bolus/deliver` | Команда болюса (см. известные ошибки) | —             | `BolusDeliverResponse`; сейчас ошибочно всегда `200 OK` |
| `POST` | `/pumps/{pump_id}/block/reset`   | Снять блокировку болюса               | —             | `ResetBlockResponse` (200 / 403)                        |

#### Группа **Telemetry** — приём значений глюкозы

| Метод  | Путь                         | Описание                   | Тело запроса       | Ответ                 |
|--------|------------------------------|----------------------------|--------------------|-----------------------|
| `GET`  | `/pumps/{pump_id}/telemetry` | Последнее значение глюкозы | —                  | `TelemetryResponse`   |
| `POST` | `/pumps/{pump_id}/telemetry` | Принять новое значение     | `TelemetryRequest` | `200 OK`, JSON `null` |

`TelemetryRequest`:
```json
{
  "glucose_value": 5.5,
  "glucose_unit": "mmol/L",
  "timestamp": "2026-08-10T15:30:00Z"
}
```

#### Группа **Alerts** — тревоги помпы

| Метод    | Путь                          | Описание                                       | Тело запроса   | Ответ                 |
|----------|-------------------------------|------------------------------------------------|----------------|-----------------------|
| `GET`    | `/pumps/{pump_id}/alerts`     | Ограниченный журнал тревог и переходов в норму | —              | `list[AlertResponse]` |
| `DELETE` | `/pumps/{pump_id}/alerts`     | Удалить одну тревогу                           | `AlertRequest` | `list[AlertResponse]` |
| `DELETE` | `/pumps/{pump_id}/alerts/all` | Очистить все тревоги                           | —              | `list[AlertResponse]` |

`AlertRequest` (для DELETE одной тревоги):
```json
{
  "level": "critical",
  "level_str": "Критический",
  "message": "...",
  "action_message": "...",
  "timestamp": "2026-08-10T15:30:00Z"
}
```

Для удаления передавайте поля записи из `GET /alerts`, включая исходный `timestamp`, без изменения. `alerts_count` — длина журнала, а не число только критических или ещё не устранённых состояний. До первого измерения `GET /telemetry` возвращает объект с полями `null`.

#### Группа **Settings** — настройки помпы

| Метод  | Путь                        | Описание                                 | Тело запроса      | Ответ                          |
|--------|-----------------------------|------------------------------------------|-------------------|--------------------------------|
| `GET`  | `/pumps/{pump_id}/settings` | Текущие настройки + допустимые диапазоны | —                 | `SettingsResponse`             |
| `POST` | `/pumps/{pump_id}/settings` | Сохранить настройки                      | `SettingsRequest` | `SettingsResponse` (200 / 403) |

`SettingsRequest`:
```json
{
  "low_critical_level": 2.8,
  "low_warning_level": 3.9,
  "low_notification_level": 4.5,
  "high_notification_level": 10.0,
  "high_warning_level": 13.9,
  "high_critical_level": 16.7,
  "user_max_basal_limit": 250
}
```

При логически некорректных соотношениях (например, `low > high`) backend вернёт **403** и текущие настройки из памяти. Пороги должны находиться в диапазоне 2–20, лимит базала — 100–350; ошибки типов, обязательных полей и диапазонов возвращают **422**. В `SettingsResponse` также входит `range` с допустимыми границами.

#### Группа **Telemetry Scenarios** — прокси в Telemetry Service

Эндпоинты проксируются через `TelemetryClient` в сервис генерации.

| Метод  | Путь                                         | Описание                  | Тело запроса   | Ответ                    |
|--------|----------------------------------------------|---------------------------|----------------|--------------------------|
| `GET`  | `/pumps/{pump_id}/scenarios`                 | Список всех сценариев     | —              | `list[ScenarioResponse]` |
| `GET`  | `/pumps/{pump_id}/scenario/current`          | Текущий активный сценарий | —              | `ScenarioResponse`       |
| `POST` | `/pumps/{pump_id}/scenarios/{scenario_name}` | Запустить сценарий        | —              | `StartScenarioResponse`  |
| `POST` | `/pumps/{pump_id}/scenario/stop`             | Остановить генерацию      | —              | `StopScenarioResponse`   |

`StartScenarioResponse` содержит `pump_id` и **`scenarios_name`** (именно такое имя поля сейчас в коде), `StopScenarioResponse` — `pump_id`. При отсутствии активного сценария backend возвращает `{"scenario_name": "", "description": ""}`. Ответ запуска/остановки пока не гарантирует успех операции в telemetry: обработка upstream-ошибок требует исправления.

---

### ⚙️ Telemetry Service (ips-telemetry-service, порт 8001)

Пользовательский UI обращается к нему через backend, админ-панель — через собственный прокси напрямую. В Compose прямой API также доступен локально на `127.0.0.1:8001`, но не на сетевых интерфейсах хоста.

#### Группа **Scenarios** — управление сценариями

| Метод  | Путь                         | Описание                     | Query-параметры | Тело запроса  | Ответ                                |
|--------|------------------------------|------------------------------|-----------------|---------------|--------------------------------------|
| `GET`  | `/scenarios`                 | Список всех сценариев        | —               | —             | `list[{scenario_name, description}]` |
| `GET`  | `/scenario/current`          | Текущий активный сценарий    | `pump_id`       | —             | `{scenario_name: str}`               |
| `POST` | `/scenarios/{scenario_name}` | Запустить сценарий для помпы | `pump_id`       | —             | `200 OK`, JSON `null`                |
| `POST` | `/scenario/stop`             | Остановить генерацию         | `pump_id`       | —             | `200 OK`, JSON `null`                |

Если сценарий не активен, `GET /scenario/current` возвращает `{"scenario_name": ""}`. Методы Python `get_status_all()` и `stop_all()` существуют, но HTTP-маршрутов `/generators` и `/scenario/stop/all` пока нет.

#### Пример запроса

```bash
# Получить список сценариев
curl http://localhost:8001/api/v1/scenarios

# Запустить сценарий для конкретной помпы
curl -X POST "http://localhost:8001/api/v1/scenarios/raising_scenario?pump_id=pump-1"

# Остановить генерацию
curl -X POST "http://localhost:8001/api/v1/scenario/stop?pump_id=pump-1"

# Узнать текущий активный сценарий
curl "http://localhost:8001/api/v1/scenario/current?pump_id=pump-1"
```

#### Доступные сценарии

| `scenario_name`     | Описание                                                                                        |
|---------------------|-------------------------------------------------------------------------------------------------|
| `raising_scenario`  | 1 такт случайного значения 2–4, затем 1 такт 3–5, затем 4 такта по 10.0; повторяется циклически |
| `low_high_scenario` | 2 такта по 1.0, затем 2 такта по 10.0; повторяется циклически                                   |

#### Сухой прогон (dry-run)

При `telemetry.dry_run: true` в `config/telemetry.yaml` данные **не отправляются** на бэкенд, а только логируются. Полезно для отладки сценариев без поднятого бэкенда.

---

## Сервисы

### 1. Frontend (ips-frontend)

**Стек:** React 19.2, TypeScript 6.0, Vite 8.2, Tailwind CSS v4, React Router 7, Axios, Oxlint. `strict` в текущем TypeScript-конфиге не включён; `noUnusedLocals` и `noUnusedParameters` включены. `erasableSyntaxOnly: false` позволяет существующие `enum`.

#### Основные страницы

| Маршрут      | Страница          | Функциональность                                        |
|--------------|-------------------|---------------------------------------------------------|
| `/dashboard` | Панель управления | Текущая глюкоза, базал, болюс, сообщения помпы          |
| `/telemetry` | Телеметрия        | Список сценариев, Play/Stop кнопки генерации            |
| `/alerts`    | Тревоги           | Ограниченный журнал событий, очистка одной/всех записей |
| `/settings`  | Настройки         | Пороги глюкозы, лимиты базала, Сохранить/Отмена         |

#### Особенности

- **Дизайн-токены и компонентные стили** — `src/index.css` (Tailwind v4 CSS-first); в JSX также встречаются utility-классы и inline-стили
- **`pump_id`** хранится в `localStorage`, все API-запросы подставляют его в URL
- **Кнопка болюса** пока только ждёт 500 мс и перечитывает статус; HTTP-команда введения из UI не отправляется
- **Разблокировка** использует `bolusStatusOverride`; он может скрыть последующую блокировку, поэтому это известный дефект, а не гарантия разрешения действия
- **Счётчик тревог** в сайдбаре — обновляется через глобальный `AlertsContext`
- **DevPanel** в сайдбаре — ручная отправка значения глюкозы для тестирования

#### Запуск
```bash
npm ci
npm run dev      # dev-сервер с HMR
npm run build    # production-сборка
```

Команды выполняются из `services/ips-frontend`. Подробнее: [Frontend AGENTS.md](./services/ips-frontend/AGENTS.md).

---

### 2. Backend (ips-backend)

**Стек:** Python 3.14, FastAPI, Pydantic v2, uvicorn, httpx2, python-json-logger

На VDS Swagger backend доступен по адресу https://ips.alexgallax-edu.ru/docs; прямой HTTP-порт 8000 остаётся только на loopback.

#### Структура помпы

Класс `Pump` — агрегатор компонентов:

| Компонент                        | Назначение                                                     |
|----------------------------------|----------------------------------------------------------------|
| `state: PumpState`               | Текущее состояние (глюкоза, is_on, bolus_status, message, ...) |
| `settings: PumpSettings`         | Пороги глюкозы и лимиты базала                                 |
| `alerts_recorder: AlertRecorder` | История тревог (deque с maxlen)                                |
| `auto_control`                   | Автоматическая обработка телеметрии (match/case)               |
| `manual_control`                 | Ручные действия (bolus, reset блока)                           |
| `receiver`                       | Хранение последней телеметрии                                  |
| `settings_control`               | Изменение настроек через API                                   |

#### Обработка телеметрии (match/case)

Проверки идут в порядке: low critical → low warning → low notification → high critical → high warning → high notification → normal. При стандартных настройках и без ранее установленной ручной блокировки:

| Условие     | Тревога        | Статус болюса  | Базальная скорость                         |
|-------------|----------------|----------------|--------------------------------------------|
| `v <= 2.8`  | `critical`     | `blocked`      | 0%, устанавливает `manual_action_required` |
| `v <= 3.9`  | `warning`      | `suspended`    | 20%                                        |
| `v <= 4.5`  | `notification` | `with_warning` | 50%                                        |
| `v >= 16.7` | `critical`     | `limit_check`  | `min(300, max_basal_limit)`%               |
| `v >= 13.9` | `warning`      | `allowed`      | `min(180, max_basal_limit)`%               |
| `v >= 10.0` | `notification` | `allowed`      | `min(120, max_basal_limit)`%               |
| Иначе       | `off`          | `allowed`      | 100%                                       |

`max_basal_limit = min(user_max_basal_limit, hardware_max_basal_limit)`; значения по умолчанию — 250% и 350%. После критического понижения ручная блокировка удерживает базал на 0% даже при нормализации глюкозы.

#### Запуск
```bash
python -m pip install -r requirements.txt
python -m src.ips_backend.main
```

Команды выполняются из `services/ips-backend` в активированном окружении Python 3.14. Подробнее: [Backend AGENTS.md](./services/ips-backend/AGENTS.md).

---

### 3. Telemetry Service (ips-telemetry-service)

**Стек:** Python 3.14, FastAPI, Pydantic v2, httpx2, asyncio

На VDS Swagger telemetry доступен по адресу https://telemetry.alexgallax-edu.ru/docs, API — на том же хосте под `/api/v1`. Прямой HTTP-порт 8001 остаётся только на loopback.

#### Назначение

Сервис генерирует значения глюкозы по заданным **сценариям** и отправляет их на Backend. Используется для симуляции CGM-сенсора.

#### Модель сценария

Каждый сценарий — последовательность шагов (`ScenarioStep`):

```python
ScenarioStep(const=5.0, duration=3)           # 3 такта по 5.0 ммоль/л
ScenarioStep(min=3.0, max=7.0, duration=2)    # 2 такта в диапазоне
```

**Текущая валидация:** достаточно `const` **или** пары `min` и `max` (OR, не XOR). Если заданы оба варианта, используется `const`; так устроен третий шаг `raising_scenario`. Положительная длительность, порядок границ и непустой список шагов пока не проверяются.

#### Особенности

- **Per-pump задачи и клиенты**: `asyncio.Task`, `httpx2.AsyncClient`, `stop_event`; сами изменяемые объекты сценариев пока общие
- **Остановка без ожидания полного интервала**: `stop_event`, отмена задачи и `asyncio.wait_for(stop_event.wait(), timeout=...)` в цикле
- **Dry-run режим** (`telemetry.dry_run: true`) — для отладки без бэкенда
- **Циклические сценарии**: после последнего шага начинается сначала

#### Запуск
```bash
python -m pip install -r requirements.txt
python -m src.ips_telemetry_service.main
```

Команды выполняются из `services/ips-telemetry-service` в активированном окружении Python 3.14. 📄 Подробнее: [Telemetry Service AGENTS.md](./services/ips-telemetry-service/AGENTS.md).

### 4. Admin Frontend (ips-admin-frontend)

Стек аналогичен основному UI: React 19.2, TypeScript 6.0, Vite 8.2, React Router 7, Tailwind v4, Axios и Oxlint. Здесь `erasableSyntaxOnly: true`, `strict` не включён. Единственная страница — `/dashboard`, корень перенаправляет на неё.

| Функция                                            | Текущий статус                                                                          |
|----------------------------------------------------|-----------------------------------------------------------------------------------------|
| Список сценариев и запуск для введённого `pump_id` | Подключены к существующему API telemetry                                                |
| Остановка одной помпы                              | API существует; доступность строки в списке зависит от ещё отсутствующего `/generators` |
| Список генераторов, поиск, фильтры и сортировка    | UI реализован; `GET /api/v1/generators` в telemetry возвращает 404                      |
| «Остановить все» с подтверждением                  | UI реализован; `POST /api/v1/scenario/stop/all` возвращает 404                          |
| Переключатель «Блокировка»                         | Только локальный `useState`, без ограничений на сервере                                 |
| Поле и кнопка «Лимит»                              | Поле редактируется, обработчик кнопки пустой                                            |
| `checkHealth()`                                    | Обёртка для отсутствующего backend `/api/v1/health`; сейчас не вызывается UI            |

`useGenerators` опрашивает список с интервалом 3 секунды после успешного ответа; после 5 последовательных ошибок polling останавливается. «Обновить» сбрасывает счётчик и возобновляет запросы. Задержка повторов линейная: `2000 × число ошибок` мс.

Из `services/ips-admin-frontend`: `npm ci`, `npm run dev`, `npm run build`, `npm run lint`. 📄 Подробнее: [Admin Frontend AGENTS.md](./services/ips-admin-frontend/AGENTS.md).

---

## Конфигурация

Каждый Python-сервис использует **агрегированную систему конфигурации**. Приоритеты от низкого к высокому:

1. Значения по умолчанию Pydantic-моделей
2. YAML-файлы из `config/`
3. Системные переменные окружения (с префиксами)
4. `.env` **в каталоге соответствующего Python-сервиса**
5. Явные аргументы `AppSettings(...)`, если настройки создаются программно

`PROJECT_ROOT` указывает на каталог сервиса, не на корень монорепозитория. YAML-файлы обязательны; настройки кэшируются `app_settings()` до перезапуска процесса. `.env` читается простым собственным парсером, без полноценной подстановки переменных dotenv.

Корневой `.env` используется **Compose для подстановок `${...}`** и автоматически в Python-сервисы не загружается. Dockerfile не копируют сервисные `.env` в образы. Добавленные в корневой `.env` произвольные `APP_*`/`TEL_*` не попадут в контейнер, если для них нет соответствующей передачи в Compose.

Оба Python-образа задают собственные контейнерные значения по умолчанию: `SVC_HOST=0.0.0.0`, `SVC_PORT=8000`, `SVC_RELOAD=false`. Они действуют и при `docker run` без Compose и переопределяют локальные YAML через окружение. Адреса соседних сервисов при самостоятельном запуске нужно настраивать отдельно. Процесс работает от `appuser`; исходники и конфигурация принадлежат root и недоступны ему на запись, `/app/logs` доступен для записи. `PYTHONDONTWRITEBYTECODE=1` отключает создание `.pyc`, `PYTHONUNBUFFERED=1` — буферизацию stdout/stderr Python.

### Docker Compose

Параметры подстановки: `CADDY_HTTP_PORT` (80), `CADDY_HTTPS_PORT` (443), `ADMIN_FRONTEND_PORT` (8080), `BACKEND_PORT` (8000), `TELEMETRY_PORT` (8001), `TELEMETRY_INTERVAL` (5), `LOG_LEVEL` (INFO). `FRONTEND_PORT` больше не используется: публичные порты теперь принадлежат Caddy. На VDS оставьте 80/443, если нет отдельно настроенного внешнего перенаправления этих портов.

Прямые служебные порты привязаны к `127.0.0.1` независимо от номера в `.env`; frontend отдельного порта хоста не имеет. Общий блок `x-app-options` задаёт приложениям и Caddy запрет повышения привилегий, снятие Linux capabilities и ротацию логов. Не удаляйте его наследование `<<: *app-options` при добавлении или изменении сервисов.

Хосты задаются в корневом [Caddyfile](./Caddyfile). Образ шлюза собирается из [infrastructure/caddy/Dockerfile](./infrastructure/caddy/Dockerfile) на основе `caddy:2.11-alpine`, работает от UID 10001 и слушает 8080/8443. File capability официального бинарника удалена при сборке, поэтому он запускается с `cap_drop: [ALL]`. Caddy не зависит от готовности upstream при старте: он может обслуживать ACME независимо, а до запуска приложений возвращать 502.

### Backend (ips-backend)

**Файлы:** `config/app.yaml`, `config/service.yaml`, `config/logger.yaml`, `config/telemetry_client.yaml`

**Переменные окружения:**

| Префикс  | Маппится в           | Пример                            |
|----------|----------------------|-----------------------------------|
| `SVC_`   | `service.*`          | `SVC_HOST=0.0.0.0`                |
| `APP_`   | `app.*`              | `APP_ALERTS_LIMIT=200`            |
| `TELCL_` | `telemetry_client.*` | `TELCL_BASE_URL=http://telemetry` |
| `LOG_`   | `logger.*`           | `LOG_LEVEL=DEBUG`                 |

В YAML backend: `alerts_limit=5`, адрес telemetry — `http://127.0.0.1:8001`, HTTP-таймаут — 5 с, reload включён. В Compose: `APP_ALERTS_LIMIT=100`, telemetry — `http://telemetry:8000`, таймаут — 10 с, reload выключен. Зависимостей от БД и переменных подключения в Compose нет.

### Telemetry Service (ips-telemetry-service)

**Файлы:** `config/service.yaml`, `config/telemetry.yaml`, `config/logger.yaml`

| Префикс   | Маппится в    | Пример             |
|-----------|---------------|--------------------|
| `SVC_`    | `service.*`   | `SVC_PORT=8001`    |
| `TEL_`    | `telemetry.*` | `TEL_DRY_RUN=true` |
| `LOG_`    | `logger.*`    | `LOG_LEVEL=INFO`   |

`TEL_TELEMETRY_INTERVAL_SECONDS` и `TEL_DRY_RUN` работают при локальном запуске; специальный префикс `TEL_` уже есть. В Docker интервал передаётся через Compose-переменную `TELEMETRY_INTERVAL`. Для dry-run в Docker нужно изменить или переопределить явно заданное `TEL_DRY_RUN=false` в окружении сервиса.

### Frontend (ips-frontend)

- **Polling интервал:** `src/config/polling.ts` (`POLLING_INTERVAL_MS = 3000`)
- **Дефолтный pump_id:** `pump-1` (меняется через поле «Название помпы» в UI)
- **Dev-прокси:** `vite.config.ts` → `/api/*` на `http://127.0.0.1:8000`

У админки собственные `src/config/polling.ts` и `vite.config.ts`: `/api/*` → `127.0.0.1:8000`, `/telemetry-api/*` → `127.0.0.1:8001` с заменой префикса на `/api`. Явный IPv4-адрес позволяет работать с API, опубликованными только на loopback, без зависимости от разрешения `localhost` в IPv6. В Docker обе цели имеют порт 8000 и доступны по DNS-именам сервисов. Изменение внешних портов Compose не меняет Vite-прокси: при смешанном запуске обновите их отдельно.

---

## Примеры использования

### Сценарий 1: Студент работает со своей помпой

1. Открыть Frontend: `http://localhost` (Docker) или `http://localhost:5173` (Vite)
2. В поле «Название помпы» ввести `student_ivanov`, нажать **Применить**. Не оставляйте `?pump=...` в URL при дальнейшем переключении: этот параметр сейчас повторно переопределяет выбор.
3. Запустить сценарий `raising_scenario` на вкладке **Телеметрия** (кнопка ▶)
4. Наблюдать на Dashboard изменения глюкозы и состояния
5. Остановить сценарий перед ручной отправкой измерений, чтобы генератор не перезаписывал их

Для снятия ручной блокировки текущее значение должно быть выше `low_notification_level`; при стандартных настройках это 4.5. Кнопка «Ввести болюс» пока не отправляет команду backend.

### Сценарий 2: Тестирование критической гипогликемии

```bash
# Отправить низкое значение глюкозы (команды date совместимы с macOS и Linux)
curl -X POST http://localhost:8000/api/v1/pumps/pump-1/telemetry \
  -H "Content-Type: application/json" \
  -d "{\"glucose_value\": 2.5, \"glucose_unit\": \"mmol/L\", \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}"

# Проверить состояние
curl http://localhost:8000/api/v1/pumps/pump-1/status | jq '.alert_level, .bolus_status'
# → "critical", "blocked"

# Попытаться снять блокировку
curl -X POST http://localhost:8000/api/v1/pumps/pump-1/block/reset
# → HTTP 403: "Блокировка помпы не может быть снята при текущем уровне глюкозы"

# Поднять глюкозу до нормы
curl -X POST http://localhost:8000/api/v1/pumps/pump-1/telemetry \
  -H "Content-Type: application/json" \
  -d "{\"glucose_value\": 5.5, \"glucose_unit\": \"mmol/L\", \"timestamp\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}"

# Теперь разблокировка пройдёт
curl -X POST http://localhost:8000/api/v1/pumps/pump-1/block/reset
# → HTTP 200: "Блокировка помпы снята"
```

Текущий backend при сбросе меняет только `manual_action_required`: базал и `bolus_status` пересчитываются лишь при следующей телеметрии. Это известная ошибка; сообщение «блокировка снята» не означает, что все поля состояния уже обновлены.

### Сценарий 3: Настройка порогов

1. Открыть **Настройки** → изменить пороги → **Сохранить**
2. Если значения логически некорректны (например, `low > high`) → бэкенд вернёт `403`, UI покажет «Некорректные значения настроек» и применит актуальные значения из ответа

### Сценарий 4: Изолированная работа нескольких студентов

```bash
# Иванов работает с student_ivanov
curl http://localhost:8000/api/v1/pumps/student_ivanov/status

# Петров получает отдельное состояние backend
curl http://localhost:8000/api/v1/pumps/student_petrov/status
```

Изоляция объектов `Pump` не распространяется на изменяемые счётчики сценариев telemetry: запуск одного сценария для нескольких помп пока влияет на последовательность его шагов.

---

## Разработка

### Требования

- Python 3.14+
- Для локальной разработки рекомендуется **Node.js 24 LTS** и npm, как в Docker builder; технический минимум текущего Vite — 20.19+ в ветке 20 либо 22.12+, но Node.js 20 уже не поддерживается
- Docker Engine/Desktop и Compose v2 (для контейнерного запуска)
- `jq` опционален: используется только для форматирования JSON в примерах

### Тестирование

Проектные автотесты пока не добавлены. У frontend нет скрипта `npm test`; `pytest`, `ruff` и `mypy` не входят в текущие Python `requirements.txt`. Не считайте эти команды готовым настроенным набором проверок.

Базовые проверки из корня репозитория на VDS после настройки DNS:

```bash
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose ps
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose exec -T frontend nginx -t
docker compose exec -T admin-frontend nginx -t
curl --fail https://ips.alexgallax-edu.ru/health
curl --fail https://ips-admin.alexgallax-edu.ru/health
curl --fail https://ips.alexgallax-edu.ru/openapi.json
curl --fail https://telemetry.alexgallax-edu.ru/openapi.json
curl --fail https://telemetry.alexgallax-edu.ru/api/v1/scenarios
curl --fail https://ips-admin.alexgallax-edu.ru/telemetry-api/v1/scenarios
curl --fail https://ips.alexgallax-edu.ru/api/v1/pumps/pump-1/status
```

Проверяйте не только HTML и статус `healthy`, но и ответы API, приход телеметрии и остановку задачи. Отсутствующие административные маршруты из раздела сервисов должны учитываться отдельно.

### Линтинг

```bash
# Python: необязательные проверки, инструменты устанавливаются отдельно
ruff check src/
mypy src/

# Из корня репозитория, при установленных npm-зависимостях
npm --prefix services/ips-frontend run lint
npm --prefix services/ips-frontend run build
npm --prefix services/ips-admin-frontend run lint
npm --prefix services/ips-admin-frontend run build
```

Python-команды запускаются из каталога соответствующего сервиса. `npm run lint` использует **Oxlint**, не ESLint; правила находятся в `.oxlintrc.json`. Успешный lint не заменяет TypeScript-проверку в `npm run build`.

### Swagger UI (интерактивная документация)

- **Backend:** http://localhost:8000/docs
- **Telemetry Service:** http://localhost:8001/docs

Через HTTPS на VDS: [Backend Swagger](https://ips.alexgallax-edu.ru/docs), [Telemetry Swagger](https://telemetry.alexgallax-edu.ru/docs). Их OpenAPI-схемы находятся на `/openapi.json` тех же хостов, а не на домене админки.

---

## 📚 Дополнительная документация

Каждый из четырёх прикладных сервисов имеет **`AGENTS.md`** с:
- описанием архитектуры и соглашений
- чек-листами для PR
- типичными задачами и решениями
- списком «чего НЕ делать»

[Frontend AGENTS.md](./services/ips-frontend/AGENTS.md) · [Backend AGENTS.md](./services/ips-backend/AGENTS.md) · [Telemetry Service AGENTS.md](./services/ips-telemetry-service/AGENTS.md) · [Admin Frontend AGENTS.md](./services/ips-admin-frontend/AGENTS.md)

---

## Ограничения текущей архитектуры

- **Нет персистентности**: состояние помп хранится в памяти — при перезапуске Backend теряется
- **Нет аутентификации**: любой может работать с любым `pump_id`
- **Нет авторизации доступа** к настройкам и действиям
- **Несколько workers/реплик не поддержаны**: каждый процесс получит собственный реестр помп и задач
