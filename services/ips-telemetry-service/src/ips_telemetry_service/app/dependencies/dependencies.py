from fastapi import Request

from src.ips_telemetry_service.service.telemetry_service import TelemetryService


def get_telemetry_service(request: Request) -> TelemetryService:
    return request.app.state.telemetry_service
