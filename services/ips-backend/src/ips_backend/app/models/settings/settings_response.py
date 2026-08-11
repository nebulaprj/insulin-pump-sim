from pydantic import BaseModel, Field


class SettingsRange(BaseModel):
    min_level: float = Field(default=2.0)
    max_level: float = Field(default=20.0)
    min_basal: int = Field(default=100)
    max_basal: int = Field(default=350)

class SettingsResponse(BaseModel):
    low_critical_level: float
    low_warning_level: float
    low_notification_level: float

    high_notification_level: float
    high_warning_level: float
    high_critical_level: float

    user_max_basal_limit: int

    range: SettingsRange = Field(default_factory=SettingsRange)
