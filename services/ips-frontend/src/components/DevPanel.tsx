import { useState } from 'react'
import { sendTelemetry } from '../services/api/api'

/** Разрешает только цифры и одну десятичную точку. */
function isValidGlucoseInput(value: string): boolean {
  if (value === '') return true
  return /^\d*\.?\d*$/.test(value)
}

export function DevPanel() {
  const [glucoseValue, setGlucoseValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Запятую приводим к точке, разрешаем только цифры и одну точку
    const value = e.target.value.replace(',', '.')
    if (isValidGlucoseInput(value)) {
      setGlucoseValue(value)
      setSendResult(null)
    }
  }

  const handleSend = async () => {
    const value = parseFloat(glucoseValue)
    if (glucoseValue === '' || isNaN(value)) {
      setSendResult('Введите корректное число')
      return
    }

    setIsSending(true)
    setSendResult(null)
    try {
      await sendTelemetry(value)
      setSendResult('✓ Отправлено')
    } catch (err) {
      console.error('Failed to send telemetry:', err)
      setSendResult('Ошибка отправки')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="dev-panel">
      <div className="dev-panel-title">Devpanel</div>

      <input
        type="text"
        inputMode="decimal"
        className="dev-panel-input"
        placeholder="glucose_value"
        value={glucoseValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        aria-label="Значение глюкозы"
      />

      <button
        type="button"
        className="pump-btn pump-btn-primary dev-panel-btn"
        onClick={handleSend}
        disabled={isSending}
      >
        {isSending ? 'Отправка…' : 'Отправить'}
      </button>

      {sendResult && <div className="dev-panel-result">{sendResult}</div>}
    </div>
  )
}