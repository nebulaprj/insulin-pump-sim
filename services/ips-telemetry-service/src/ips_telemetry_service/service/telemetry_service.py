import asyncio
import logging

import httpx2

from src.ips_telemetry_service.config.loader.settings import app_settings
from src.ips_telemetry_service.scenarios.scenarios_registry import scenarios

logger = logging.getLogger(__name__)


class TelemetryService:

    def __init__(self):
        self._tasks: dict[str, asyncio.Task] = {}
        self._clients: dict[str, httpx2.AsyncClient] = {}
        self._stop_events: dict[str, asyncio.Event] = {}
        self._scenario_names: dict[str, str] = {}

    def pump_ids(self) -> list[str]:
        return list(self._tasks.keys())

    def is_running(self, pump_id: str) -> bool:
        task = self._tasks.get(pump_id)
        return task is not None and not task.done()

    def get_status(self, pump_id: str) -> dict:
        scenario_name = self._scenario_names[pump_id] if pump_id in self._scenario_names else ""
        return {
            "pump_id": pump_id,
            "scenario_name": scenario_name,
            "is_running": self.is_running(pump_id),
        }

    def get_status_all(self) -> dict:
        return {
            "total": len(self._tasks),
            "running": sum(1 for pump_id in self._tasks if self.is_running(pump_id)),
            "generators": [self.get_status(pump_id) for pump_id in self._tasks],
        }

    async def start(self, pump_id: str, scenario_name: str) -> dict:
        logger.info(f"{pump_id}: Starting telemetry generator with scenario '{scenario_name}'...")

        config = app_settings().telemetry

        if self.is_running:
            logger.info(f"{pump_id}: Stopping currently running telemetry generator...")
            await self.stop(pump_id)
            await asyncio.sleep(0.1)
            logger.info(f"{pump_id}: Currently running telemetry generator is stopped")

        if pump_id not in self._clients:
            self._clients[pump_id] = httpx2.AsyncClient(timeout=config.client_timeout_seconds, follow_redirects=True)

        self._stop_events[pump_id] = asyncio.Event()

        self._tasks[pump_id] = asyncio.create_task(self._generation_loop(pump_id, scenario_name))
        logger.info(f"{pump_id}: Telemetry generator is started with scenario '{scenario_name}'")
        self._scenario_names[pump_id] = scenario_name
        return self.get_status(pump_id)

    async def stop(self, pump_id: str) -> dict:
        logger.info(f"{pump_id}: Stopping telemetry generator...")
        if pump_id not in self._tasks:
            logger.info(f"{pump_id}: Telemetry generator is not registered for this pump, nothing to stop")
            return self.get_status(pump_id)
        if not self.is_running:
            logger.info(f"{pump_id}: Telemetry generator is not running, nothing to stop")
            return self.get_status(pump_id)

        self._stop_events[pump_id].set()

        task = self._tasks[pump_id]
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        del self._tasks[pump_id]

        logger.info(f"{pump_id}: Telemetry generator is stopped")
        self._scenario_names[pump_id] = ""
        return self.get_status(pump_id)

    async def stop_all(self) -> dict:
        pump_ids = list(self._tasks.keys())
        for pump_id in pump_ids:
            await self.stop(pump_id)
        return self.get_status_all()

    async def shutdown(self):
        logger.info("Shutting down telemetry generator...")
        await self.stop_all()
        for pump_id, client in self._clients.items():
            await client.aclose()
            logger.info(f"{pump_id}: Client is closed for this pump")

        self._clients.clear()
        self._stop_events.clear()
        self._scenario_names.clear()

        logger.info("Telemetry generator is shut down")

    async def _generation_loop(self, pump_id: str, scenario_name: str):
        config = app_settings().telemetry
        scenario = scenarios[scenario_name]

        client = self._clients[pump_id]
        stop_event = self._stop_events[pump_id]

        try:
            while not stop_event.is_set():
                payload = scenario.next()
                backend_url = config.backend_url(pump_id)

                if config.dry_run:
                    logger.info(f"Telemetry dry run: glucose: {payload['glucose_value']} "
                                f"{payload['glucose_unit']} ({payload['timestamp']})")
                else:
                    try:
                        response = await client.post(
                            url=backend_url,
                            json=payload,
                        )
                        logger.info(f"Telemetry is sent: glucose: {payload['glucose_value']} "
                                    f"{payload['glucose_unit']} ({payload['timestamp']}), "
                                    f"status={response.status_code}")
                    except httpx2.ConnectError as e:
                        logger.warning(f"Backend is unreachable: {backend_url}")
                    except httpx2.ConnectTimeout as e:
                        logger.warning(f"Request timeout to backend: {backend_url}")
                    except httpx2.HTTPError as e:
                        logger.error(f"HTTP error while sending telemetry to backend: {backend_url}")

                try:
                    await asyncio.wait_for(
                        stop_event.wait(),
                        timeout=config.telemetry_interval_seconds,
                    )
                    break
                except asyncio.TimeoutError:
                    pass

        except asyncio.CancelledError:
            logger.info("Telemetry generator is cancelled")
            raise

        logger.info(f"Telemetry generator is finished")
