from pydantic import BaseModel


class ResetBlockResponse(BaseModel):
    status: str
    message: str
