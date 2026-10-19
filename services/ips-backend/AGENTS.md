# AGENTS.md — ips-backend

Инструкции для работы в `services/ips-backend` монорепозитория «Инсулиновая Помпа». Пути к Python-модулям ниже указаны относительно `src/ips_backend/`, если не оговорено иное. Общие команды запуска и ограничения — в [README](../../README.md).

---

## Обзор проекта

FastAPI-приложение с отдельными объектами `Pump` по `pump_id`: состояние, настройки, **последнее** измерение телеметрии и ограниченный журнал тревог. Полной истории телеметрии нет. Идентификатор не является средством авторизации.

Всё состояние находится в памяти одного процесса, внешнего хранилища в Compose нет. Не обещайте персистентность или согласованность нескольких workers/реплик без отдельной реализации.

**Стек технологий:**
- Python **3.14**
- **FastAPI 0.141.1** (ASGI-фреймворк)
- **Pydantic 2.13.4** (модели и валидация, **не v1!**)
- **pydantic-settings** (агрегированная загрузка настроек)
- **uvicorn** (ASGI-сервер)
- **httpx2** (асинхронный HTTP-клиент для сервиса генерации)
- **python-json-logger** (структурированное JSON-логирование)
- **PyYAML** (чтение YAML-конфигов)

Версии зависимостей закреплены в `requirements.txt`; не заменяйте `httpx2` на `httpx` без проверки совместимости и обновления зависимостей.

---

## Структура проекта

```
src/
├── ips_backend/
│   ├── main.py                                 # точка входа: uvicorn.run()
│   │
│   ├── app/                                    # FastAPI-приложение (HTTP-слой)
│   │   ├── app.py                              # FastAPI instance + lifespan + CORS
│   │   ├── config/
│   │   │   └── logger_setup.py                 # инициализация JSON-логирования
│   │   ├── dependencies/
│   │   │   └── dependencies.py                 # FastAPI Depends (get_telemetry_client)
│   │   ├── models/                             # Pydantic-модели запросов/ответов
│   │   │   ├── pump/                           # AlertRequest, PumpStateResponse, ResetBlockResponse, ...
│   │   │   ├── settings/                       # SettingsRequest, SettingsResponse
│   │   │   └── telemetry/                      # TelemetryRequest, TelemetryResponse
│   │   └── routers/                            # API endpoints
│   │       ├── pumps_router.py                 # /pumps/{pump_id}/status, alerts, bolus, block
│   │       ├── telemetry_router.py             # /pumps/{pump_id}/telemetry
│   │       ├── telemetry_service_router.py     # /pumps/{pump_id}/scenarios
│   │       └── settings_router.py              # /pumps/{pump_id}/settings
│   │
│   ├── pump/                                   # бизнес-логика помпы
│   │   ├── pump.py                             # класс Pump (агрегатор компонентов)
│   │   ├── pumps_registry.py                   # PumpsRegistry — singleton-реестр помп
│   │   ├── control/                            # алгоритмы управления
│   │   │   ├── pump_auto_control.py            # логика обработки телеметрии (match/case)
│   │   │   ├── pump_manual_control.py          # ручное управление (bolus, reset)
│   │   │   ├── pump_setting_control.py         # изменение настроек
│   │   │   └── alerts_recorder.py              # deque с maxlen, запись тревог
│   │   ├── data/                               # dataclass-модели домена
│   │   │   ├── pump_state.py                   # PumpState + merge_state()
│   │   │   ├── pump_settings.py                # PumpSettings с computed_field
│   │   │   ├── status.py                       # Enum'ы: GlucoseLevel, AlertLevel, BolusStatus
│   │   │   ├── telemetry.py                    # Telemetry dataclass
│   │   │   └── alert.py                        # Alert dataclass
│   │   └── telemetry/
│   │       └── receiver.py                     # приём и хранение телеметрии
│   │
│   ├── telemetry_client/                       # клиент к сервису генерации сценариев
│   │   ├── client.py                           # TelemetryClient (httpx2.AsyncClient)
│   │   └── models/                             # Pydantic-модели ответов
│   │
│   └── config/                                 # конфигурация приложения
│       ├── loader/
│       │   ├── settings.py                     # AppSettings (pydantic-settings)
│       │   ├── aggregated_source.py            # AggregatedConfigSource (deep merge)
│       │   └── paths.py                        # PROJECT_ROOT
│       ├── app_config.py                       # AppConfig
│       ├── service_config.py                   # ServiceConfig
│       ├── logger_config.py                    # LoggerConfig
│       └── telemetry_client_config.py

config/                              # YAML-конфиги (читаются AggregatedConfigSource)
├── app.yaml                         # app.alerts_limit
├── service.yaml                     # host, port, timeouts, reload
├── logger.yaml                      # path, level, write_to_file
└── telemetry_client.yaml            # base_url, port, timeout
```

