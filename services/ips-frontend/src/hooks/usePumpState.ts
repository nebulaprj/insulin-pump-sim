import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AlertLevel, BolusStatus } from '../services/api/types'
import type { PumpState, PumpMessage, MessageSeverity } from '../services/api/types'
import { getPumpStatus, resetPumpBlock } from '../services/api/api'
import {
  POLLING_INTERVAL_MS,
  POLLING_ENABLED,
  MAX_ERROR_RETRIES,
  ERROR_RETRY_DELAY_MS,
} from '../config/polling'
import { getPumpId, onPumpIdChange } from '../config/pump'

const MOCK_PUMP_STATE: PumpState = {
  is_on: true,
  current_glucose_value: 3.4,
  glucose_level: 'low',
  alert_level: AlertLevel.CRITICAL,
  bolus_status: 'blocked',
  basal_speed_pc: 0,
  manual_action_required: true,
  message: 'Критическое понижение уровня глюкозы!',
  action_message: 'Подача инсулина заблокирована',
}

function alertLevelToSeverity(alertLevel: AlertLevel | null): MessageSeverity {
  if (alertLevel === AlertLevel.CRITICAL) return 'critical'
  if (alertLevel === AlertLevel.WARNING) return 'warning'
  return 'info'
}

function areMessagesEqual(a: PumpMessage, b: PumpMessage): boolean {
  return (
    a.id === b.id &&
    a.text === b.text &&
    a.actionText === b.actionText &&
    a.severity === b.severity
  )
}

export function usePumpState() {
  const [pumpState, setPumpState] = useState<PumpState>(MOCK_PUMP_STATE)

  // Отдельное состояние для bolus_status, которое имеет приоритет
  // над pumpState.bolus_status. Используется для мгновенного обновления UI
  // при разблокировке, без ожидания ответа от /status.
  const [bolusStatusOverride, setBolusStatusOverride] = useState<BolusStatus | null>(null)

  const [isResettingBlock, setIsResettingBlock] = useState(false)
  const [resetBlockMessage, setResetBlockMessage] = useState<string | null>(null)

  const [isDelivering, setIsDelivering] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const [pumpId, setPumpId] = useState<string>(getPumpId())

  const errorCountRef = useRef(0)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevMessagesRef = useRef<PumpMessage[]>([])

  const [hasEverLoaded, setHasEverLoaded] = useState(false)
  const isInitialLoading = isLoading && !hasEverLoaded

  useEffect(() => {
    const unsubscribe = onPumpIdChange(newPumpId => {
      errorCountRef.current = 0
      setApiError(null)
      setResetBlockMessage(null)
      setBolusStatusOverride(null)
      setPumpId(newPumpId)
      prevMessagesRef.current = []
    })
    return unsubscribe
  }, [])

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const state = await getPumpStatus()
      setPumpState(state)
      setApiError(null)
      setHasEverLoaded(true)
      errorCountRef.current = 0

      // Если бэкенд подтвердил, что bolus_status = allowed,
      // сбрасываем override (он больше не нужен).
      if (state.bolus_status === BolusStatus.ALLOWED) {
        setBolusStatusOverride(null)
      }
    } catch (err) {
      errorCountRef.current += 1
      const errorMessage = `Backend недоступен (попытка ${errorCountRef.current}/${MAX_ERROR_RETRIES})`
      console.warn(errorMessage, err)

      if (errorCountRef.current >= MAX_ERROR_RETRIES) {
        setApiError(`${errorMessage}. Polling остановлен.`)
      } else {
        setApiError(`${errorMessage}. Используются мок-данные.`)
        if (errorCountRef.current === 1) {
          setPumpState(MOCK_PUMP_STATE)
          setHasEverLoaded(true)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!POLLING_ENABLED) return

    let cancelled = false

    errorCountRef.current = 0
    setApiError(null)

    async function poll() {
      if (cancelled) return

      await fetchStatus()

      if (cancelled) return

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
  }, [fetchStatus, pumpId])

  const messages = useMemo<PumpMessage[]>(() => {
    const text = pumpState.message?.trim() ?? ''
    if (!text) {
      prevMessagesRef.current = []
      return []
    }

    const newMessage: PumpMessage = {
      id: 'system-status',
      text,
      actionText: pumpState.action_message?.trim() || undefined,
      severity: alertLevelToSeverity(pumpState.alert_level),
      timestamp: 0,
    }

    const prev = prevMessagesRef.current

    if (
      prev.length === 1 &&
      prev[0] !== undefined &&
      areMessagesEqual(prev[0], newMessage)
    ) {
      return prev
    }

    const result = [newMessage]
    prevMessagesRef.current = result
    return result
  }, [
    pumpState.message,
    pumpState.action_message,
    pumpState.alert_level,
  ])

  const deliverBolus = useCallback(async () => {
    setIsDelivering(true)
    setApiError(null)
    try {
      console.log('[Bolus] Deliver bolus requested')
      await new Promise(resolve => setTimeout(resolve, 500))
      await fetchStatus()
    } catch (err) {
      console.error('Failed to deliver bolus:', err)
      setApiError('Ошибка при введении болюса')
    } finally {
      setIsDelivering(false)
    }
  }, [fetchStatus])

  /**
   * Снять блокировку болюса.
   *
   * При status === 'OK':
   * 1. Очищаем resetBlockMessage
   * 2. Устанавливаем bolusStatusOverride = 'allowed'
   *    → UI обновляется МГНОВЕННО, без ожидания /status
   * 3. Запускаем fetchStatus() для синхронизации с бэкендом
   *    → Когда придёт ответ, bolusStatusOverride сбросится в null
   */
  const resetBolusBlock = useCallback(async () => {
    setIsResettingBlock(true)
    setApiError(null)
    try {
      const result = await resetPumpBlock()

      if (result.status === 'OK') {
        // 1. Очищаем сообщение под кнопкой
        setResetBlockMessage(null)

        // 2. Устанавливаем override — UI обновится мгновенно
        setBolusStatusOverride(BolusStatus.ALLOWED)

        // 3. Синхронизируем с бэкендом (без await)
        fetchStatus().catch(err => {
          console.warn('Background status sync after reset failed:', err)
        })
      } else {
        // FAILED: сохраняем сообщение бэкенда
        setResetBlockMessage(result.message)
      }
    } catch (err) {
      console.error('Failed to reset pump block:', err)
      setResetBlockMessage('Ошибка связи с бэкендом при снятии блокировки')
    } finally {
      setIsResettingBlock(false)
    }
  }, [fetchStatus])

  // Эффективный bolus_status: override имеет приоритет
  const effectiveBolusStatus = bolusStatusOverride ?? pumpState.bolus_status

  return {
    pumpId,
    pumpState: {
      ...pumpState,
      bolus_status: effectiveBolusStatus,
    },
    messages,
    deliverBolus,
    isDelivering,
    resetBolusBlock,
    isResettingBlock,
    resetBlockMessage,
    isLoading: isInitialLoading,
    apiError,
  }
}