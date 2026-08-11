import logging

from fastapi import APIRouter, Response

from src.ips_backend.app.models.settings.settings_request import SettingsRequest
from src.ips_backend.app.models.settings.settings_response import SettingsResponse
from src.ips_backend.pump.pumps_registry import pumps_registry

router = APIRouter()

logger = logging.getLogger(__name__)


@router.get("/pumps/{pump_id}/settings", response_model=SettingsResponse)
async def api_pump_get_settings(pump_id: str):
    pump = pumps_registry.get_or_create_pump(pump_id)
    settings = pump.settings
    return SettingsResponse(
        low_critical_level=settings.low_critical_level,
        low_warning_level=settings.low_warning_level,
        low_notification_level=settings.low_notification_level,
        high_critical_level=settings.high_critical_level,
        high_warning_level=settings.high_warning_level,
        high_notification_level=settings.high_notification_level,
        user_max_basal_limit=settings.user_max_basal_limit,
    )


@router.post("/pumps/{pump_id}/settings", response_model=SettingsResponse)
async def api_pump_update_settings(pump_id: str, request: SettingsRequest, response: Response):
    pump = pumps_registry.get_or_create_pump(pump_id)

    if request.is_valid():
        await pump.settings_control.update_settings(request)
        settings = pump.settings

        return SettingsResponse(
            low_critical_level=settings.low_critical_level,
            low_warning_level=settings.low_warning_level,
            low_notification_level=settings.low_notification_level,
            high_critical_level=settings.high_critical_level,
            high_warning_level=settings.high_warning_level,
            high_notification_level=settings.high_notification_level,
            user_max_basal_limit=settings.user_max_basal_limit,
        )

    response.status_code = 403
    settings = pump.settings
    return SettingsResponse(
        low_critical_level=settings.low_critical_level,
        low_warning_level=settings.low_warning_level,
        low_notification_level=settings.low_notification_level,
        high_critical_level=settings.high_critical_level,
        high_warning_level=settings.high_warning_level,
        high_notification_level=settings.high_notification_level,
        user_max_basal_limit=settings.user_max_basal_limit,
    )
