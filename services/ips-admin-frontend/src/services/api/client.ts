import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * Axios-клиент для бэкенда FastAPI (ips-backend).
 * baseURL: '/api/v1' — проксируется Vite на backend
 */
export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Axios-клиент для сервиса телеметрии (ips-telemetry-service).
 * baseURL: '/telemetry-api/v1' — проксируется Vite на telemetry-service
 */
export const telemetryApi = axios.create({
  baseURL: '/telemetry-api/v1',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Интерцептор ответа: логируем ошибки для отладки
const errorInterceptor = (error: AxiosError<Record<string, unknown>>) => {
  if (error.response) {
    console.error(
      `[API] ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
      error.response.data,
    )
  } else if (error.request) {
    console.error('[API] No response from server:', error.message)
  }
  return Promise.reject(error)
}

api.interceptors.response.use(response => response, errorInterceptor)
telemetryApi.interceptors.response.use(response => response, errorInterceptor)