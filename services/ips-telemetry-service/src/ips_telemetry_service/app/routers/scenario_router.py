import logging

from fastapi import APIRouter, Depends

from src.ips_telemetry_service.app.dependencies.dependencies import get_telemetry_service
from src.ips_telemetry_service.scenarios.scenarios_registry import get_all_scenarios
from src.ips_telemetry_service.service.telemetry_service import TelemetryService

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/scenarios")
async def api_pump_get_all_scenarios():
    return get_all_scenarios()


@router.get("/scenario/current")
async def api_pump_stop_telemetry(
    pump_id: str,
    telemetry: TelemetryService = Depends(get_telemetry_service),
):
    status = telemetry.get_status(pump_id)
    return {
        "scenario_name": status["scenario_name"] if status["is_running"] else ""
    }


@router.post("/scenarios/{scenario_name}")
async def api_pump_start_telemetry(
    pump_id: str,
    scenario_name: str,
    telemetry: TelemetryService = Depends(get_telemetry_service),
):
    await telemetry.start(pump_id, scenario_name)


@router.post("/scenario/stop")
async def api_pump_stop_telemetry(
    pump_id: str,
    telemetry: TelemetryService = Depends(get_telemetry_service),
):
    await telemetry.stop(pump_id)
