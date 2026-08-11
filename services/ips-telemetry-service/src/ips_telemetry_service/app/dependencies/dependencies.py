from fastapi import Request

from src.ips_telemetry_service.service.generator_service import GeneratorService


def get_generator_service(request: Request) -> GeneratorService:
    return request.app.state.generator_service
