export enum GlucoseLevel {
  NORMAL = 'normal',
  LOW = 'low',
  HIGH = 'high',
}

export enum AlertLevel {
  OFF = 'off',
  NOTIFICATION = 'notification',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum BolusStatus {
  PUMP_OFF = 'pump_off',
  LIMIT_CHECK = 'limit_check',
  ALLOWED = 'allowed',
  WITH_WARNING = 'with_warning',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
}

/** Состояние помпы — GET /api/v1/pumps/{pump_id}/status */
export interface PumpState {
  is_on: boolean | null
  current_glucose_value: number | null
  glucose_level: GlucoseLevel | null
  alert_level: AlertLevel | null
  bolus_status: BolusStatus | null
  basal_speed_pc: number | null
  manual_action_required: boolean | null
  message: string | null
  action_message: string | null
}

/** Ответ на POST /api/v1/pumps/{pump_id}/block/reset */
export interface ResetBlockResponse {
  status: 'OK' | 'FAILED' | string
  message: string
}

/** Текущая телеметрия — GET /api/v1/pumps/{pump_id}/telemetry */
export interface TelemetryResponse {
  glucose_value: number | null
  glucose_unit: string | null
  timestamp: string | null
}

/** Ошибка API (если бэкенд возвращает нестандартный формат) */
export interface ApiError {
  detail?: string
  status?: string
  message?: string
}

export type MessageSeverity = 'info' | 'warning' | 'critical'

export interface PumpMessage {
  id: string
  text: string
  actionText?: string
  severity: MessageSeverity
  timestamp: number
}

/** Диапазоны допустимых значений настроек (из ответа бэкенда). */
export interface SettingsRange {
  min_level: number
  max_level: number
  min_basal: number
  max_basal: number
}

/** Ответ GET/POST /pumps/{pump_id}/settings */
export interface SettingsResponse {
  low_critical_level: number
  low_warning_level: number
  low_notification_level: number

  high_notification_level: number
  high_warning_level: number
  high_critical_level: number

  user_max_basal_limit: number

  range: SettingsRange
}

/** Тело POST /pumps/{pump_id}/settings */
export interface SettingsRequest {
  low_critical_level: number
  low_warning_level: number
  low_notification_level: number

  high_notification_level: number
  high_warning_level: number
  high_critical_level: number

  user_max_basal_limit: number
}

/** Сценарий генерации телеметрии (ответ GET /scenarios). */
export interface ScenarioInfo {
  scenario_name: string
  description: string
}