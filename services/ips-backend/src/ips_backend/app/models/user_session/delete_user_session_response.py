from pydantic import BaseModel


class DeleteUserSessionResponse(BaseModel):
    session_id: str
    message: str = ""
