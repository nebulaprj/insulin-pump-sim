from pydantic import BaseModel


class StopScenarioResponse(BaseModel):
    pump_id: str
