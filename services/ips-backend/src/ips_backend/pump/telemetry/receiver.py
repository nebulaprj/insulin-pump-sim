import logging

from src.ips_backend.pump.data.telemetry import Telemetry

logger = logging.getLogger(__name__)


class Receiver:

    current_telemetry: Telemetry | None = None

    async def register(self, telemetry: Telemetry):
        logger.info(f"Registering telemetry: {telemetry}")
        self.current_telemetry = telemetry

    def get_telemetry(self) -> Telemetry | None:
        logger.info(f"Getting telemetry: {self.current_telemetry}")
        return self.current_telemetry
