# AGENTS.md — ips-telemetry-service

Инструкции для работы в `services/ips-telemetry-service`. Пути к Python-модулям ниже относительны `src/ips_telemetry_service/`, если не указано иное. Общая архитектура и команды Compose — в [README](../../README.md).

---

## Обзор проекта

Сервис генерации телеметрии — отдельный FastAPI-микросервис, который по заданным **сценариям** отправляет значения глюкозы на основной бэкенд (`ips-backend`). Используется для симуляции работы CGM-сенсора и тестирования поведения помпы при различных паттернах изменения глюкозы.

Пользовательский UI запускает сценарии через backend, админка обращается к telemetry через собственный прокси. Задачи и HTTP-клиенты разделены по `pump_id`, но изменяемые объекты сценариев пока общие — полная изоляция генерации не реализована. Внешнего хранилища нет, состояние находится в памяти процесса.

**Стек технологий:**
- Python **3.14**
- **FastAPI 0.141.1** (ASGI-фреймворк)
- **Pydantic 2.13.4** + **pydantic-settings** (конфигурация)
- **uvicorn** (ASGI-сервер)
- **httpx2** (асинхронный HTTP-клиент для отправки данных на бэкенд)
- **python-json-logger** (структурированное JSON-логирование)
- **PyYAML** (чтение YAML-конфигов)
- **asyncio** (управление параллельными задачами генерации per `pump_id`)

Версии зависимостей закреплены в `requirements.txt`. Не заменяйте `httpx2` на `httpx` без проверки совместимости.

---

## Структура проекта

```
src/
├── ips_telemetry_service/
│   ├── main.py                         # точка входа: uvicorn.run()
│   │
│   ├── app/                            # FastAPI-приложение
│   │   ├── app.py                      # FastAPI instance + lifespan + CORS
│   │   ├── config/
│   │   │   └── logger_setup.py         # инициализация JSON-логирования
│   │   ├── dependencies/
│   │   │   └── dependencies.py         # Depends(get_telemetry_service)
│   │   └── routers/
│   │       └── scenario_router.py      # эндпоинты управления сценариями
│   │
│   ├── service/
│   │   └── telemetry_service.py        # TelemetryService — ядро сервиса
│   │                                   # (управление задачами, отправка данных)
│   │
│   ├── scenarios/                      # сценарии генерации
│   │   ├── scenario.py                 # Scenario + ScenarioStep dataclasses
│   │   ├── scenarios_registry.py       # реестр сценариев (dict)
│   │   └── data/                       # определения сценариев
│   │       ├── raising_scenario.py
│   │       └── low_high_scenario.py
│   │
│   └── config/                         # конфигурация
│       ├── loader/
│       │   ├── settings.py             # AppSettings (pydantic-settings)
│       │   ├── aggregated_source.py    # AggregatedConfigSource (deep merge)
│       │   └── paths.py                # PROJECT_ROOT
│       ├── service_config.py           # ServiceConfig (host, port, reload)
│       ├── telemetry_config.py         # TelemetryConfig (backend_url, interval)
│       └── logger_config.py            # LoggerConfig

config/                                 # YAML-конфиги
├── service.yaml
├── telemetry.yaml
└── logger.yaml
```

---

## Команды разработки

```bash
# Из корня репозитория; окружение создаётся при первой настройке
cd services/ips-telemetry-service
python3.14 -m venv .venv
source .venv/bin/activate

# Установка зависимостей
python -m pip install -r requirements.txt

# Запуск в режиме разработки (с reload)
python -m src.ips_telemetry_service.main

# Альтернатива: host/port/reload задаются флагами CLI, не service.yaml
python -m uvicorn src.ips_telemetry_service.app.app:app --host 127.0.0.1 --port 8001 --reload
```

Запускайте из каталога сервиса: импорты имеют префикс `src.ips_telemetry_service`. `pytest`, `ruff`, `mypy` не входят в текущий `requirements.txt`; проектных автотестов и конфигураций этих проверок пока нет. При отдельно установленных инструментах можно запускать `ruff check src/` и `mypy src/`, не выдавая их за уже настроенный CI.