---

## Команды разработки

```bash
# Из корня репозитория; окружение создаётся при первой настройке
cd services/ips-backend
python3.14 -m venv .venv
source .venv/bin/activate

# Установка зависимостей
python -m pip install -r requirements.txt

# Запуск в режиме разработки (с reload)
python -m src.ips_backend.main

# Альтернатива: host/port/reload задаются флагами CLI, не service.yaml
python -m uvicorn src.ips_backend.app.app:app --host 127.0.0.1 --port 8000 --reload
```

Запускайте модуль из каталога сервиса: импорты используют префикс `src.ips_backend`. Не запускайте файл `main.py` напрямую. `pytest`, `ruff`, `mypy` не установлены через текущий `requirements.txt`; проектные автотесты и конфигурации этих проверок пока не добавлены. При отдельно установленных инструментах можно запускать `ruff check src/` и `mypy src/`, не считая их уже настроенным CI.

Docker-команды из корня репозитория на VDS после настройки DNS/HTTPS по README:

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose logs --tail=100 backend
```

Для локального запуска только API, без Caddy и выдачи сертификатов: `docker compose up --build -d --wait backend telemetry`.

В Compose backend слушает `backend:8000`, а прямой API опубликован только на `127.0.0.1:${BACKEND_PORT:-8000}`. Он не зависит от других сервисов при старте: `TelemetryClient.open()` создаёт клиент без запроса к удалённому сервису. Не возвращайте циклический `depends_on`: telemetry уже ждёт backend.

Общий блок `x-app-options` задаёт `no-new-privileges:true`, `cap_drop: [ALL]` и драйвер логов `local` с `max-size: 10m`, `max-file: 3`. Сохраняйте наследование этих настроек. Ограничение прямого порта не закрывает пользовательский API, доступный через frontend-прокси.

На VDS Caddy обслуживает `https://ips.alexgallax-edu.ru`: `/docs`, `/docs/*`, `/redoc` и `/openapi.json` направляются прямо в backend, остальное — в frontend nginx. Swagger доступен без авторизации по выбранной конфигурации. Не добавляйте префикс к OpenAPI URL без согласования с `Caddyfile`.

Compose задаёт `FORWARDED_ALLOW_IPS=*` для Uvicorn; nginx сохраняет HTTPS-схему Caddy через `X-Forwarded-Proto`. Это нужно для корректных HTTPS-редиректов FastAPI. Доверие допустимо только при текущем ограничении прямого порта loopback/Docker-сетью; не публикуйте его наружу без пересмотра proxy trust.

**API-документация после запуска:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

Healthcheck контейнера использует `/docs` по адресу 127.0.0.1 с таймаутом 3 с; порт получает через `app_settings().service.port`, поэтому учитывает переопределения конфигурации. Прикладного `/api/v1/health` сейчас нет; также нет HTTP-маршрутов включения/выключения помпы и перечисления всех помп.

