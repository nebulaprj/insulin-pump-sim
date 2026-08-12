from dataclasses import field
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from src.ips_backend.pump.data.status import AlertLevel


class AlertResponse(BaseModel):
    level: AlertLevel = Field(default_factory=AlertLevel)
    level_str: str = Field(default="")
    message: str = Field(default="")
    action_message: str = Field(default="")
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