Из корня репозитория Docker-стек на VDS после настройки DNS запускается командой `docker compose up --build -d --wait`, логи: `docker compose logs --tail=100 telemetry`. Для локального запуска только API без Caddy: `docker compose up --build -d --wait backend telemetry`. В Compose telemetry ждёт только здоровый backend; backend **не должен одновременно ждать telemetry**.

**API-документация после запуска:**
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`
- OpenAPI: `http://localhost:8001/openapi.json`

Локально сервис слушает 8001. В Compose он слушает **`telemetry:8000` внутри Docker-сети** и публикует его только как `127.0.0.1:${TELEMETRY_PORT:-8001}` на хосте. Healthcheck контейнера использует `/docs` по адресу 127.0.0.1 с таймаутом 3 с; порт получает через `app_settings().service.port`. Отдельного `/api/v1/health` нет.

Общий блок `x-app-options` задаёт `no-new-privileges:true`, `cap_drop: [ALL]` и драйвер логов `local` с `max-size: 10m`, `max-file: 3`. Сохраняйте наследование этих настроек при изменении Compose.

На VDS Caddy направляет весь `https://telemetry.alexgallax-edu.ru` в telemetry: Swagger — `/docs`, ReDoc — `/redoc`, схема — `/openapi.json`, API — `/api/v1/...`. Swagger «Try it out» поэтому обращается к тому же хосту. Админка на отдельном домене по-прежнему использует свой `/telemetry-api/v1` прокси. Авторизации на публичных хостах по выбранной конфигурации нет.

Compose задаёт Uvicorn `FORWARDED_ALLOW_IPS=*`; прямой порт остаётся только на loopback, запросы извне проходят через доверенные прокси. Не публикуйте прямой порт на внешних интерфейсах без пересмотра доверия заголовкам. Nginx сохраняет `X-Forwarded-Proto` от Caddy, чтобы FastAPI не формировал HTTP-редиректы для HTTPS-запросов.

Сам Dockerfile задаёт контейнерные defaults `SVC_HOST=0.0.0.0`, `SVC_PORT=8000`, `SVC_RELOAD=false`, поэтому и без Compose приложение/healthcheck используют согласованный порт. Адрес backend нужно настроить отдельно. Runtime — `appuser`, код и YAML остаются root-owned, запись разрешена только в `/app/logs`. Сохраняйте `PYTHONDONTWRITEBYTECODE=1` и `PYTHONUNBUFFERED=1`; не возвращайте `chown -R` всего `/app`.

## Фактически доступный HTTP API

Все пути ниже включают `/api/v1`; `pump_id` — обязательный query-параметр, кроме списка сценариев.

| Метод   | Путь                                            | Ответ                                                                       |
|---------|-------------------------------------------------|-----------------------------------------------------------------------------|
| `GET`   | `/api/v1/scenarios`                             | Массив `{scenario_name, description}` всех доступных сценариев              |
| `GET`   | `/api/v1/scenario/current?pump_id=...`          | `{scenario_name: "..."}`, пустая строка при отсутствии запущенного сценария |
| `POST`  | `/api/v1/scenarios/{scenario_name}?pump_id=...` | `200 OK`, JSON `null`                                                       |
| `POST`  | `/api/v1/scenario/stop?pump_id=...`             | `200 OK`, JSON `null`                                                       |

Роутеры start/stop не возвращают словари из методов сервиса. `get_status_all()` и `stop_all()` существуют только как Python-методы: HTTP-маршрутов `GET /api/v1/generators` и `POST /api/v1/scenario/stop/all`, которые ожидает админка, пока нет. Не документируйте их как рабочие.

---

## Архитектурные соглашения

### 1. Разделение слоёв