Dockerfile сам задаёт `SVC_HOST=0.0.0.0`, `SVC_PORT=8000`, `SVC_RELOAD=false`: образ пригоден для самостоятельного запуска без зависимости от этих Compose-переопределений. Адрес telemetry всё равно настраивается отдельно. Runtime — `appuser`; код и YAML остаются root-owned, запись разрешена в `/app/logs`, но не в исходники. Сохраняйте `PYTHONDONTWRITEBYTECODE=1` и `PYTHONUNBUFFERED=1` при изменении образа; не возвращайте `chown -R` всего `/app`.

---

## Архитектурные соглашения

### 1. Разделение слоёв

**HTTP-слой** (`app/`):
- Только роутеры, Pydantic-модели запросов/ответов, FastAPI-зависимости
- Не содержит бизнес-логики — делегирует её в `pump/`
- Роутеры получают `Pump` через `pumps_registry.get_or_create_pump(pump_id)`

**Доменный слой** (`pump/`):
- Не должен зависеть от FastAPI или HTTP-моделей в новых изменениях. Сейчас `pump_setting_control.py` импортирует `SettingsRequest` из `app/`; это существующая связанность, а не образец для расширения
- Бизнес-логика: обработка телеметрии, управление состоянием, тревоги
- Dataclass'ы и Enum'ы для доменных объектов
- Асинхронные методы (`async def`) для операций, которые могут быть I/O-bound

**Клиентский слой** (`telemetry_client/`):
- Обёртка над httpx2 для общения с сервисом генерации
- Создаётся в lifespan и хранится в `app.state`
- Внедряется через FastAPI `Depends`

### 2. Multi-tenancy через `pump_id`

Вместо пользовательских сессий используется **идентификатор помпы в URL**:

```
GET  /api/v1/pumps/{pump_id}/status
POST /api/v1/pumps/{pump_id}/telemetry
```

Единый экземпляр `pumps_registry` в `pump/pumps_registry.py` хранит словарь `dict[str, Pump]`. Каждый `pump_id` получает отдельный `Pump`. Многие GET-запросы также создают его через `get_or_create_pump`; лимитов и TTL нет. Независимость объектов backend не означает независимость изменяемых сценариев telemetry.

**Никогда не используйте глобальные состояния помпы** — всегда получайте `Pump` через реестр.

### 3. Структура класса `Pump`

`Pump` — агрегатор компонентов, каждый решает свою задачу:

| Компонент                              | Назначение                                                                                               |
|----------------------------------------|----------------------------------------------------------------------------------------------------------|
| `state: PumpState`                     | Текущее состояние (is_on, глюкоза, bolus_status, message, ...)                                           |
| `settings: PumpSettings`               | Пороги глюкозы и лимиты базала                                                                           |
| `alerts_recorder: AlertRecorder`       | `deque(maxlen=alerts_limit)`; текущая проверка отличия включает timestamp и не подавляет повторы надёжно |
| `auto_control: PumpAutoControl`        | Автоматическая обработка телеметрии (match/case по диапазонам)                                           |
| `manual_control: PumpManualControl`    | Ручное управление (bolus, reset блока, on/off)                                                           |
| `receiver: Receiver`                   | Хранение последней телеметрии                                                                            |
| `settings_control: PumpSettingControl` | Изменение настроек                                                                                       |

При добавлении новой функциональности — создавайте новый контроллер и добавляйте его в `Pump.__init__`.

### 4. Обновление состояния через `merge_state`

`PumpState.merge_state(other)` предназначен для частичного обновления: `None` означает «не менять поле». Это ключевой паттерн:

```python
self.pump_state.merge_state(PumpState(
    glucose_level=GlucoseLevel.LOW,
    alert_level=AlertLevel.CRITICAL,
    bolus_status=BolusStatus.BLOCKED,
    message="Критическое понижение!",
))
```

