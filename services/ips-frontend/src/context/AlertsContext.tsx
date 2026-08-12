import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import type { ReactNode } from 'react'
import {
  getPumpStatus,
  getAlerts,
  clearAlert as clearAlertApi,
  clearAllAlerts as clearAllAlertsApi,
} from '../services/api/api'
import { onPumpIdChange } from '../config/pump'
import { POLLING_INTERVAL_MS } from '../config/polling'
import type { AlertResponse } from '../services/api/types'

interface AlertsContextValue {
  alertsCount: number
  alerts: AlertResponse[]
  isLoadingAlerts: boolean
  isClearing: boolean
  alertsError: string | null
  refreshAlerts: () => Promise<void>
  clearAlert: (alert: AlertResponse) => Promise<void>
  clearAllAlerts: () => Promise<void>
}

const AlertsContext = createContext<AlertsContextValue | null>(null)

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alertsCount, setAlertsCount] = useState(0)
  const [alerts, setAlerts] = useState<AlertResponse[]>([])
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)

  const prevAlertsCountRef = useRef<number | null>(null)

  /** Загрузить список тревог. */
  const loadAlerts = useCallback(async () => {
    setIsLoadingAlerts(true)
    setAlertsError(null)
    try {
      const data = await getAlerts()
      setAlerts(data)
    } catch (err) {
      console.error('Failed to load alerts:', err)
      setAlertsError('Не удалось загрузить тревоги')
    } finally {
      setIsLoadingAlerts(false)
    }
  }, [])

  /**
   * Запросить статус и обновить счётчик тревог.
   * Вызывается после операций очистки для немедленного обновления счётчика.
   */
  const refreshStatusCount = useCallback(async () => {
    try {
      const status = await getPumpStatus()
      const newCount = status.alerts_count ?? 0
      setAlertsCount(newCount)
      prevAlertsCountRef.current = newCount
    } catch (err) {
      console.warn('Failed to refresh status count:', err)
    }
  }, [])

  /** Очистить конкретную тревогу. */
  const clearAlert = useCallback(
    async (alert: AlertResponse) => {
      setIsClearing(true)
      setAlertsError(null)
      try {
        const updatedAlerts = await clearAlertApi(alert)
        setAlerts(updatedAlerts)
        // Обновляем счётчик через запрос статуса
        await refreshStatusCount()
      } catch (err) {
        console.error('Failed to clear alert:', err)
        setAlertsError('Не удалось очистить тревогу')
      } finally {
        setIsClearing(false)
      }
    },
    [refreshStatusCount],
  )

  /** Очистить все тревоги. */
  const clearAllAlerts = useCallback(async () => {
    setIsClearing(true)
    setAlertsError(null)
    try {
      const updatedAlerts = await clearAllAlertsApi()
      setAlerts(updatedAlerts)
      // Обновляем счётчик через запрос статуса
      await refreshStatusCount()
    } catch (err) {
      console.error('Failed to clear all alerts:', err)
      setAlertsError('Не удалось очистить тревоги')
    } finally {
      setIsClearing(false)
    }
  }, [refreshStatusCount])

  /** Polling статуса для отслеживания alerts_count. */
  useEffect(() => {
    let cancelled = false
    let timeoutRef: ReturnType<typeof setTimeout> | null = null

    async function pollStatus() {
      if (cancelled) return

      try {
        const status = await getPumpStatus()
        if (cancelled) return

        const newCount = status.alerts_count ?? 0
        const prevCount = prevAlertsCountRef.current

        setAlertsCount(newCount)

        if (prevCount === null) {
          if (newCount > 0) {
            await loadAlerts()
          }
        } else if (prevCount !== newCount) {
          await loadAlerts()
        }

        prevAlertsCountRef.current = newCount
      } catch (err) {
        console.warn('Failed to poll status for alerts:', err)
      } finally {
        if (!cancelled) {
          timeoutRef = setTimeout(pollStatus, POLLING_INTERVAL_MS)
        }
      }
    }

    const unsubscribe = onPumpIdChange(() => {
      prevAlertsCountRef.current = null
      setAlerts([])
      setAlertsCount(0)
      setAlertsError(null)
    })

    pollStatus()

    return () => {
      cancelled = true
      if (timeoutRef) clearTimeout(timeoutRef)
      unsubscribe()
    }
  }, [loadAlerts])

  return (
    <AlertsContext.Provider
      value={{
        alertsCount,
        alerts,
        isLoadingAlerts,
        isClearing,
        alertsError,
        refreshAlerts: loadAlerts,
        clearAlert,
        clearAllAlerts,
      }}
    >
      {children}
    </AlertsContext.Provider>
  )
}

export function useAlertsContext(): AlertsContextValue {
  const ctx = useContext(AlertsContext)
  if (!ctx) {
    throw new Error('useAlertsContext must be used within AlertsProvider')
  }
  return ctx
}