**HTTP-слой** (`app/`):
- Только роутеры и FastAPI-зависимости
- Делегирует управление сценариями в `TelemetryService`
- Не содержит бизнес-логики генерации

**Сервисный слой** (`service/`):
- `TelemetryService` — центральный компонент
- Управляет жизненным циклом задач генерации через `asyncio.create_task()`
- Хранит per-pump_id состояния: задачи, HTTP-клиенты, stop events, имена сценариев

**Сценарный слой** (`scenarios/`):
- Описание сценариев как dataclass'ов (`Scenario`, `ScenarioStep`)
- Реестр доступных сценариев в `scenarios_registry`
- Не импортирует FastAPI и сервис

**Конфигурационный слой** (`config/`):
- Pydantic-модели настроек + `AggregatedConfigSource`
- Deep merge: YAML → env → `.env`

### 2. Multi-tenant генерация через `pump_id`

Сервис хранит задачи, клиентов и сигналы остановки в словарях по `pump_id`:

```python
self._tasks: dict[str, asyncio.Task]           # фоновые задачи
self._clients: dict[str, httpx2.AsyncClient]   # HTTP-клиенты
self._stop_events: dict[str, asyncio.Event]    # сигналы остановки
self._scenario_names: dict[str, str]           # имена активных сценариев
```

Новые per-pump данные храните в сервисе, не в глобальных переменных. Текущий `_generation_loop` берёт `scenarios[scenario_name]` без копирования: `_index` и `_counter` этого объекта меняют все помпы с тем же сценарием. Не считайте отдельные `Task` гарантией независимости значений.

### 3. Модель сценария: `Scenario` + `ScenarioStep`

Сценарий состоит из шагов (`ScenarioStep`), каждый из которых имеет:

```python
@dataclass
class ScenarioStep:
    const: float | None = None        # фиксированное значение ИЛИ
    min: float | None = None          # нижняя граница диапазона
    max: float | None = None          # верхняя граница диапазона
    duration: int | None = 1          # сколько тактов длится шаг
```

**Фактическая валидация в `__post_init__`**: `has_const or has_range` — OR, **не XOR**. Если присутствуют и `const`, и диапазон, `_get_value()` использует `const`. Положительность/тип `duration`, порядок границ, конечность чисел и непустой список шагов сейчас не проверяются. Для новых сценариев задавайте один вариант значения, положительную целую длительность и корректные границы; не меняйте валидатор молча без проверки существующих данных.

**Цикличность**: после прохождения всех шагов сценарий начинается сначала (`_index = (_index + 1) % len(steps)`).

`reset()` сейчас сбрасывает только `_index`, но не `_counter`; `start()` его не вызывает. Перезапуск поэтому не гарантирует начало с первого шага/такта.

Текущие данные:
- `raising_scenario`: один такт 2–4, один такт 3–5, четыре такта по 10.0. В третьем шаге также есть `min=4.0, max=7.0`, но они игнорируются из-за `const=10.0`.
- `low_high_scenario`: два такта по 1.0, затем два такта по 10.0.

### 4. Управление задачами через `asyncio`

Каждая задача генерации запускается через `asyncio.create_task()` — **не через `asyncio.run()`**, т.к. FastAPI уже работает в event loop.

Жизненный цикл задачи:
1. `start(pump_id, scenario_name)` → создаёт `asyncio.Task`
2. `_generation_loop(pump_id, scenario_name)` — бесконечный цикл с `asyncio.wait_for`
3. `stop(pump_id)` → устанавливает `stop_event` и отменяет задачу через `task.cancel()`
4. `shutdown()` → останавливает все задачи и закрывает клиенты

Цикл генерирует первое измерение без начальной задержки, затем ждёт `telemetry_interval_seconds` **после** HTTP-запроса или dry-run логирования. Поэтому период зависит и от времени HTTP-запроса. `stop()` отменяет текущую задачу без ожидания полного интервала; в цикле используется `asyncio.wait_for(stop_event.wait(), timeout=interval)`, не обычный sleep. В `start()` при замене задачи сейчас дополнительно есть `asyncio.sleep(0.1)`.

