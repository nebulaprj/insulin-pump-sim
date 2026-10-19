import { api, telemetryApi } from './client'
import type {
  HealthCheckResponse,
  GeneratorsResponse,
  ScenarioInfo,
} from './types'

/**
 * GET /api/v1/health
 * Проверка доступности бэкенда (заглушка).
 */
export async function checkHealth(): Promise<HealthCheckResponse> {
  const response = await api.get<HealthCheckResponse>('/health')
  return response.data
}

/**
 * GET /generators (ips-telemetry-service)
 * Список всех генераторов телеметрии.
 */
export async function getGenerators(): Promise<GeneratorsResponse> {
  const response = await telemetryApi.get<GeneratorsResponse>('/generators')
  return response.data
}

/**
 * GET /scenarios (ips-telemetry-service)
 * Список всех доступных сценариев генерации.
 */
export async function getScenarios(): Promise<ScenarioInfo[]> {
  const response = await telemetryApi.get<ScenarioInfo[]>('/scenarios')
  return response.data
}

/**
 * POST /scenarios/{scenario_name}?pump_id={pump_id} (ips-telemetry-service)
 * Запустить генерацию по сценарию для помпы.
 */
export async function startGeneratorScenario(
  scenarioName: string,
  pumpId: string,
): Promise<void> {
  await telemetryApi.post(`/scenarios/${scenarioName}`, null, {
    params: { pump_id: pumpId },
  })
}

/**
 * POST /scenario/stop?pump_id={pump_id} (ips-telemetry-service)
 * Остановить генерацию для помпы.
 */
export async function stopGeneratorScenario(pumpId: string): Promise<void> {
  await telemetryApi.post(`/scenario/stop`, null, {
    params: { pump_id: pumpId },
  })
}

/**
 * POST /scenario/stop/all (ips-telemetry-service)
 * Остановить все генераторы. Возвращает обновлённый список генераторов.
 */
export async function stopAllScenarios(): Promise<GeneratorsResponse> {
  const response = await telemetryApi.post<GeneratorsResponse>(
    '/scenario/stop/all',
  )
  return response.data
}