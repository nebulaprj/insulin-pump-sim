from dataclasses import dataclass, field

from src.ips_backend.pump.data.status import GlucoseLevel, AlertLevel, BolusStatus


@dataclass
class PumpState:
    is_on: bool | None = field(default=None)
    current_glucose_value: float | None = field(default=None)
    glucose_level: GlucoseLevel | None = field(default=None)
    alert_level: AlertLevel | None = field(default=None)
    bolus_status: BolusStatus | None = field(default=None)
    basal_speed_pc: int | None = field(default=None)
    manual_action_required: bool | None = field(default=None)
    message: str | None = field(default=None)
    action_message: str | None = field(default=None)

    @staticmethod
    def create_initial_state() -> PumpState:
        state = PumpState(
            is_on = True,
            glucose_level = GlucoseLevel.NORMAL,
            alert_level = AlertLevel.OFF,
            bolus_status = BolusStatus.ALLOWED,
            basal_speed_pc = 100,
            manual_action_required = False,
            message = "",
            action_message = "",
        )
        return state

    def merge_state(self, other):
        self.is_on = other.is_on if other.is_on else self.is_on
        self.current_glucose_value = other.current_glucose_value if other.current_glucose_value is not None else self.current_glucose_value
        self.glucose_level = other.glucose_level if other.glucose_level is not None else self.glucose_level
        self.alert_level = other.alert_level if other.alert_level is not None else self.alert_level
        self.bolus_status = other.bolus_status if other.bolus_status is not None else self.bolus_status
        self.basal_speed_pc = other.basal_speed_pc if other.basal_speed_pc is not None else self.basal_speed_pc
        self.manual_action_required = other.manual_action_required if other.manual_action_required is not None else self.manual_action_required
        self.message = other.message if other.message is not None else self.message
        self.action_message = other.action_message if other.action_message is not None else self.action_message
