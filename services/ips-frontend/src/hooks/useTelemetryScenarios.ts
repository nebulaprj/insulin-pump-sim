import { useState, useCallback, useEffect } from 'react'
import { onPumpIdChange } from '../config/pump'
import {
  getScenarios,
  getCurrentScenario,
  startScenario,
  stopScenario,
} from '../services/api/api'
import type { ScenarioInfo } from '../services/api/types'

export function useTelemetryScenarios() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [currentScenario, setCurrentScenario] = useState<ScenarioInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingScenario, setPendingScenario] = useState<string | null>(null)

  /** Загрузить оба запроса: список сценариев и текущий активный. */
  const loadAll = useCallback(async (opts?: { isRefresh?: boolean }) => {
    const { isRefresh = false } = opts ?? {}
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }
    setLoadError(null)
    try {
      const [scenariosData, currentData] = await Promise.all([
        getScenarios(),
        getCurrentScenario().catch(err => {
          console.warn('Failed to load current scenario:', err)
          return null
        }),
      ])
      setScenarios(scenariosData)
      setCurrentScenario(currentData)
    } catch (err) {
      console.error('Failed to load scenarios:', err)
      setLoadError('Не удалось загрузить список сценариев')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Первая загрузка + перезагрузка при смене pump_id
  useEffect(() => {
    loadAll()
    const unsubscribe = onPumpIdChange(() => {
      loadAll()
    })
    return unsubscribe
  }, [loadAll])

  /** Обновить список сценариев (кнопка «Обновить»). */
  const refresh = useCallback(async () => {
    await loadAll({ isRefresh: true })
  }, [loadAll])

  /** Запустить сценарий по имени. */
  const handleStart = useCallback(async (scenarioName: string) => {
    setActionError(null)
    setPendingScenario(scenarioName)
    try {
      await startScenario(scenarioName)
      // Успех: помечаем этот сценарий как текущий, остальные — не текущие
      const started = scenarios.find(s => s.scenario_name === scenarioName)
      setCurrentScenario(started ?? { scenario_name: scenarioName, description: '' })
    } catch (err) {
      console.error(`Failed to start scenario ${scenarioName}:`, err)
      setActionError(`Не удалось запустить сценарий «${scenarioName}»`)
    } finally {
      setPendingScenario(null)
    }
  }, [scenarios])

  /** Остановить текущий сценарий. */
  const handleStop = useCallback(async () => {
    setActionError(null)
    setPendingScenario('__stop__')
    try {
      await stopScenario()
      // Успех: сценарий остановлен
      setCurrentScenario(null)
    } catch (err) {
      console.error('Failed to stop scenario:', err)
      setActionError('Не удалось остановить сценарий')
    } finally {
      setPendingScenario(null)
    }
  }, [])

  return {
    scenarios,
    currentScenario,
    isLoading,
    isRefreshing,
    loadError,
    actionError,
    pendingScenario,
    refresh,
    handleStart,
    handleStop,
    reload: loadAll,
  }
}
