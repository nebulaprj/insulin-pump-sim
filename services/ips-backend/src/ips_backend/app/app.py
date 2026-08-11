import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from src.ips_backend.app.config.logger_setup import setup_logging
from src.ips_backend.app.routers.pumps_router import router as pumps_router
from src.ips_backend.app.routers.telemetry_router import router as telemetry_router
from src.ips_backend.app.routers.telemetry_service_router import router as telemetry_service_router
from src.ips_backend.app.routers.settings_router import router as settings_router
from src.ips_backend.config.loader.settings import app_settings
from src.ips_backend.telemetry_client.client import TelemetryClient

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger_config = app_settings().logger
    setup_logging(
        log_path=logger_config.path,
        log_level=logger_config.level,
        write_to_file=logger_config.write_to_file,
    )
    logger.info("Starting app...")

    telemetry_client = TelemetryClient()
    await telemetry_client.open()
    app.state.telemetry_client = telemetry_client

    logger.info("App is started")

    yield

    logger.info("Stopping app, resources cleanup")
    await telemetry_client.close()


app = FastAPI(
    title="Insulin Pump Simulator",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.include_router(pumps_router, prefix="/api/v1", tags=["Pumps"])
app.include_router(telemetry_router, prefix="/api/v1", tags=["Telemetry"])
app.include_router(telemetry_service_router, prefix="/api/v1", tags=["Telemetry Scenarios"])
app.include_router(settings_router, prefix="/api/v1", tags=["Settings"])

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
)
