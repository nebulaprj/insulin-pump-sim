import logging

from fastapi import APIRouter

from src.ips_backend.app.models.telemetry.telemetry_request import TelemetryRequest
from src.ips_backend.app.models.telemetry.telemetry_response import TelemetryResponse
from src.ips_backend.pump.pumps_registry import pumps_registry
from src.ips_backend.pump.data.telemetry import Telemetry

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/pumps/{pump_id}/telemetry", response_model=TelemetryResponse)
async def api_pump_get_telemetry(pump_id: str):
    pump = pumps_registry.get_or_create_pump(pump_id)
    telemetry = pump.receiver.get_telemetry()
    if telemetry:
        return TelemetryResponse(
            glucose_value=telemetry.glucose_value,
            glucose_unit=telemetry.glucose_unit,
            timestamp=telemetry.timestamp,
        )
    else:
        return TelemetryResponse()


@router.post("/pumps/{pump_id}/telemetry")
async def api_pump_receive_telemetry(
    pump_id: str,
    request: TelemetryRequest,
):
    pump = pumps_registry.get_or_create_pump(pump_id)
    telemetry = Telemetry(
        glucose_value=request.glucose_value,
        glucose_unit=request.glucose_unit,
        timestamp=request.timestamp,
    )
    await pump.receiver.register(telemetry)
    await pump.auto_control.process_telemetry(telemetry)
