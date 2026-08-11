import logging
import os

from pydantic import Field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)

from src.ips_telemetry_service.config.generator_config import GeneratorConfig
from src.ips_telemetry_service.config.loader.aggregated_source import AggregatedConfigSource
from src.ips_telemetry_service.config.loader.paths import PROJECT_ROOT
from src.ips_telemetry_service.config.logger_config import LoggerConfig
from src.ips_telemetry_service.config.service_config import ServiceConfig

logger = logging.getLogger(__name__)

CONFIG_DIR = "config"


class AppSettings(BaseSettings):
    service: ServiceConfig = Field(default_factory=ServiceConfig)
    generator: GeneratorConfig = Field(default_factory=GeneratorConfig)
    logger: LoggerConfig = Field(default_factory=LoggerConfig)

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls,
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        """
        Настраивает порядок и состав источников настроек.

        Порядок (слева направо = от низкого к высокому приоритету):
        1. Значения из __init__()
        2. yaml файлы
        3. Системные переменные окружения
        4. .env файл (самый высокий приоритет)
        """
        filepath_service = cls._get_config_path(filename="service.yaml")
        filepath_generator = cls._get_config_path(filename="generator.yaml")
        filepath_logger = cls._get_config_path(filename="logger.yaml")

        return (
            init_settings,
            AggregatedConfigSource(
                settings_cls=settings_cls,
                yaml_paths=[
                    filepath_service,
                    filepath_generator,
                    filepath_logger,
                ],
                env_file=str(PROJECT_ROOT / ".env"),
            ),
        )

    @classmethod
    def _get_config_path(cls, filename: str) -> str:
        filepath = str(PROJECT_ROOT / CONFIG_DIR / filename)
        if not os.path.isfile(filepath):
            logger.error(f"Config filepath not found in '{filepath}'.")
            raise FileNotFoundError(f"Config filepath not found in '{filepath}'.")
        return filepath


_settings: AppSettings | None = None


def app_settings() -> AppSettings:
    global _settings
    if _settings is None:
        _settings = AppSettings()
    return _settings
