from pydantic import Field, BaseModel


class ServiceConfig(BaseModel):
    host: str = Field(default="127.0.0.1", description="API service IP address")
    port: int = Field(default=8000, description="API service port")
    timeout_keep_alive: int = Field(
        default=300, description="API service keep alive timeout"
    )
    timeout_graceful_shutdown: int = Field(
        default=300, description="API service graceful shutdown timeout"
    )
    reload: bool = Field(default=False, description="API service auto reload")
