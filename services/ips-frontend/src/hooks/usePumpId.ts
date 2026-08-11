import { useState, useCallback } from 'react'
import { getPumpId, setPumpId } from '../config/pump'

export function usePumpId() {
  const [pumpId, setPumpIdState] = useState<string>(getPumpId())
  const [draft, setDraft] = useState<string>(getPumpId())

  /**
   * Применить введённое значение как активный pump_id.
   * После применения usePumpState автоматически перезапустит polling
   * с новым pump_id (через onPumpIdChange).
   */
  const apply = useCallback(() => {
    const trimmed = draft.trim()
    if (!trimmed) return
    setPumpId(trimmed)
    setPumpIdState(trimmed)
  }, [draft])

  const hasChanges = draft.trim() !== pumpId

  return { pumpId, draft, setDraft, apply, hasChanges }
}