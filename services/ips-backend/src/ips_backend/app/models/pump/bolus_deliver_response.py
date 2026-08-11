from pydantic import BaseModel


class BolusDeliverResponse(BaseModel):
    status: str
    message: str