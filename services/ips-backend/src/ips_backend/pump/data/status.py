from enum import Enum


class GlucoseLevel(str, Enum):
    NORMAL = "normal"
    LOW = "low"
    HIGH = "high"


class AlertLevel(str, Enum):
    OFF = "off", ""
    NOTIFICATION = "notification", "Оповещение"
    WARNING = "warning", "Предупреждение"
    CRITICAL = "critical", "Критический"

    def __new__(cls, value: str, title: str):
        obj = str.__new__(cls, value)
        obj._value_ = value
        obj.title = title
        return obj


class BolusStatus(str, Enum):
    PUMP_OFF = "pump_off"
    LIMIT_CHECK = "limit_check"
    ALLOWED = "allowed"
    WITH_WARNING = "with_warning"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"