Конкурентные start/stop не защищены per-pump lock: возможна потеря ссылки на работающую задачу. При исправлении жизненного цикла проверяйте перекрывающиеся операции, завершившиеся с ошибкой задачи и очистку всех словарей. Не обещайте атомарность текущей реализации.

### 5. Отправка данных на бэкенд

`TelemetryConfig.backend_url(pump_id)` собирает URL из шаблона:

```python
def backend_url(self, pump_id: str) -> str:
    url = f"{self.backend_base_url}:{self.backend_port}/{self.backend_path}"
    return url.format(pump_id=pump_id)  # {pump_id} в backend_path
```

Отправка — через `httpx2.AsyncClient` (один клиент на `pump_id`, переиспользуется между запусками).

В `backend_path` используется шаблон `api/v1/pumps/{pump_id}/telemetry`. Генератор формирует timestamp через `datetime.now(timezone.utc).isoformat()`. Код пока не вызывает `raise_for_status()` и не делает retries: сообщение о посылке с `status=4xx/5xx` не означает успешный приём данных. Не добавляйте бесконтрольные повторы для управляющих операций.

**Тело запроса** — стандартное для бэкенда:
```python
{
    "glucose_value": 5.5,
    "glucose_unit": "mmol/L",
    "timestamp": "2026-08-10T15:30:00+00:00"
}
```

### 6. Dry-run режим

При `telemetry.dry_run = true` данные не отправляются на бэкенд, а только логируются. Полезно для отладки сценариев без поднятого бэкенда.

При локальном запуске можно использовать `TEL_DRY_RUN=true python -m src.ips_telemetry_service.main`, если сервисный `.env` не переопределяет значение. Compose явно задаёт `TEL_DRY_RUN=false`; для Docker требуется изменить или переопределить именно окружение контейнера.

```python
if config.dry_run:
    logger.info(f"Telemetry dry run: glucose: {payload['glucose_value']} ...")
else:
    response = await client.post(url=backend_url, json=payload)
```

### 7. Lifespan и внедрение зависимостей

`TelemetryService` создаётся **один раз на приложение** как глобальная переменная в `app/app.py` и внедряется через `app.state`:

```python
telemetry_service = TelemetryService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.telemetry_service = telemetry_service
    yield
    await telemetry_service.shutdown()
```

В роутерах — `Depends(get_telemetry_service)`.

### 8. Реестр сценариев

Все сценарии регистрируются в `scenarios/scenarios_registry.py`:

```python
scenarios = {
    "raising_scenario": raising_scenario,
    "low_high_scenario": low_high_scenario,
}
```

При добавлении нового сценария:
1. Создать файл в `scenarios/data/`
2. Определить `Scenario` с шагами
3. Импортировать и добавить в словарь `scenarios`

Имя ключа — `scenario_name` в URL `POST /api/v1/scenarios/{scenario_name}`. Сейчас существование имени до запуска Task не проверяется: неизвестное имя приводит к `KeyError` в фоновой задаче, а HTTP-запрос уже может вернуть 200. Это дефект, не образец обработки ошибки.

### 9. Система конфигурации

Префиксы переменных окружения (`AggregatedConfigSource.PREFIX_MAPPING`):

| Префикс | Маппится в    |
|---------|---------------|
| `SVC_`  | `service.*`   |
| `TEL_`  | `telemetry.*` |
| `LOG_`  | `logger.*`    |

Приоритет от низкого к высокому: значения Pydantic по умолчанию → обязательные YAML → окружение процесса → `.env` **в каталоге этого сервиса** → явные аргументы `AppSettings(...)`, если переданы. `init_settings` имеет наивысший приоритет по правилам pydantic-settings; комментарий об обратном порядке в коде неточен. `PROJECT_ROOT` — каталог сервиса, `app_settings()` кэширует результат до перезапуска процесса. `.env` разбирается собственным простым парсером, без полноценной dotenv-подстановки.

