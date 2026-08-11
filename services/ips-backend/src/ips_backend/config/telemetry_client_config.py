from pydantic import BaseModel, Field, computed_field


class TelemetryClientConfig(BaseModel):
    base_url: str = Field(description="Backend base URL")
    port: int = Field(description="Backend port")
    client_timeout_seconds: int = Field(description="HTTP client timeout in seconds")
