import logging

from fastapi import APIRouter, Response

from src.ips_backend.app.models.pump.bolus_deliver_response import BolusDeliverResponse
from src.ips_backend.app.models.pump.pump_state_response import PumpStateResponse
from src.ips_backend.app.models.pump.reset_block_response import ResetBlockResponse
from src.ips_backend.pump.data.status import BolusStatus
from src.ips_backend.pump.pumps_registry import pumps_registry

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/pumps/{pump_id}/status", response_model=PumpStateResponse)
async def api_pump_get_status(pump_id: str):
    pump = pumps_registry.get_or_create_pump(pump_id)
    state = pump.state
    return PumpStateResponse(
        is_on=state.is_on,
        current_glucose_value=state.current_glucose_value,
        glucose_level=state.glucose_level,
        alert_level=state.alert_level,
        bolus_status=state.bolus_status,
        basal_speed_pc=state.basal_speed_pc,
        manual_action_required=state.manual_action_required,
        message=state.message,
        action_message=state.action_message,
    )


@router.post("/pumps/{pump_id}/bolus/deliver", response_model=BolusDeliverResponse)
async def api_pump_bolus_deliver(pump_id: str, response: Response):
    pump = pumps_registry.get_or_create_pump(pump_id)
    result = await pump.manual_control.deliver_bolus()

    match result:
        case b if b == BolusStatus.ALLOWED or BolusStatus.LIMIT_CHECK:
            return BolusDeliverResponse(
                status="OK",
                message="Болюс введен"
            )
        case BolusStatus.WITH_WARNING:
            return BolusDeliverResponse(
                status="WARNING",
                message="Требуется подтверждение введения болюса"
            )
        case _:
            response.status_code = 403
            return BolusDeliverResponse(
                status="FAILED",
                message="Введение болюса заблокировано"
            )


@router.post("/pumps/{pump_id}/block/reset", response_model=ResetBlockResponse)
async def api_pump_reset_block(pump_id: str, response: Response):
    pump = pumps_registry.get_or_create_pump(pump_id)
    result = await pump.manual_control.reset_pump_block()
    if result:
        return ResetBlockResponse(
            status="OK",
            message="Блокировка помпы снята",
        )

    response.status_code = 403
    return ResetBlockResponse(
        status="FAILED",
        message="Блокировка помпы не может быть снята при текущем уровне глюкозы",
    )
