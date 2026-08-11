from pathlib import Path

from pydantic import Field, BaseModel, field_validator

from src.ips_backend.config.loader.paths import PROJECT_ROOT


class LoggerConfig(BaseModel):
    path: str = Field(description="Log path")
    level: str = Field(description="Log level")
    write_to_file: bool = Field(description="Write logs to file")

    @field_validator("path", mode="before")
    @classmethod
    def resolve_path(cls, value: str) -> str:
        """Преобразует относительный путь в абсолютный от корня проекта."""
        if not value:
            return value
        path = Path(value)
        if path.is_absolute():
            return str(path)
        return str((PROJECT_ROOT / path).resolve())
