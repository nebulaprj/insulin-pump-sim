from pydantic import BaseModel, Field

from src.ips_backend.pump.data.status import GlucoseLevel, AlertLevel, BolusStatus


class PumpStateResponse(BaseModel):
    is_on: bool | None = Field(default=None)
    current_glucose_value: float | None = Field(default=None)
    glucose_level: GlucoseLevel | None = Field(default=None)
    alert_level: AlertLevel | None = Field(default=None)
    bolus_status: BolusStatus | None = Field(default=None)
    basal_speed_pc: int | None = Field(default=None)
    manual_action_required: bool | None = Field(default=None)
    message: str | None = Field(default=None)
    action_message: str | None = Field(default=None)
    alerts_count: int = Field(default=0)
