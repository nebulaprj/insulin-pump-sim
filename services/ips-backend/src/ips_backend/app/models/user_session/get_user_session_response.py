from pydantic import BaseModel


class GetUserSessionResponse(BaseModel):
    session_id: str
