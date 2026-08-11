import logging
from typing import Any

import httpx2
from httpx2 import HTTPError

from src.ips_backend.config.loader.settings import app_settings
from src.ips_backend.telemetry_client.models.scenario_response import ScenarioResponse
from src.ips_backend.telemetry_client.models.start_scenario_response import StartScenarioResponse
from src.ips_backend.telemetry_client.models.stop_scenario_response import StopScenarioResponse

logger = logging.getLogger(__name__)


class TelemetryClient:
    def __init__(self):
        self._base_url: str = ""
        self._client: httpx2.AsyncClient | None = None

    async def __aenter__(self) -> TelemetryClient:
        await self.open()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.close()

    async def open(self) -> None:
        if self._client is None:
            config = app_settings().telemetry_client
            self._base_url = f"{config.base_url}:{config.port}/api/v1"
            self._client = httpx2.AsyncClient(
                base_url=self._base_url,
                timeout=config.client_timeout_seconds,
                follow_redirects=True,
            )
            logger.info(f"Telemetry client is opened for {config.base_url}")

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
            logger.info("Telemetry client is closed")

    @property
    def _http(self) -> httpx2.AsyncClient:
        if self._client is None:
            raise HTTPError("Telemetry client is not opened. Call open() first.")
        return self._client

    async def _request(
        self,
        method: str,
        path: str,
        **kwargs: Any,
    ) -> httpx2.Response:
        url = f"{self._base_url}{path}"
        try:
            return await self._http.request(method=method, url=path, **kwargs)
        except httpx2.ConnectError as e:
            logger.warning(f"Telemetry service is unreachable: {url}")
        except httpx2.ConnectTimeout as e:
            logger.warning(f"Request timeout to telemetry service: {url}")
        except httpx2.HTTPError as e:
            logger.error(f"HTTP error while sending request to telemetry service: {url}")

    async def get_all_scenarios(self) -> list[ScenarioResponse]:
        response = await self._request(
            method="GET",
            path="/scenarios",
        )
        data = response.json()
        return [ScenarioResponse.model_validate(scenario) for scenario in data]

    async def get_current_scenario(self, pump_id: str) -> ScenarioResponse:
        response = await self._request(
            method="GET",
            path=f"/scenario/current",
            params={"pump_id": pump_id},
        )
        data = response.json()
        return ScenarioResponse(
            scenario_name=data.get("scenario_name"),
            description="",
        )

    async def start_scenario(self, pump_id: str, scenario_name: str) -> StartScenarioResponse:
        response = await self._request(
            method="POST",
            path=f"/scenarios/{scenario_name}",
            params={"pump_id": pump_id},
        )
        return StartScenarioResponse(pump_id=pump_id, scenarios_name=scenario_name)

    async def stop_scenario(self, pump_id: str) -> StopScenarioResponse:
        response = await self._request(
            method="POST",
            path=f"/scenario/stop",
            params={"pump_id": pump_id},
        )
        return StopScenarioResponse(pump_id=pump_id)
