from pydantic import BaseModel, Field


class GeneratorConfig(BaseModel):
    backend_base_url: str = Field(description="Backend base URL")
    backend_port: int = Field(description="Backend port")
    backend_path: str = Field(description="Backend URL path")
    client_timeout_seconds: int = Field(description="HTTP client timeout in seconds")
    telemetry_interval_seconds: int = Field(description="Telemetry interval in seconds")
    dry_run: bool = Field(default=False, description="Telemetry dry run")

    def backend_url(self, pump_id: str) -> str:
        url = f"{self.backend_base_url}:{self.backend_port}/{self.backend_path}"
        return url.format(pump_id=pump_id)
