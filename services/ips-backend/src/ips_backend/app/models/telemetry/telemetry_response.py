from datetime import datetime

from pydantic import BaseModel, Field


class TelemetryResponse(BaseModel):
    glucose_value: float | None = Field(default=None, description="Glucose value")
    glucose_unit: str | None = Field(default=None, description="Glucose unit")
    timestamp: datetime | None = Field(default=None, description="Timestamp")
