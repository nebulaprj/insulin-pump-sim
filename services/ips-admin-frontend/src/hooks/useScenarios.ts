import { useState, useCallback, useEffect } from 'react'
import { getScenarios } from '../services/api/api'
import type { ScenarioInfo } from '../services/api/types'

export function useScenarios() {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  /** Загрузить список сценариев с сервиса телеметрии. */
  const loadScenarios = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await getScenarios()
      setScenarios(data)
    } catch (err) {
      console.error('Failed to load scenarios:', err)
      setLoadError('Не удалось загрузить список сценариев')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загрузка при монтировании (запуск приложения / обновление страницы)
  useEffect(() => {
    loadScenarios()
  }, [loadScenarios])

  return {
    scenarios,
    isLoading,
    loadError,
    reload: loadScenarios,
  }
}