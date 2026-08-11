import json
import os
from pathlib import Path
from typing import Any

import yaml
from pydantic_settings import PydanticBaseSettingsSource


def deep_update(mapping: dict[str, Any], *updating_mappings: dict[str, Any]) -> dict[str, Any]:
    """Рекурсивное обновление словаря (deep merge)."""
    updated_mapping = mapping.copy()
    for updating_mapping in updating_mappings:
        for k, v in updating_mapping.items():
            if (
                k in updated_mapping
                and isinstance(updated_mapping[k], dict)
                and isinstance(v, dict)
            ):
                updated_mapping[k] = deep_update(updated_mapping[k], v)
            else:
                updated_mapping[k] = v
    return updated_mapping


class AggregatedConfigSource(PydanticBaseSettingsSource):
    """
    Единый источник конфигурации, который:
    1. Читает YAML файлы
    2. Читает системные переменные окружения
    3. Читает .env файл (перекрывает системные переменные)
    4. Делает deep merge, чтобы точечные переменные из .env не затирали весь YAML конфиг
    """

    PREFIX_MAPPING = {
        "APP_": "app",
        "SVC_": "service",
        "LLM_": "llm",
        "PVDR_": "provider",
        "DB_": "db",
        "RAG_": "rag",
        "LOG_": "logger",
    }

    def __init__(
        self,
        settings_cls,
        yaml_paths: list[str | Path],
        env_file: str = ".env",
    ):
        super().__init__(settings_cls)
        self.yaml_paths = [Path(p) for p in yaml_paths]
        self.env_file = Path(env_file)

    def get_field_value(self, field, field_name: str) -> tuple[Any, str, bool]:
        return None, field_name, False

    def _load_yaml_files(self) -> dict[str, Any]:
        """Загружает и мержит все переданные YAML/JSON файлы."""
        result: dict[str, Any] = {}
        for path in self.yaml_paths:
            if not path.exists():
                continue

            with open(path, "r", encoding="utf-8") as f:
                if path.suffix in (".yaml", ".yml"):
                    data = yaml.safe_load(f) or {}
                elif path.suffix == ".json":
                    data = json.load(f)
                else:
                    continue
                result = deep_update(result, data)
        return result

    def _map_env_variable(self, result: dict[str, Any], key: str, value: str) -> None:
        """Маппит переменную окружения на вложенную структуру по префиксу."""
        for prefix, alias in self.PREFIX_MAPPING.items():
            if key.startswith(prefix):
                field_key = key[len(prefix):].lower()
                if alias not in result:
                    result[alias] = {}
                result[alias][field_key] = value
                break

    def _load_env_variables(self) -> dict[str, Any]:
        """
        Загружает переменные окружения.
        Порядок приоритета: системные переменные -> .env файл (.env перекрывает систему).
        """
        result: dict[str, Any] = {}

        # 1. Системные переменные окружения
        for key, value in os.environ.items():
            self._map_env_variable(result, key, value)

        # 2. .env файл (имеет более высокий приоритет)
        if self.env_file.exists():
            with open(self.env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue

                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()

                    # Убираем кавычки
                    if (value.startswith('"') and value.endswith('"')) or \
                       (value.startswith("'") and value.endswith("'")):
                        value = value[1:-1]

                    self._map_env_variable(result, key, value)

        return result

    def __call__(self) -> dict[str, Any]:
        yaml_data = self._load_yaml_files()
        env_data = self._load_env_variables()

        # Deep merge: YAML -> System Env -> .env
        return deep_update(yaml_data, env_data)
