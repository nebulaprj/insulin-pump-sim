from datetime import datetime

from pydantic import BaseModel, Field


class TelemetryRequest(BaseModel):
    glucose_value: float = Field(description="Glucose value")
    glucose_unit: str = Field(description="Glucose unit")
    timestamp: datetime = Field(description="Timestamp")