Корневой `.env` используется Compose для `${...}` и автоматически не читается Python-сервисом. Dockerfile не копирует сервисный `.env`. Модели БД нет, параметры подключения в Compose не передаются.

| Параметр          | Локальные YAML          | Compose                                           |
|-------------------|-------------------------|---------------------------------------------------|
| HTTP host/port    | `127.0.0.1:8001`        | `0.0.0.0:8000`, публикация через `TELEMETRY_PORT` |
| Reload            | `true`                  | `false`                                           |
| Backend           | `http://127.0.0.1:8000` | `http://backend:8000`                             |
| Интервал ожидания | 5 с                     | `${TELEMETRY_INTERVAL:-5}` с                      |
| HTTP-таймаут      | 5 с                     | 10 с                                              |
| Dry-run           | `false`                 | `false`                                           |
| Логи в файл       | `false`                 | `false`                                           |

В локальном `config/logger.yaml` путь файла сейчас `./logs/backend.log`; имя не означает связь с backend. При включении записи в файл проверьте путь. В Compose передан `/app/logs/telemetry.log`, но запись в файл выключена.

---

## Соглашения по коду

### Именование

| Элемент         | Стиль                                              |
|-----------------|----------------------------------------------------|
| Модули/файлы    | `snake_case` (`telemetry_service.py`)              |
| Классы          | `PascalCase` (`TelemetryService`)                  |
| Функции/методы  | `snake_case` (`get_status`, `_generation_loop`)    |
| Константы       | `UPPER_SNAKE_CASE` (`PROJECT_ROOT`, `CONFIG_DIR`)  |
| Приватные поля  | `_` префикс (`_tasks`, `_clients`, `_stop_events`) |
| Имена сценариев | `snake_case` в реестре (`raising_scenario`)        |

### Роутеры

- Функции роутеров имеют префикс `api_*`: `api_pump_start_telemetry`, `api_pump_stop_telemetry`
- Все эндпоинты — **async**
- `pump_id` передаётся как **query-параметр** (не path!)
- `scenario_name` в URL `POST /scenarios/{scenario_name}` — path-параметр

### Dataclass'ы сценариев

- Используются `@dataclass` + `field(default_factory=...)`
- Приватные поля с `init=False, repr=False` для счётчиков/индексов
- Валидация в `__post_init__` для инвариантов

### Логирование

- Только через `logging.getLogger(__name__)`
- Новые сообщения о per-pump операциях должны включать `pump_id`; в текущем цикле посылки/ошибок некоторые сообщения его ещё не содержат
- Уровень — из `logger.yaml` / `LOG_LEVEL`

```python
logger = logging.getLogger(__name__)
logger.info(f"{pump_id}: Telemetry generator is started with scenario '{scenario_name}'")
```

---

## Ключевые файлы

| Файл                                 | Назначение                                                 |
|--------------------------------------|------------------------------------------------------------|
| `app/app.py`                         | FastAPI instance, lifespan, глобальный `telemetry_service` |
| `app/routers/scenario_router.py`     | API эндпоинты управления сценариями                        |
| `service/telemetry_service.py`       | Ядро: задачи, клиенты, цикл генерации                      |
| `scenarios/scenario.py`              | `Scenario` и `ScenarioStep` dataclass'ы                    |
| `scenarios/scenarios_registry.py`    | Реестр доступных сценариев                                 |
| `scenarios/data/*.py`                | Определения конкретных сценариев                           |
| `config/telemetry_config.py`         | `TelemetryConfig` с методом `backend_url()`                |
| `config/loader/aggregated_source.py` | Deep merge конфиг-источников                               |

---

## Типичные задачи и решения

### Добавить новый сценарий

1. Создать файл `scenarios/data/my_scenario.py`:

