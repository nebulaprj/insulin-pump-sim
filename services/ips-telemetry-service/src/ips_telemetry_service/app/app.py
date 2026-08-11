import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from src.ips_telemetry_service.app.config.logger_setup import setup_logging
from src.ips_telemetry_service.app.routers.scenario_router import router as scenario_router
from src.ips_telemetry_service.config.loader.settings import app_settings
from src.ips_telemetry_service.service.telemetry_service import TelemetryService

logger = logging.getLogger(__name__)

telemetry_service = TelemetryService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger_config = app_settings().logger
    setup_logging(
        log_path=logger_config.path,
        log_level=logger_config.level,
        write_to_file=logger_config.write_to_file,
    )
    logger.info("Starting app...")

    app.state.telemetry_service = telemetry_service

    logger.info("App is started")

    yield

    logger.info("Stopping app, resources cleanup")
    await telemetry_service.shutdown()


app = FastAPI(
    title="Insulin Pump Telemetry Service",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(scenario_router, prefix="/api/v1", tags=["Scenarios"])

ALLOWED_ORIGINS = [
    "http://localhost",
    "http://localhost:80",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:80",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"],
)
