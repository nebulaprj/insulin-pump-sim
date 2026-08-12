import logging

from src.ips_backend.pump.control.alerts_recorder import AlertRecorder
from src.ips_backend.pump.data.alert import Alert
from src.ips_backend.pump.data.pump_settings import PumpSettings
from src.ips_backend.pump.data.pump_state import PumpState
from src.ips_backend.pump.data.telemetry import Telemetry
from src.ips_backend.pump.data.status import GlucoseLevel, AlertLevel, BolusStatus

logger = logging.getLogger(__name__)


class PumpAutoControl:

    def __init__(
        self,
        pump_state: PumpState,
        pump_settings: PumpSettings,
        alerts_recorder: AlertRecorder,
    ):
        self.pump_state = pump_state
        self.pump_settings = pump_settings
        self.alerts_recorder = alerts_recorder

    async def process_telemetry(self, telemetry: Telemetry):
        logger.info(f"Glucose data received: {telemetry.glucose_value} {telemetry.glucose_unit} ({telemetry.timestamp})")

        current_glucose_value = telemetry.glucose_value
        self.pump_state.merge_state(PumpState(current_glucose_value=current_glucose_value))

        logger.info(f"Checking received glucose level: {current_glucose_value}")

        match current_glucose_value:
            case v if v <= self.pump_settings.low_critical_level:
                self._low_level_critical()
            case v if v <= self.pump_settings.low_warning_level:
                self._low_level_warning()
            case v if v <= self.pump_settings.low_notification_level:
                self._low_level_notification()
            case v if v >= self.pump_settings.high_critical_level:
                self._high_level_critical()
            case v if v >= self.pump_settings.high_warning_level:
                self._high_level_warning()
            case v if v >= self.pump_settings.high_notification_level:
                self._high_level_notification()
            case _:
                self._process_normal()

    def _process_normal(self):
        logger.info("Glucose level is normal: no actions required")

        if not self.pump_state.manual_action_required:
            message = "Уровень глюкозы в норме"
            action_message = "Штатная подача инсулина"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.NORMAL,
                    alert_level=AlertLevel.OFF,
                    bolus_status=BolusStatus.ALLOWED,
                    basal_speed_pc=100,
                    message=message,
                    action_message=action_message,
                )
            )
            self.alerts_recorder.register_normal()
        else:
            message = "Уровень глюкозы в норме"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.NORMAL,
                    alert_level=AlertLevel.OFF,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )

    def _low_level_notification(self):
        logger.info("Glucose level is low: notification, basal speed is auto-decreased")

        if not self.pump_state.manual_action_required:
            message = "Понижение уровня глюкозы"
            action_message = "Автоматическое снижение скорости подачи инсулина"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.LOW,
                    alert_level=AlertLevel.NOTIFICATION,
                    bolus_status=BolusStatus.WITH_WARNING,
                    basal_speed_pc=50,
                    message=message,
                    action_message=action_message,
                )
            )
            self.alerts_recorder.register(
                Alert(
                    level=AlertLevel.NOTIFICATION,
                    message=message,
                    action_message=action_message,
                )
            )
        else:
            message = "Понижение уровня глюкозы"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.LOW,
                    alert_level=AlertLevel.NOTIFICATION,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )

    def _low_level_warning(self):
        logger.info("Glucose level is significantly low: warning, insulin delivery is suspended")

        if not self.pump_state.manual_action_required:
            message = "Существенное понижение уровня глюкозы"
            action_message = "Минимальная подача инсулина"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.LOW,
                    alert_level=AlertLevel.WARNING,
                    bolus_status=BolusStatus.SUSPENDED,
                    basal_speed_pc=20,
                    message=message,
                    action_message=action_message,
                )
            )
            self.alerts_recorder.register(
                Alert(
                    level=AlertLevel.WARNING,
                    message=message,
                    action_message=action_message,
                )
            )
        else:
            message = "Существенное понижение уровня глюкозы"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.LOW,
                    alert_level=AlertLevel.WARNING,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )

    def _low_level_critical(self):
        logger.info("Glucose level is critically low: critical, insulin delivery is blocked")

        message = "Критическое понижение уровня глюкозы!"
        action_message = "Подача инсулина заблокирована"
        self.pump_state.merge_state(
            PumpState(
                glucose_level=GlucoseLevel.LOW,
                alert_level=AlertLevel.CRITICAL,
                bolus_status=BolusStatus.BLOCKED,
                basal_speed_pc=0,
                message=message,
                action_message=action_message,
                manual_action_required=True,
            )
        )
        self.alerts_recorder.register(
            Alert(
                level=AlertLevel.CRITICAL,
                message=message,
                action_message=action_message,
            )
        )

    def _high_level_notification(self):
        logger.info("Glucose level is high: notification, basal speed is auto-increased, bolus is recommended")

        if not self.pump_state.manual_action_required:
            message = "Повышение уровня глюкозы"
            action_message = "Автоматическое увеличение скорости подачи инсулина. Рекомендовано разовое введение."
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.NOTIFICATION,
                    bolus_status=BolusStatus.ALLOWED,
                    basal_speed_pc=min(120, self.pump_settings.max_basal_limit),
                    message=message,
                    action_message=action_message,
                )
            )
            self.alerts_recorder.register(
                Alert(
                    level=AlertLevel.NOTIFICATION,
                    message=message,
                    action_message=action_message,
                )
            )
        else:
            message = "Повышение уровня глюкозы"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.NOTIFICATION,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )

    def _high_level_warning(self):
        logger.info("Glucose level is significantly high: warning, max basal speed")

        if not self.pump_state.manual_action_required:
            message = "Существенное повышение уровня глюкозы"
            action_message = "Максимальная скорость подачи инсулина"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.WARNING,
                    bolus_status=BolusStatus.ALLOWED,
                    basal_speed_pc=min(180, self.pump_settings.max_basal_limit),
                    message="Существенное повышение уровня глюкозы",
                    action_message="Максимальная скорость подачи инсулина",
                )
            )
            self.alerts_recorder.register(
                Alert(
                    level=AlertLevel.WARNING,
                    message=message,
                    action_message=action_message,
                )
            )
        else:
            message = "Существенное повышение уровня глюкозы"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.WARNING,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )

    def _high_level_critical(self):
        logger.info("Glucose level is critically high: critical, max basal speed")

        if not self.pump_state.manual_action_required:
            message = "Критическое повышение уровня глюкозы!"
            action_message = "Максимальная скорость подачи инсулина"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.CRITICAL,
                    bolus_status=BolusStatus.LIMIT_CHECK,
                    basal_speed_pc=min(300, self.pump_settings.max_basal_limit),
                    message=message,
                    action_message=action_message,
                )
            )
            self.alerts_recorder.register(
                Alert(
                    level=AlertLevel.CRITICAL,
                    message=message,
                    action_message=action_message,
                )
            )
        else:
            message = "Критическое повышение уровня глюкозы!"
            action_message = "Подача инсулина заблокирована"
            self.pump_state.merge_state(
                PumpState(
                    glucose_level=GlucoseLevel.HIGH,
                    alert_level=AlertLevel.CRITICAL,
                    bolus_status=BolusStatus.BLOCKED,
                    basal_speed_pc=0,
                    message=message,
                    action_message=action_message,
                )
            )
