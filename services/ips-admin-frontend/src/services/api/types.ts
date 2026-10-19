// Базовые типы для админ-панели

export interface HealthCheckResponse {
  status: string
}

/** Информация об одном генераторе телеметрии. */
export interface GeneratorInfo {
  pump_id: string
  scenario_name: string
  is_running: boolean
}

/** Ответ GET /generators сервиса телеметрии. */
export interface GeneratorsResponse {
  total: number
  running: number
  generators: GeneratorInfo[]
}

// Базовые типы для админ-панели

export interface HealthCheckResponse {
  status: string
}

/** Информация об одном генераторе телеметрии. */
export interface GeneratorInfo {
  pump_id: string
  scenario_name: string
  is_running: boolean
}

/** Ответ GET /generators сервиса телеметрии. */
export interface GeneratorsResponse {
  total: number
  running: number
  generators: GeneratorInfo[]
}

/** Информация об одном сценарии (ответ GET /scenarios). */
export interface ScenarioInfo {
  scenario_name: string
  description: string
}