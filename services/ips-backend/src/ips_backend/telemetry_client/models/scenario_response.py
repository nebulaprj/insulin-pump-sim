from pydantic import BaseModel


class ScenarioResponse(BaseModel):
    scenario_name: str
    description: str
