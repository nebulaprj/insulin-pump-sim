from enum import Enum


class GlucoseLevel(str, Enum):
    NORMAL = "normal"
    LOW = "low"
    HIGH = "high"


class AlertLevel(str, Enum):
    OFF = "off"
    NOTIFICATION = "notification"
    WARNING = "warning"
    CRITICAL = "critical"


class BolusStatus(str, Enum):
    PUMP_OFF = "pump_off"
    LIMIT_CHECK = "limit_check"
    ALLOWED = "allowed"
    WITH_WARNING = "with_warning"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"
