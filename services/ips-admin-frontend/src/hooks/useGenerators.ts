import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  getGenerators,
  startGeneratorScenario,
  stopGeneratorScenario,
  stopAllScenarios,
} from '../services/api/api'
import type { GeneratorInfo } from '../services/api/types'
import {
  POLLING_INTERVAL_MS,
  POLLING_ENABLED,
  MAX_ERROR_RETRIES,
  ERROR_RETRY_DELAY_MS,
} from '../config/polling'

export type StatusFilter = 'all' | 'running' | 'stopped'
export type SortField = 'pump_id' | 'scenario_name' | 'status'
export type SortOrder = 'asc' | 'desc'

/**
 * Сравнивает два списка генераторов по содержимому.
 */
function areGeneratorsEqual(
  a: GeneratorInfo[],
  b: GeneratorInfo[],
): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (item, i) =>
      item.pump_id === b[i].pump_id &&
      item.scenario_name === b[i].scenario_name &&
      item.is_running === b[i].is_running,
  )
}

export function useGenerators() {
  const [generators, setGenerators] = useState<GeneratorInfo[]>([])
  const [total, setTotal] = useState(0)
  const [running, setRunning] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Состояние выполняемого действия (pump_id генератора)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Состояние массовой остановки
  const [isStoppingAll, setIsStoppingAll] = useState(false)

  // Состояния фильтров, сортировки и поиска
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('pump_id')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [searchQuery, setSearchQuery] = useState('')

  // Активен ли поллинг
  const [isPollingActive, setIsPollingActive] = useState(POLLING_ENABLED)

  const errorCountRef = useRef(0)
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Запрос списка генераторов. */
  const fetchGenerators = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true)
    }

    try {
      const data = await getGenerators()

      setGenerators(prev =>
        areGeneratorsEqual(prev, data.generators) ? prev : data.generators,
      )
      setTotal(prev => (prev === data.total ? prev : data.total))
      setRunning(prev => (prev === data.running ? prev : data.running))

      setLoadError(null)
      errorCountRef.current = 0
    } catch (err) {
      errorCountRef.current += 1
      console.error('Failed to load generators:', err)

      if (errorCountRef.current >= MAX_ERROR_RETRIES) {
        setLoadError(
          `Не удалось загрузить список генераторов (попытка ${errorCountRef.current}/${MAX_ERROR_RETRIES}). Polling остановлен.`,
        )
      } else {
        setLoadError(
          `Не удалось загрузить список генераторов (попытка ${errorCountRef.current}/${MAX_ERROR_RETRIES}).`,
        )
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Запустить сценарий (кнопка Play / «Старт»). */
  const startScenario = useCallback(
    async (scenarioName: string, pumpId: string) => {
      setPendingAction(pumpId)
      setActionError(null)
      try {
        await startGeneratorScenario(scenarioName, pumpId)
        await fetchGenerators(false)
      } catch (err) {
        console.error(
          `Failed to start scenario ${scenarioName} for ${pumpId}:`,
          err,
        )
        setActionError(
          `Не удалось запустить сценарий «${scenarioName}» для помпы ${pumpId}`,
        )
      } finally {
        setPendingAction(null)
      }
    },
    [fetchGenerators],
  )

  /** Остановить генератор (кнопка Stop). */
  const stopScenario = useCallback(
    async (pumpId: string) => {
      setPendingAction(pumpId)
      setActionError(null)
      try {
        await stopGeneratorScenario(pumpId)
        await fetchGenerators(false)
      } catch (err) {
        console.error(`Failed to stop scenario for ${pumpId}:`, err)
        setActionError(`Не удалось остановить генератор для помпы ${pumpId}`)
      } finally {
        setPendingAction(null)
      }
    },
    [fetchGenerators],
  )

  /**
   * Остановить все генераторы (кнопка «Остановить все»).
   * Список обновляется по ответу POST /scenario/stop/all,
   * дополнительный GET /generators не требуется.
   */
  const stopAllGenerators = useCallback(async () => {
    setIsStoppingAll(true)
    setActionError(null)
    try {
      const data = await stopAllScenarios()
      // Обновляем список по ответу POST-запроса
      setGenerators(prev =>
        areGeneratorsEqual(prev, data.generators) ? prev : data.generators,
      )
      setTotal(prev => (prev === data.total ? prev : data.total))
      setRunning(prev => (prev === data.running ? prev : data.running))
    } catch (err) {
      console.error('Failed to stop all scenarios:', err)
      setActionError('Не удалось остановить все генераторы')
    } finally {
      setIsStoppingAll(false)
    }
  }, [])

  /** Поллинг. */
  useEffect(() => {
    if (!isPollingActive) return

    let cancelled = false

    async function poll() {
      if (cancelled) return

      await fetchGenerators(false)

      if (cancelled) return

      if (errorCountRef.current >= MAX_ERROR_RETRIES) {
        setIsPollingActive(false)
        return
      }

      const delay =
        errorCountRef.current > 0
          ? ERROR_RETRY_DELAY_MS * errorCountRef.current
          : POLLING_INTERVAL_MS

      pollingTimeoutRef.current = setTimeout(poll, delay)
    }

    poll()

    return () => {
      cancelled = true
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current)
      }
    }
  }, [fetchGenerators, isPollingActive])

  /** Ручное обновление (кнопка «Обновить»). */
  const reload = useCallback(async () => {
    errorCountRef.current = 0
    setLoadError(null)
    setIsPollingActive(true)
    await fetchGenerators(true)
  }, [fetchGenerators])

  /** Производный список: фильтрация + поиск + сортировка. */
  const filteredGenerators = useMemo(() => {
    let result = [...generators]

    if (statusFilter === 'running') {
      result = result.filter(g => g.is_running)
    } else if (statusFilter === 'stopped') {
      result = result.filter(g => !g.is_running)
    }

    const query = searchQuery.trim().toLowerCase()
    if (query) {
      result = result.filter(g => g.pump_id.toLowerCase().includes(query))
    }

    result.sort((a, b) => {
      let compareResult = 0

      if (sortField === 'pump_id') {
        compareResult = a.pump_id.localeCompare(b.pump_id)
      } else if (sortField === 'scenario_name') {
        compareResult = a.scenario_name.localeCompare(b.scenario_name)
      } else if (sortField === 'status') {
        compareResult = Number(a.is_running) - Number(b.is_running)
      }

      return sortOrder === 'asc' ? compareResult : -compareResult
    })

    return result
  }, [generators, statusFilter, searchQuery, sortField, sortOrder])

  return {
    generators: filteredGenerators,
    total,
    running,
    isLoading,
    loadError,
    pendingAction,
    actionError,
    isStoppingAll,
    isPollingActive,
    statusFilter,
    setStatusFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    reload,
    startScenario,
    stopScenario,
    stopAllGenerators,
  }
}