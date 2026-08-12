from dataclasses import dataclass, field
from datetime import datetime, timezone

from src.ips_backend.pump.data.status import AlertLevel


@dataclass
class Alert:
    level: AlertLevel = field(default_factory=AlertLevel)
    message: str = field(default="")
    action_message: str = field(default="")
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
