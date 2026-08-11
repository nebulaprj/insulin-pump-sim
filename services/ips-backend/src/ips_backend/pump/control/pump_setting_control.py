from src.ips_backend.app.models.settings.settings_request import SettingsRequest
from src.ips_backend.pump.data.pump_settings import PumpSettings


class PumpSettingControl:

    def __init__(self, pump_settings: PumpSettings):
        self.pump_settings = pump_settings

    async def set_low_notification_level(self, level: float):
        self.pump_settings.low_notification_level = level

    async def set_low_warning_level(self, level: float):
        self.pump_settings.low_warning_level = level

    async def set_low_critical_level(self, level: float):
        self.pump_settings.low_critical_level = level

    async def set_high_notification_level(self, level: float):
        self.pump_settings.high_notification_level = level

    async def set_high_warning_level(self, level: float):
        self.pump_settings.high_warning_level = level

    async def set_high_critical_level(self, level: float):
        self.pump_settings.high_critical_level = level

    async def set_user_max_basal_limit(self, limit: int):
        self.pump_settings.user_max_basal_limit = limit

    async def update_settings(self, request: SettingsRequest):
        await self.set_low_notification_level(request.low_notification_level)
        await self.set_low_warning_level(request.low_warning_level)
        await self.set_low_critical_level(request.low_critical_level)
        await self.set_high_notification_level(request.high_notification_level)
        await self.set_high_warning_level(request.high_warning_level)
        await self.set_high_critical_level(request.high_critical_level)
        await self.set_user_max_basal_limit(request.user_max_basal_limit)