Поля, не указанные в `PumpState(...)`, **остаются прежними**. Для новых полей используйте проверку `is not None`, а не truthiness: `False`, `0` и пустая строка могут быть значимыми значениями. В текущем поле `is_on` уже есть дефект truthiness: `pump_off()` возвращает успех, но не выключает помпу. Не копируйте эту ошибку.

### 5. Обработка телеметрии — match/case

В `PumpAutoControl.process_telemetry` используется Python 3.10+ `match/case` с guard-условиями:

```python
match current_glucose_value:
    case v if v <= self.pump_settings.low_critical_level:
        self._low_level_critical()
    case v if v <= self.pump_settings.low_warning_level:
        self._low_level_warning()
    # ... и т.д.
    case _:
        self._process_normal()
```

**Порядок критичен**: более специфичные (критические) условия должны идти первыми, т.к. match/case проверяет их сверху вниз.

Без ручной блокировки скорости по веткам: low critical — 0%, low warning — 20%, low notification — 50%, normal — 100%, high notification — `min(120, max_basal_limit)`, high warning — `min(180, max_basal_limit)`, high critical — `min(300, max_basal_limit)`. Критическое понижение устанавливает `manual_action_required=True`; последующая нормализация сама блокировку не снимает. Пороговые значения берутся из `PumpSettings`.

### 6. Система конфигурации (AggregatedConfigSource)

Приоритет от низкого к высокому:

1. Значения по умолчанию из Pydantic-моделей
2. YAML-файлы из `config/` (`app.yaml`, `service.yaml`, ...)
3. Системные переменные окружения (с префиксами)
4. `.env` в `services/ips-backend`
5. Явные аргументы `AppSettings(...)`, если переданы

`init_settings` стоит первым в `settings_customise_sources` и имеет наивысший приоритет по правилам pydantic-settings; комментарий в исходнике об обратном порядке неточен. `PROJECT_ROOT` — каталог сервиса. YAML-файлы обязательны, `.env` необязателен и разбирается собственным простым парсером. `app_settings()` кэширует настройки до перезапуска процесса.

**Префиксы переменных окружения** (маппинг в `AggregatedConfigSource.PREFIX_MAPPING`):

| Префикс  | Маппится в           |
|----------|----------------------|
| `APP_`   | `app.*`              |
| `SVC_`   | `service.*`          |
| `TELCL_` | `telemetry_client.*` |
| `LOG_`   | `logger.*`           |

Корневой `.env` используется Compose для `${...}`, а не загружается этим Python-сервисом автоматически. Dockerfile не копирует сервисный `.env`. Модели и драйвера БД нет; переменные подключения в Compose не передаются.

| Параметр             | Локальные YAML          | Compose                                         |
|----------------------|-------------------------|-------------------------------------------------|
| HTTP host/port       | `127.0.0.1:8000`        | `0.0.0.0:8000`, публикация через `BACKEND_PORT` |
| Reload               | `true`                  | `false`                                         |
| Лимит журнала тревог | 5                       | 100                                             |
| Telemetry            | `http://127.0.0.1:8001` | `http://telemetry:8000`                         |
| Таймаут клиента      | 5 с                     | 10 с                                            |
| Запись логов в файл  | `false`                 | `false`                                         |

### 7. Enum'ы с lowercase-значениями

Все доменные Enum'ы используют **lowercase значения** для совместимости с JSON и фронтендом:

```python
class GlucoseLevel(str, Enum):
    NORMAL = "normal"   # ← lowercase!
    LOW = "low"
    HIGH = "high"
```

`AlertLevel` также имеет lowercase-значения, а его кастомный `__new__` дополнительно хранит читаемый `title`:

```python
class AlertLevel(str, Enum):
    OFF = "off", ""
    NOTIFICATION = "notification", "Оповещение"
    WARNING = "warning", "Предупреждение"
    CRITICAL = "critical", "Критический"

    def __new__(cls, value: str, title: str):
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj.title = title
        return obj

# Использование:
alert_level = AlertLevel.CRITICAL
print(alert_level.value)  # "critical"
print(alert_level.title)  # "Критический"
```

