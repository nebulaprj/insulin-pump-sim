import logging

from fastapi import APIRouter, Depends

from src.ips_backend.app.dependencies.dependencies import get_telemetry_client
from src.ips_backend.telemetry_client.client import TelemetryClient
from src.ips_backend.telemetry_client.models.scenario_response import ScenarioResponse
from src.ips_backend.telemetry_client.models.start_scenario_response import StartScenarioResponse
from src.ips_backend.telemetry_client.models.stop_scenario_response import StopScenarioResponse

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/pumps/{pump_id}/scenarios", response_model=list[ScenarioResponse])
async def api_get_all_scenarios(client: TelemetryClient = Depends(get_telemetry_client)):
    return await client.get_all_scenarios()


@router.get("/pumps/{pump_id}/scenario/current", response_model=ScenarioResponse)
async def api_get_current_scenario(
    pump_id: str,
    client: TelemetryClient = Depends(get_telemetry_client)
):
    return await client.get_current_scenario(pump_id)


@router.post("/pumps/{pump_id}/scenarios/{scenario_name}", response_model=StartScenarioResponse)
async def api_start_scenario(
    pump_id: str,
    scenario_name: str,
    client: TelemetryClient = Depends(get_telemetry_client),
):
    return await client.start_scenario(pump_id, scenario_name)


@router.post("/pumps/{pump_id}/scenario/stop", response_model=StopScenarioResponse)
async def api_stop_scenario(
    pump_id: str,
    client: TelemetryClient = Depends(get_telemetry_client),
):
    return await client.stop_scenario(pump_id)