```python
from src.ips_telemetry_service.scenarios.scenario import Scenario, ScenarioStep

my_scenario = Scenario(
    description="My Custom Scenario",
    steps=[
        ScenarioStep(const=5.0, duration=3),          # 3 такта по 5.0
        ScenarioStep(min=3.0, max=7.0, duration=2),   # 2 такта в диапазоне
        ScenarioStep(const=15.0, duration=1),         # 1 такт 15.0
    ],
)
```

2. Зарегистрировать в `scenarios_registry.py`:

```python
from src.ips_telemetry_service.scenarios.data.my_scenario import my_scenario

scenarios = {
    "raising_scenario": raising_scenario,
    "low_high_scenario": low_high_scenario,
    "my_scenario": my_scenario,  # новый сценарий
}
```

3. Запустить через API:

```bash
curl -X POST "http://localhost:8001/api/v1/scenarios/my_scenario?pump_id=pump-1"
```

### Изменить интервал отправки телеметрии

В `config/telemetry.yaml`:

```yaml
telemetry:
  telemetry_interval_seconds: 5
```

Или локально через `TEL_TELEMETRY_INTERVAL_SECONDS=2 python -m src.ips_telemetry_service.main` — префикс `TEL_` уже есть и работает. В Docker используйте Compose-переменную `TELEMETRY_INTERVAL`; произвольная переменная корневого `.env` не передаётся в контейнер без соответствующего `environment`.

### Добавить новый API-эндпоинт

Пример будущего маршрута в `app/routers/scenario_router.py` (сейчас такого маршрута нет):

```python
from fastapi import HTTPException
from src.ips_telemetry_service.scenarios.scenarios_registry import scenarios

@router.get("/scenarios/{scenario_name}/info")
async def api_scenario_info(scenario_name: str):
    if scenario_name not in scenarios:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scenario = scenarios[scenario_name]
    return {
        "scenario_name": scenario_name,
        "description": scenario.description,
        "steps_count": len(scenario.steps),
    }
```

### Добавить новый параметр конфигурации

1. Добавить поле в `config/telemetry_config.py`:

```python
class TelemetryConfig(BaseModel):
    # ... существующие поля ...
    max_retries: int = Field(default=3, description="Max retries on backend error")
```

2. Задать дефолт в `config/telemetry.yaml`:

```yaml
telemetry:
  # ...
  max_retries: 3
```

3. Использовать: `app_settings().telemetry.max_retries`

Это пример добавления параметра, а не существующая retry-функция. Само поле не включает повторные попытки без реализации в сервисе.

---

## Отладка

### Список доступных сценариев

```bash
curl http://localhost:8001/api/v1/scenarios
```

### Запуск сценария

```bash
curl -X POST "http://localhost:8001/api/v1/scenarios/raising_scenario?pump_id=pump-1"
```

### Проверка текущего активного сценария

```bash
curl "http://localhost:8001/api/v1/scenario/current?pump_id=pump-1"
```

### Остановка генерации

```bash
curl -X POST "http://localhost:8001/api/v1/scenario/stop?pump_id=pump-1"
```

### Dry-run режим

Для отладки без работающего бэкенда — в `config/telemetry.yaml`:

```yaml
telemetry:
  dry_run: true
```

Данные будут логироваться, но не отправляться.

### Логи

- В dev-режиме: JSON-логи в stdout
- Формат: `{"timestamp": "...", "level": "INFO", "logger": "...", "message": "pump-1: Telemetry is sent: ..."}`
- Наличие `pump_id` в каждой записи пока не гарантировано; новые записи per-pump операций делайте с идентификатором

---

## Чего НЕ делать