### 8. Lifespan для управления ресурсами

В `app/app.py` через `asynccontextmanager` создаётся `TelemetryClient` (один экземпляр на всё приложение):

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    telemetry_client = TelemetryClient()
    await telemetry_client.open()
    app.state.telemetry_client = telemetry_client
    yield
    await telemetry_client.close()
```

Для внедрения в роутеры — `Depends(get_telemetry_client)`, который читает `request.app.state.telemetry_client`.

**Никогда не создавайте `TelemetryClient` внутри роутера** — всегда получайте через Depends.

### 9. Префикс API

Все роутеры подключаются с `prefix="/api/v1"`:

```python
app.include_router(pumps_router, prefix="/api/v1", tags=["Pumps"])
```

Новые роутеры **обязаны** использовать тот же префикс для консистентности API.

---

## Соглашения по коду

### Именование

| Элемент         | Стиль                                                            |
|-----------------|------------------------------------------------------------------|
| Модули/файлы    | `snake_case` (`pump_auto_control.py`)                            |
| Классы          | `PascalCase` (`PumpAutoControl`)                                 |
| Функции/методы  | `snake_case` (`process_telemetry`)                               |
| Константы       | `UPPER_SNAKE_CASE` (`PROJECT_ROOT`, `CONFIG_DIR`)                |
| Pydantic-модели | `PascalCase` + суффикс (`PumpStateResponse`, `TelemetryRequest`) |
| Enum-значения   | `UPPER_SNAKE_CASE` члены, `lowercase` значения                   |
| Приватные поля  | `_` префикс (`_pumps`, `_last_alert`)                            |

### Роутеры

- Функции роутеров имеют префикс `api_*`: `api_pump_get_status`, `api_start_scenario`
- Все эндпоинты — **async**
- Операции помпы используют `/pumps/{pump_id}/...` и явно принимают `pump_id: str` из path
- Тело запроса — Pydantic-модель (из `app/models/`)
- Ответ формируется через Pydantic response model

### Pydantic-модели

- **Pydantic v2** синтаксис: `model_validate()`, `model_dump()`, `model_copy()` (не `parse_obj`, `dict`, `copy` из v1)
- Используются `Field` с валидацией: `Field(..., ge=2.0, le=20.0)`
- Для методов валидации — `@field_validator` или обычные методы (`is_valid()`)

Пороги настроек ограничены диапазоном 2–20, лимит базала — 100–350. Pydantic-ошибки дают 422; `SettingsRequest.is_valid()` отдельно проверяет соотношения порогов, при нарушении роутер возвращает 403 с текущим `SettingsResponse` из памяти. Изменение порядка полей JSON не является изменением контракта; имена, типы, nullable-поля и enum-значения — являются.

### Dataclass'ы домена

- Используются для внутреннего состояния, не для API
- `@dataclass` + `field(default_factory=...)` для мутабельных дефолтов
- Enum'ы как типы полей

### Логирование

- Только через `logging.getLogger(__name__)`
- Уровень — из `logger.yaml` / `LOG_LEVEL`
- Формат — JSON (настраивается в `logger_setup.py`)
- При `write_to_file=true` дополнительно включается `RotatingFileHandler`; в YAML и Compose сейчас `false`, логи идут в stdout

```python
logger = logging.getLogger(__name__)
logger.info(f"Glucose data received: {telemetry.glucose_value}")
```

**Не используйте `print()`** — только logger.

---

## Ключевые файлы

| Файл                                 | Назначение                                             |
|--------------------------------------|--------------------------------------------------------|
| `app/app.py`                         | FastAPI instance, lifespan, CORS, подключение роутеров |
| `app/routers/pumps_router.py`        | Основной роутер помпы (status, alerts, bolus, block)   |
| `pump/pump.py`                       | Класс `Pump` — агрегатор всех компонентов              |
| `pump/pumps_registry.py`             | `PumpsRegistry` (singleton) — реестр всех помп         |
| `pump/control/pump_auto_control.py`  | Логика обработки телеметрии (match/case)               |
| `pump/data/status.py`                | Enum'ы домена (GlucoseLevel, AlertLevel, BolusStatus)  |
| `pump/data/pump_state.py`            | `PumpState` + `merge_state`                            |
| `config/loader/aggregated_source.py` | Система конфигурации (deep merge)                      |
| `config/loader/settings.py`          | `AppSettings` — корневая модель настроек               |
| `telemetry_client/client.py`         | HTTP-клиент к сервису генерации                        |

---

## Типичные задачи и решения

### Добавить новый эндпоинт

1. Создать Pydantic-модели запроса/ответа в `app/models/<домен>/`
2. Добавить функцию в соответствующий роутер `app/routers/<router>.py`:

```python
@router.post("/pumps/{pump_id}/new-endpoint", response_model=NewResponse)
async def api_pump_new_endpoint(pump_id: str, request: NewRequest):
    pump = pumps_registry.get_or_create_pump(pump_id)
    # делегируем в pump
    result = await pump.some_control.do_something(request)
    return NewResponse(...)
