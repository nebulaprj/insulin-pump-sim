import { api } from './client'
import { getPumpId } from '../../config/pump'
import type {
  PumpState,
  ResetBlockResponse,
  TelemetryResponse,
  SettingsResponse,
  SettingsRequest,
  ScenarioInfo,
} from './types'

/**
 * GET /api/v1/pumps/{pump_id}/status
 * Текущее состояние помпы.
 */
export async function getPumpStatus(): Promise<PumpState> {
  const pumpId = getPumpId()
  const response = await api.get<PumpState>(`/pumps/${pumpId}/status`)
  return response.data
}

/**
 * POST /api/v1/pumps/{pump_id}/block/reset
 * Ручной сброс блокировки болюса.
 *
 * Возвращает:
 *  - { status: "OK",    message: "..." } при HTTP 200
 *  - { status: "FAILED", message: "..." } при HTTP 403
 */
export async function resetPumpBlock(): Promise<ResetBlockResponse> {
  const pumpId = getPumpId()
  try {
    const response = await api.post<ResetBlockResponse>(
      `/pumps/${pumpId}/block/reset`,
    )
    return response.data
  } catch (err) {
    const axiosErr = err as { response?: { data?: ResetBlockResponse } }
    const data = axiosErr.response?.data
    if (data && typeof data === 'object' && 'status' in data) {
      return data as ResetBlockResponse
    }
    throw err
  }
}

/**
 * GET /api/v1/pumps/{pump_id}/telemetry
 * Последнее измерение телеметрии.
 */
export async function getTelemetry(): Promise<TelemetryResponse> {
  const pumpId = getPumpId()
  const response = await api.get<TelemetryResponse>(
    `/pumps/${pumpId}/telemetry`,
  )
  return response.data
}

/**
 * GET /api/v1/pumps/{pump_id}/settings
 * Получить текущие настройки помпы и допустимые диапазоны.
 */
export async function getSettings(): Promise<SettingsResponse> {
  const pumpId = getPumpId()
  const response = await api.get<SettingsResponse>(`/pumps/${pumpId}/settings`)
  return response.data
}

/**
 * POST /api/v1/pumps/{pump_id}/settings
 * Сохранить настройки помпы.
 *
 * И при 200, и при 403 в теле приходит SettingsResponse.
 * Возвращаем данные и статус, чтобы вызывающий код мог обработать 403.
 */
export async function saveSettings(
  settings: SettingsRequest,
): Promise<{ data: SettingsResponse; status: number }> {
  const pumpId = getPumpId()
  try {
    const response = await api.post<SettingsResponse>(
      `/pumps/${pumpId}/settings`,
      settings,
    )
    return { data: response.data, status: response.status }
  } catch (err) {
    const axiosErr = err as {
      response?: { data?: SettingsResponse; status: number }
    }
    if (
      axiosErr.response &&
      axiosErr.response.data &&
      typeof axiosErr.response.data === 'object'
      && 'low_critical_level' in axiosErr.response.data
    ) {
      return { data: axiosErr.response.data, status: axiosErr.response.status }
    }
    throw err
  }
}

/**
 * GET /api/v1/pumps/{pump_id}/scenarios
 * Список всех доступных сценариев генерации.
 */
export async function getScenarios(): Promise<ScenarioInfo[]> {
  const pumpId = getPumpId()
  const response = await api.get<ScenarioInfo[]>(`/pumps/${pumpId}/scenarios`)
  return response.data
}

/**
 * GET /api/v1/pumps/{pump_id}/scenario/current
 * Текущий активный сценарий.
 * Возвращает null, если сценарий не запущен (404 или пустой ответ).
 */
export async function getCurrentScenario(): Promise<ScenarioInfo | null> {
  const pumpId = getPumpId()
  try {
    const response = await api.get<ScenarioInfo>(
      `/pumps/${pumpId}/scenario/current`,
    )
    if (!response.data || Object.keys(response.data).length === 0) {
      return null
    }
    return response.data
  } catch (err) {
    const axiosErr = err as { response?: { status: number } }
    if (axiosErr.response?.status === 404) {
      return null
    }
    throw err
  }
}

/**
 * POST /api/v1/pumps/{pump_id}/scenarios/{scenario_name}
 * Запустить генерацию по сценарию.
 */
export async function startScenario(scenarioName: string): Promise<void> {
  const pumpId = getPumpId()
  await api.post(`/pumps/${pumpId}/scenarios/${scenarioName}`)
}

/**
 * POST /api/v1/pumps/{pump_id}/scenario/stop
 * Остановить генерацию.
 */
export async function stopScenario(): Promise<void> {
  const pumpId = getPumpId()
  await api.post(`/pumps/${pumpId}/scenario/stop`)
}