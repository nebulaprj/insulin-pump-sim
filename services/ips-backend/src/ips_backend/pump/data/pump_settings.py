from dataclasses import dataclass, field

from pydantic import computed_field


@dataclass
class PumpSettings:
    low_critical_level: float = field(default=2.8)
    low_warning_level: float = field(default=3.9)
    low_notification_level: float = field(default=4.5)

    high_notification_level: float = field(default=10.0)
    high_warning_level: float = field(default=13.9)
    high_critical_level: float = field(default=16.7)

    user_max_basal_limit: int = field(default=250)
    hardware_max_basal_limit: int = field(default=350)

    @computed_field
    @property
    def max_basal_limit(self) -> int:
        return min(self.user_max_basal_limit, self.hardware_max_basal_limit)