```

3. Если нужна новая функциональность в помпе — создать `PumpSomeControl` в `pump/control/`, добавить в `Pump.__init__`
4. Роутер уже подключен с `prefix="/api/v1"` — новый эндпоинт автоматически будет по пути `/api/v1/pumps/{pump_id}/new-endpoint`

### Добавить новый параметр конфигурации

1. Добавить поле в соответствующую модель в `config/`:

```python
class AppConfig(BaseModel):
    alerts_limit: int = Field(default=100)
    new_parameter: str = Field(default="value")  # новое
```

2. Задать дефолт в `config/app.yaml`:

```yaml
app:
  alerts_limit: 100
  new_parameter: "value"
```

3. Использовать: `app_settings().app.new_parameter`
4. Для переопределения через env: `APP_NEW_PARAMETER=...` (работает только для префиксов из `PREFIX_MAPPING`)

### Добавить новое состояние помпы

1. Добавить поле в `PumpState` (dataclass):

```python
new_field: str | None = field(default=None)
```

2. Обновить `merge_state()` для нового поля:

```python
self.new_field = other.new_field if other.new_field is not None else self.new_field
```

3. Обновить `PumpStateResponse` в `app/models/pump/`:

```python
class PumpStateResponse(BaseModel):
    # ...
    new_field: str | None = Field(default=None)
```

4. В роутере `pumps_router.api_pump_get_status` добавить поле в конструктор `PumpStateResponse(...)`

### Добавить новый тип тревоги

1. Добавить член в `AlertLevel` (с title):

```python
class AlertLevel(str, Enum):
    # ...
    NEW_LEVEL = "new_level", "Новый тип тревоги"
```

2. Добавить метод `_new_level()` в `PumpAutoControl`
3. Добавить `case` в `process_telemetry` в правильном порядке
4. Вызвать `self.alerts_recorder.register(Alert(level=AlertLevel.NEW_LEVEL, ...))`

---

## Отладка

### Просмотр состояния конкретной помпы

```bash
curl http://localhost:8000/api/v1/pumps/pump-1/status | jq
```

### Отправка тестовой телеметрии

```bash
curl -X POST http://localhost:8000/api/v1/pumps/pump-1/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "glucose_value": 2.5,
    "glucose_unit": "mmol/L",
    "timestamp": "2026-08-10T15:30:00Z"
  }'
