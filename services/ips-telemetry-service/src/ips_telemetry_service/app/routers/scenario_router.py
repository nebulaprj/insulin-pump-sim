import logging

from fastapi import APIRouter, Depends

from src.ips_telemetry_service.app.dependencies.dependencies import get_generator_service
from src.ips_telemetry_service.scenarios.scenarios_registry import get_all_scenarios
from src.ips_telemetry_service.service.generator_service import GeneratorService

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/scenarios")
async def api_pump_get_all_scenarios():
    return get_all_scenarios()


@router.get("/scenario/current")
async def api_pump_stop_telemetry(
    pump_id: str,
    generator: GeneratorService = Depends(get_generator_service),
):
    status = generator.get_status(pump_id)
    return {
        "scenario_name": status["scenario_name"] if status["is_running"] else ""
    }


@router.post("/scenarios/{scenario_name}")
async def api_pump_start_telemetry(
    pump_id: str,
    scenario_name: str,
    generator: GeneratorService = Depends(get_generator_service),
):
    await generator.start(pump_id, scenario_name)


@router.post("/scenario/stop")
async def api_pump_stop_telemetry(
    pump_id: str,
    generator: GeneratorService = Depends(get_generator_service),
):
    await generator.stop(pump_id)
