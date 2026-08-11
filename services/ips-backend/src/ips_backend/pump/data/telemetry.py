from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Telemetry:
    glucose_value: float = field(default_factory=float)
    glucose_unit: str = field(default_factory=str)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
