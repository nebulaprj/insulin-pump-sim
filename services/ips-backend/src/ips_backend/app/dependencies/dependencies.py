from fastapi import Request

from src.ips_backend.telemetry_client.client import TelemetryClient


def get_telemetry_client(request: Request) -> TelemetryClient:
    return request.app.state.telemetry_client
