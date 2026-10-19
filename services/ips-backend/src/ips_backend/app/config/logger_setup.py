import logging
import os
import sys
from logging.handlers import RotatingFileHandler

from pythonjsonlogger.json import JsonFormatter


def setup_logging(
    log_path: str = "./logs/backend.log",
    log_level: str = "INFO",
    max_bytes: int = 10_000_000,
    backup_count: int = 5,
    write_to_file: bool = False,
):
    log_format = "%(asctime)s %(levelname)s %(name)s %(message)s"
    formatter = JsonFormatter(
        log_format,
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        json_ensure_ascii=False,
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler = None

    if write_to_file:
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        file_handler = RotatingFileHandler(
            log_path, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))
    root_logger.handlers.clear()
    root_logger.addHandler(console_handler)
    if write_to_file and file_handler:
        root_logger.addHandler(file_handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
