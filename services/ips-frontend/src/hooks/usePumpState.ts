import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { AlertLevel, BolusStatus, GlucoseLevel } from '../services/api/types'
import type { PumpState, PumpMessage, MessageSeverity } from '../services/api/types'
import { getPumpStatus, resetPumpBlock } from '../services/api/api'
import {
  POLLING_INTERVAL_MS,
  POLLING_ENABLED,
  MAX_ERROR_RETRIES,
  ERROR_RETRY_DELAY_MS,
} from '../config/polling'
import { getPumpId, onPumpIdChange } from '../config/pump'

/**
 * Мок-данные: показываются как fallback, когда бэкенд недоступен
 * и актуальные данные ещё ни разу не были загружены.
 */
const MOCK_PUMP_STATE: PumpState = {
  is_on: true,
  current_glucose_value: 3.4,
  glucose_level: GlucoseLevel.LOW,
  alert_level: AlertLevel.CRITICAL,
  bolus_status: BolusStatus.BLOCKED,
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
  // Изначально данных нет. Мок применяется только при ошибке загрузки.
  const [pumpState, setPumpState] = useState<PumpState | null>(null)
  // Данные успешно загружены хотя бы раз (или применён мок при ошибке)
  const [hasLoaded, setHasLoaded] = useState(false)

  const [bolusStatusOverride, setBolusStatusOverride] = useState<BolusStatus | null>(null)

  const [isResettingBlock, setIsResettingBlock] = useState(false)
  const [resetBlockMessage, setResetBlockMessage] = useState<string | null>(null)

  const [isDelivering, setIsDelivering] = useState(false)

  // isLoading изначально true — до первого ответа показываем экран загрузки
  const [isLoading, setIsLoading] = useState(true)

  const [pumpId, setPumpId] = useState<string>(getPumpId())

  const errorCountRef = useRef(0)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevMessagesRef = useRef<PumpMessage[]>([])
  // Ref дублирует hasLoaded, чтобы быть доступным в замыкании fetchStatus
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onPumpIdChange(newPumpId => {
      errorCountRef.current = 0
      setResetBlockMessage(null)
      setBolusStatusOverride(null)
      setPumpId(newPumpId)
      prevMessagesRef.current = []
      // Сбрасываем данные при смене pump_id
      setPumpState(null)
      setHasLoaded(false)
      hasLoadedRef.current = false
      setIsLoading(true)
    })
    return unsubscribe
  }, [])

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    try {
      const state = await getPumpStatus()
      // Успех: показываем актуальные данные
      setPumpState(state)
      setHasLoaded(true)
      hasLoadedRef.current = true
      errorCountRef.current = 0

      if (state.bolus_status === BolusStatus.ALLOWED) {
        setBolusStatusOverride(null)
      }
    } catch (err) {
      errorCountRef.current += 1
      console.warn('Backend request failed:', err)

      // Если актуальные данные ещё ни разу не загружались — показываем мок.
      // Если данные уже были загружены ранее — оставляем их, не заменяя моком.
      if (!hasLoadedRef.current) {
        setPumpState(MOCK_PUMP_STATE)
        setHasLoaded(true)
        hasLoadedRef.current = true
      }
      // Блок ошибки не показываем — apiError убран.
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!POLLING_ENABLED) return

    let cancelled = false

    errorCountRef.current = 0

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

  /**
   * Сообщения формируются только из pumpState.
   * Если данных нет — пустой список.
   */
  const messages = useMemo<PumpMessage[]>(() => {
    if (!pumpState) return []

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
    pumpState?.message,
    pumpState?.action_message,
    pumpState?.alert_level,
  ])

  const deliverBolus = useCallback(async () => {
    setIsDelivering(true)
    try {
      console.log('[Bolus] Deliver bolus requested')
      await new Promise(resolve => setTimeout(resolve, 500))
      await fetchStatus()
    } catch (err) {
      console.error('Failed to deliver bolus:', err)
    } finally {
      setIsDelivering(false)
    }
  }, [fetchStatus])

  const resetBolusBlock = useCallback(async () => {
    setIsResettingBlock(true)
    try {
      const result = await resetPumpBlock()

      if (result.status === 'OK') {
        setResetBlockMessage(null)
        setBolusStatusOverride(BolusStatus.ALLOWED)
        fetchStatus().catch(err => {
          console.warn('Background status sync after reset failed:', err)
        })
      } else {
        setResetBlockMessage(result.message)
      }
    } catch (err) {
      console.error('Failed to reset pump block:', err)
      setResetBlockMessage('Ошибка связи с бэкендом при снятии блокировки')
    } finally {
      setIsResettingBlock(false)
    }
  }, [fetchStatus])

  const effectiveBolusStatus =
    bolusStatusOverride ?? pumpState?.bolus_status ?? null

  const displayPumpState: PumpState | null = pumpState
    ? { ...pumpState, bolus_status: effectiveBolusStatus }
    : null

  return {
    pumpId,
    pumpState: displayPumpState,
    hasLoaded,
    messages,
    deliverBolus,
    isDelivering,
    resetBolusBlock,
    isResettingBlock,
    resetBlockMessage,
    isLoading,
  }
}