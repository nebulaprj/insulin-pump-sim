from src.ips_backend.pump.pump import Pump


class PumpsRegistry:
    def __init__(self):
        self._pumps: dict[str, Pump] = {}

    def get_or_create_pump(self, pump_id: str) -> Pump:
        if pump_id not in self._pumps:
            self._pumps[pump_id] = Pump(pump_id=pump_id)
        return self._pumps[pump_id]


pumps_registry = PumpsRegistry()
