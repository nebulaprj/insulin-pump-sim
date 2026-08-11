from pydantic import BaseModel, Field


class SettingsRequest(BaseModel):
    low_critical_level: float = Field(..., ge=2.0, le=20.0)
    low_warning_level: float = Field(..., ge=2.0, le=20.0)
    low_notification_level: float = Field(..., ge=2.0, le=20.0)

    high_notification_level: float = Field(..., ge=2.0, le=20.0)
    high_warning_level: float = Field(..., ge=2.0, le=20.0)
    high_critical_level: float = Field(..., ge=2.0, le=20.0)

    user_max_basal_limit: int = Field(..., ge=100, le=350)

    def is_valid(self) -> bool:
        notification_range = self.low_notification_level < self.high_notification_level
        warning_range = self.low_warning_level < self.high_warning_level
        critical_range = self.low_critical_level < self.high_critical_level

        low_levels = self.low_critical_level < self.low_warning_level < self.low_notification_level
        high_levels = self.high_critical_level > self.high_warning_level > self.high_notification_level

        return notification_range and warning_range and critical_range and low_levels and high_levels
