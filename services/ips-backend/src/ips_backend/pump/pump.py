import logging

from src.ips_backend.pump.control.alerts_recorder import AlertRecorder
from src.ips_backend.pump.control.pump_auto_control import PumpAutoControl
from src.ips_backend.pump.control.pump_manual_control import PumpManualControl
from src.ips_backend.pump.control.pump_setting_control import PumpSettingControl
from src.ips_backend.pump.data.pump_settings import PumpSettings
from src.ips_backend.pump.data.pump_state import PumpState
from src.ips_backend.pump.telemetry.receiver import Receiver

logger = logging.getLogger(__name__)


class Pump:
    pump_id: str
    state: PumpState
    settings: PumpSettings
    alerts_recorder: AlertRecorder
    auto_control: PumpAutoControl
    manual_control: PumpManualControl
    receiver: Receiver
    settings_control: PumpSettingControl

    def __init__(self, pump_id: str):
        self.pump_id = pump_id
        self.state = PumpState.create_initial_state()
        self.settings = PumpSettings()
        self.alerts_recorder = AlertRecorder()
        self.auto_control = PumpAutoControl(
            pump_state=self.state,
            pump_settings=self.settings,
            alerts_recorder=self.alerts_recorder,
        )
        self.manual_control = PumpManualControl(
            pump_state=self.state,
            pump_settings=self.settings,
        )
        self.receiver = Receiver()
        self.settings_control = PumpSettingControl(
            pump_settings=self.settings,
        )
