import logging

from src.ips_backend.pump.data.pump_settings import PumpSettings
from src.ips_backend.pump.data.pump_state import PumpState
from src.ips_backend.pump.data.status import BolusStatus

logger = logging.getLogger(__name__)


class PumpManualControl:

    def __init__(
        self,
        pump_state: PumpState,
        pump_settings: PumpSettings,
    ):
        self.pump_state = pump_state
        self.pump_settings = pump_settings

    async def pump_on(self) -> bool:
        logger.info("Manual switching pump on...")
        if self.pump_state.manual_action_required:
            logger.info("Pump is blocked, manual reset required first, pump cannot be switched on")
            return False
        else:
            self.pump_state.merge_state(PumpState(is_on=True))
            logger.info("Pump is switched on")
            return True

    async def pump_off(self) -> bool:
        logger.info("Manual switching pump off...")
        self.pump_state.merge_state(PumpState(is_on=False))
        logger.info("Pump is switched off")
        return True

    async def deliver_bolus(self) -> BolusStatus:
        logger.info("Delivering manual bolus...")
        if not self.pump_state.is_on:
            logger.info("Pump is off, unable to deliver manual bolus")
            return BolusStatus.PUMP_OFF

        if self.pump_state.bolus_status in [
            BolusStatus.ALLOWED,
            BolusStatus.WITH_WARNING,
            BolusStatus.LIMIT_CHECK
        ]:
            logger.info("Manual bolus can be delivered")
            return self.pump_state.bolus_status
        else:
            logger.info("Manual bolus is blocked or suspended")
            return self.pump_state.bolus_status

    async def reset_pump_block(self) -> bool:
        logger.info("Manual resetting pump block...")
        if self.pump_state.current_glucose_value is None:
            logger.info(f"Glucose level is unknown, block cannot be reset")
            return False

        if self.pump_state.current_glucose_value > self.pump_settings.low_notification_level:
            logger.info(f"Glucose level is acceptable: {self.pump_state.current_glucose_value}, block is reset")
            self.pump_state.merge_state(PumpState(manual_action_required = False))
            return True
        else:
            logger.info(f"Glucose level is still critical: {self.pump_state.current_glucose_value}, block cannot be reset")
            return False
