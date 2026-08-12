import logging
from collections import deque
from datetime import datetime

from src.ips_backend.config.loader.settings import app_settings
from src.ips_backend.pump.data.alert import Alert
from src.ips_backend.pump.data.status import AlertLevel

logger = logging.getLogger(__name__)


class AlertRecorder:
    def __init__(self):
        alerts_limit = app_settings().app.alerts_limit
        self.alerts: deque[Alert] = deque(maxlen=alerts_limit)

        self._normal = Alert(level=AlertLevel.OFF)
        self._last_alert = self._normal

    def register(self, alert: Alert):
        if self._last_alert != alert:
            alert.timestamp = datetime.now()
            logger.info(f"Alert registered: {alert.level} at {alert.timestamp}")
            self.alerts.append(alert)
            self._last_alert = alert

    def register_normal(self):
        if self._last_alert != self._normal:
            logger.info("No alert registered")
            self.alerts.append(self._normal)
            self._last_alert = self._normal

    async def delete(self, alert: Alert):
        logger.info(f"Alert deleted: {alert.level} at {alert.timestamp}")
        self.alerts.remove(alert)

    async def delete_all(self):
        logger.info("All alerts deleted")
        self.alerts.clear()
