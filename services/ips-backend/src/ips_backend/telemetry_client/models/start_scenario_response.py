from pydantic import BaseModel


class StartScenarioResponse(BaseModel):
    pump_id: str
    scenarios_name: str