```

### Проверка списка активных помп

Такого endpoint'а нет. Для локальной отладки можно смотреть `pumps_registry._pumps.keys()` в REPL; не добавляйте публичные временные маршруты в рамках несвязанных задач.

### Логи

- В dev-режиме (`write_to_file=false`): JSON-логи в stdout
- В prod (`write_to_file=true`): additionally в файл, путь из `logger.yaml`
- Формат: `{"timestamp": "...", "level": "INFO", "logger": "...", "message": "..."}`

### Swagger UI для быстрого тестирования

`http://localhost:8000/docs` — все эндпоинты с интерактивными формами.

---

## Чего НЕ делать

- ❌ **Не использовать глобальное состояние помпы** — только через `pumps_registry.get_or_create_pump(pump_id)`
- ❌ **Не создавать `TelemetryClient` внутри роутера** — получать через `Depends(get_telemetry_client)`
- ❌ **Не использовать синхронные функции в роутерах** — только `async def`
- ❌ **Не использовать `print()`** — только `logger`
- ❌ **Не использовать Pydantic v1 синтаксис** (`parse_obj`, `dict()`, `copy()`) — только v2 (`model_validate`, `model_dump`, `model_copy`)
- ❌ **Не импортировать FastAPI из доменного слоя** (`pump/`) — там не должно быть HTTP-зависимостей
- ❌ **Не хардкодить значения порогов** в коде — только через `PumpSettings` (настраиваются через API)
- ❌ **Не использовать uppercase-значения Enum'ов** — фронтенд ожидает lowercase
- ❌ **Не менять порядок `case` в `process_telemetry`** — нарушит логику срабатывания приоритетов
- ❌ **Не создавать несколько экземпляров `PumpsRegistry`** — это должен быть singleton
- ❌ **Не использовать `asyncio.run()`** внутри FastAPI — он уже работает в event loop (используйте `asyncio.create_task()`)
- ❌ **Не логировать чувствительные данные** (PII, пароли, токены)

---

## Ограничения текущей архитектуры

### Состояние хранится в памяти

`PumpsRegistry._pumps` — обычный словарь в памяти процесса. При перезапуске бэкенда все состояния теряются.

**Для учебных целей** это приемлемо. Сохранение состояния между перезапусками требует отдельной реализации персистентного хранилища.

### Нет аутентификации

Любой может отправить запрос на любой `pump_id`. Это сделано намеренно для учебного проекта.

---

## Чек-лист при создании Pull Request

- [ ] Новый эндпоинт использует `prefix="/api/v1"`
- [ ] Роутер — async функция с именем `api_*`
- [ ] Pydantic-модели запроса/ответа в `app/models/<домен>/`
- [ ] Бизнес-логика делегирована в `pump/control/`
- [ ] Новые настройки добавлены в YAML-конфиг с дефолтом
- [ ] Enum-значения в lowercase
- [ ] Логирование только через `logger`
- [ ] Pydantic v2 синтаксис (не v1)
- [ ] Проверены затронутые success/error-ветки; добавленные тесты и команда их запуска описаны (готового набора пока нет)
- [ ] При наличии отдельных инструментов выполнены Python-проверки; их отсутствие не выдаётся за успешный прогон
- [ ] Приложение стартует без ошибок: `python -m src.ips_backend.main`
- [ ] Swagger UI открывается: `http://localhost:8000/docs`
- [ ] Эндпоинт протестирован через Swagger или curl

---

## Ссылки на связанные проекты

- [Пользовательский UI](../ips-frontend/AGENTS.md) — `../ips-frontend/`
- [Генератор телеметрии](../ips-telemetry-service/AGENTS.md) — `../ips-telemetry-service/`, backend обращается через `TelemetryClient`
- [Админ-панель](../ips-admin-frontend/AGENTS.md) — `../ips-admin-frontend/`

**Синхронизация enum:** [источник в backend](src/ips_backend/pump/data/status.py) и [типы frontend](../ips-frontend/src/services/api/types.ts) должны совпадать по строковым значениям (`normal`, `critical`, `pump_off` и т. п.).
