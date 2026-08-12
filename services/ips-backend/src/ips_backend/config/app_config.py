from pydantic import BaseModel, Field


class AppConfig(BaseModel):
    alerts_limit: int = Field(description="Maximum alerts in list")
