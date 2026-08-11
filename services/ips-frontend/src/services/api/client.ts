import axios from 'axios'
import type { AxiosError } from 'axios'

/**
 * Axios-клиент для бэкенда FastAPI.
 *
 * - baseURL: '/api/v1' — проксируется Vite на backend
 * - withCredentials: отключено (сессии не используются)
 * - timeout: 10 секунд
 */
export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Интерцептор ответа: логируем ошибки для отладки
api.interceptors.response.use(
  response => response,
  (error: AxiosError<Record<string, unknown>>) => {
    if (error.response) {
      console.error(
        `[API] ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response.data,
      )
    } else if (error.request) {
      console.error('[API] No response from server:', error.message)
    }
    return Promise.reject(error)
  },
)