- ❌ **Не использовать `asyncio.run()`** внутри FastAPI — используйте `asyncio.create_task()`
- ❌ **Не создавать новый `TelemetryService` в роутерах** — используйте глобальный через `Depends`
- ❌ **Не использовать `asyncio.sleep(interval)`** в цикле генерации — только `asyncio.wait_for(stop_event.wait(), timeout=...)` для мгновенной остановки
- ❌ **Не создавать `httpx2.AsyncClient` на каждый запрос** — клиенты переиспользуются per `pump_id`
- ❌ **Не хардкодить URL бэкенда** — используйте `TelemetryConfig.backend_url(pump_id)`
- ❌ **Не менять формат телеметрии только в одном сервисе** — генератор отправляет `mmol/L`, число и ISO timestamp; backend пока не проверяет единицы и не делает конвертацию
- ❌ **Не хранить задачи в глобальных переменных** — только в `self._tasks` сервиса
- ❌ **Не импортировать FastAPI в `scenarios/` или `service/`** — эти слои не должны знать о HTTP
- ❌ **Не использовать `print()`** — только `logger`
- ❌ **Не задавать неполный диапазон** в новых `ScenarioStep`: без `const` он не проходит валидацию; с `const` лишние поля сейчас принимаются, но игнорируются

---

## Ограничения текущей архитектуры

### Нет персистентности состояния

Активные генераторы теряются при перезапуске сервиса. Для учебных целей это приемлемо.

Несколько workers/реплик будут иметь независимые словари и сценарии; согласование между процессами и восстановление задач из внешнего хранилища не реализованы. Аутентификации и авторизации нет.

---

## Чек-лист при создании Pull Request

- [ ] Новый сценарий зарегистрирован в `scenarios_registry.py`
- [ ] Проверены шаги, длительности, границы и приоритет `const`; текущий валидатор — OR, не XOR
- [ ] Новый эндпоинт в `scenario_router.py` — async, имя `api_*`
- [ ] Новые параметры конфигурации добавлены в `telemetry.yaml` с дефолтом
- [ ] Логирование только через `logger`
- [ ] Все сообщения включают `pump_id` как префикс (для мульти-помповых операций)
- [ ] Не используется `asyncio.run()` и `asyncio.sleep()` вместо `asyncio.wait_for()`
- [ ] Приложение стартует без ошибок: `python -m src.ips_telemetry_service.main`
- [ ] Swagger UI открывается: `http://localhost:8001/docs`
- [ ] Сценарий запускается и отправляет данные (проверить через логи или на бэкенде)
- [ ] Проверены остановка без ожидания интервала, повторный запуск, разные помпы и перекрывающиеся операции в затронутой логике
- [ ] Проверены error-ветки; добавленные тесты и команда их запуска описаны (готового набора пока нет)
- [ ] Python-проверки выполнены при наличии отдельно установленных инструментов; отсутствие инструмента не выдано за успешную проверку

---

## Связанные проекты

- [Backend](../ips-backend/AGENTS.md): принимает `POST /api/v1/pumps/{pump_id}/telemetry`; нужен для реальной отправки данных, иначе используйте dry-run.
- [Пользовательский UI](../ips-frontend/AGENTS.md): запускает сценарии через backend и `TelemetryClient`.
- [Админ-панель](../ips-admin-frontend/AGENTS.md): обращается к telemetry через `/telemetry-api/v1`, без промежуточного backend.

### Схема взаимодействия

```text
Frontend ──> Backend ──> Telemetry /api/v1/scenarios/...
Admin Frontend ─────────> Telemetry /api/v1/scenarios/...
Telemetry ── httpx2 POST ──> Backend /api/v1/pumps/{pump_id}/telemetry
```

Прокси админки заменяет `/telemetry-api/` на `/api/`; оба Python-сервиса в Docker используют внутренний порт 8000, хотя с хоста telemetry доступен на 8001.

### Синхронизация формата телеметрии

Тело запроса, которое отправляет этот сервис, должно соответствовать `TelemetryRequest` бэкенда:

```python
{
    "glucose_value": float,   # значение глюкозы
    "glucose_unit": "mmol/L", # единица измерения (всегда mmol/L)
    "timestamp": str          # ISO 8601 timestamp
}
```

При изменении формата на бэкенде нужно синхронно обновить метод `Scenario.next()` в `scenarios/scenario.py`.
