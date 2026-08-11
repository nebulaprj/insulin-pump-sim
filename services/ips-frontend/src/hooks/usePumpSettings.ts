import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { onPumpIdChange } from '../config/pump'
import { getSettings, saveSettings } from '../services/api/api'
import type {
  SettingsResponse,
  SettingsRange,
  SettingsRequest,
} from '../services/api/types'

const DEFAULT_RANGE: SettingsRange = {
  min_level: 2.0,
  max_level: 20.0,
  min_basal: 100,
  max_basal: 350,
}

/** Значения полей порогов глюкозы (строки, т.к. это контролируемые инпуты). */
export interface ThresholdFields {
  notificationLow: string
  notificationHigh: string
  warningLow: string
  warningHigh: string
  criticalLow: string
  criticalHigh: string
}

/** Состояние формы настроек. */
export interface SettingsFormState {
  thresholds: ThresholdFields
  basalRateLimit: string
}

/** Результат валидации одного поля. */
export interface FieldValidation {
  isEmpty: boolean
  isOutOfRange: boolean
}

/** Дробное число с не более чем 1 знаком после запятой. */
function isValidDecimalOnePlace(value: string): boolean {
  if (value === '') return true
  return /^\d*\.?\d{0,1}$/.test(value)
}

/** Целое неотрицательное число. */
function isValidInteger(value: string): boolean {
  if (value === '') return true
  return /^\d*$/.test(value)
}

/** Проверка дробного поля на пустоту и выход за диапазон. */
function validateDecimalField(
  value: string,
  min: number,
  max: number,
): FieldValidation {
  if (value === '') return { isEmpty: true, isOutOfRange: false }
  const num = parseFloat(value)
  if (isNaN(num)) return { isEmpty: true, isOutOfRange: false }
  return { isEmpty: false, isOutOfRange: num < min || num > max }
}

/** Проверка целого поля на пустоту и выход за диапазон. */
function validateIntegerField(
  value: string,
  min: number,
  max: number,
): FieldValidation {
  if (value === '') return { isEmpty: true, isOutOfRange: false }
  const num = parseInt(value, 10)
  if (isNaN(num)) return { isEmpty: true, isOutOfRange: false }
  return { isEmpty: false, isOutOfRange: num < min || num > max }
}

/**
 * Форматирует значение порога глюкозы: всегда один знак после запятой.
 * 10 → "10.0", 4.5 → "4.5", 2.8 → "2.8".
 */
function formatGlucoseValue(value: number): string {
  return value.toFixed(1)
}

/** Маппинг ответа бэкенда в форму (числа → строки). */
function responseToForm(data: SettingsResponse): SettingsFormState {
  return {
    thresholds: {
      notificationLow: formatGlucoseValue(data.low_notification_level),
      notificationHigh: formatGlucoseValue(data.high_notification_level),
      warningLow: formatGlucoseValue(data.low_warning_level),
      warningHigh: formatGlucoseValue(data.high_warning_level),
      criticalLow: formatGlucoseValue(data.low_critical_level),
      criticalHigh: formatGlucoseValue(data.high_critical_level),
    },
    // Лимит базальной скорости — целое число, без десятичной части
    basalRateLimit: String(data.user_max_basal_limit),
  }
}

/** Маппинг формы в тело запроса (строки → числа). null, если что-то не парсится. */
function formToRequest(form: SettingsFormState): SettingsRequest | null {
  const parseDecimal = (v: string): number | null => {
    const n = parseFloat(v)
    return isNaN(n) ? null : n
  }
  const parseInteger = (v: string): number | null => {
    const n = parseInt(v, 10)
    return isNaN(n) ? null : n
  }

  const lowNotification = parseDecimal(form.thresholds.notificationLow)
  const highNotification = parseDecimal(form.thresholds.notificationHigh)
  const lowWarning = parseDecimal(form.thresholds.warningLow)
  const highWarning = parseDecimal(form.thresholds.warningHigh)
  const lowCritical = parseDecimal(form.thresholds.criticalLow)
  const highCritical = parseDecimal(form.thresholds.criticalHigh)
  const basal = parseInteger(form.basalRateLimit)

  if (
    lowNotification === null ||
    highNotification === null ||
    lowWarning === null ||
    highWarning === null ||
    lowCritical === null ||
    highCritical === null ||
    basal === null
  ) {
    return null
  }

  return {
    low_notification_level: lowNotification,
    high_notification_level: highNotification,
    low_warning_level: lowWarning,
    high_warning_level: highWarning,
    low_critical_level: lowCritical,
    high_critical_level: highCritical,
    user_max_basal_limit: basal,
  }
}

export function usePumpSettings() {
  const [range, setRange] = useState<SettingsRange>(DEFAULT_RANGE)
  const [form, setForm] = useState<SettingsFormState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Последнее применённое состояние (для кнопки «Отмена»)
  const appliedFormRef = useRef<SettingsFormState | null>(null)

  /** Загрузить настройки с бэкенда и заполнить форму. */
  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await getSettings()
      const formState = responseToForm(data)
      setForm(formState)
      appliedFormRef.current = formState
      setRange(data.range ?? DEFAULT_RANGE)
      setSaveError(null)
    } catch (err) {
      console.error('Failed to load settings:', err)
      setLoadError('Не удалось загрузить настройки')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Загрузка при монтировании и при смене pump_id
  useEffect(() => {
    loadSettings()
    const unsubscribe = onPumpIdChange(() => {
      loadSettings()
    })
    return unsubscribe
  }, [loadSettings])

  /** Изменение поля порога глюкозы (дробные, ≤ 1 знака). */
  const handleThresholdChange = useCallback(
    (key: keyof ThresholdFields, rawValue: string) => {
      const value = rawValue.replace(',', '.')
      if (isValidDecimalOnePlace(value)) {
        setForm(prev =>
          prev
            ? { ...prev, thresholds: { ...prev.thresholds, [key]: value } }
            : prev,
        )
      }
    },
    [],
  )

  /** Изменение поля лимита базальной скорости (только целые). */
  const handleBasalChange = useCallback((rawValue: string) => {
    if (isValidInteger(rawValue)) {
      setForm(prev => (prev ? { ...prev, basalRateLimit: rawValue } : prev))
    }
  }, [])

  /** Валидация всех полей по диапазонам из range. */
  const fieldErrors = useMemo(() => {
    if (!form) return null
    return {
      notificationLow: validateDecimalField(
        form.thresholds.notificationLow,
        range.min_level,
        range.max_level,
      ),
      notificationHigh: validateDecimalField(
        form.thresholds.notificationHigh,
        range.min_level,
        range.max_level,
      ),
      warningLow: validateDecimalField(
        form.thresholds.warningLow,
        range.min_level,
        range.max_level,
      ),
      warningHigh: validateDecimalField(
        form.thresholds.warningHigh,
        range.min_level,
        range.max_level,
      ),
      criticalLow: validateDecimalField(
        form.thresholds.criticalLow,
        range.min_level,
        range.max_level,
      ),
      criticalHigh: validateDecimalField(
        form.thresholds.criticalHigh,
        range.min_level,
        range.max_level,
      ),
      basalRateLimit: validateIntegerField(
        form.basalRateLimit,
        range.min_basal,
        range.max_basal,
      ),
    }
  }, [form, range])

  /** Есть ли хотя бы одно пустое или вышедшее за диапазон поле. */
  const hasErrors = useMemo(() => {
    if (!fieldErrors) return true
    return Object.values(fieldErrors).some(
      e => e.isEmpty || e.isOutOfRange,
    )
  }, [fieldErrors])

  /** Сохранить настройки. Применяет ответ бэкенда (200 или 403) в поля. */
  const save = useCallback(async () => {
    if (!form) return
    const request = formToRequest(form)
    if (!request) return

    setIsSaving(true)
    setSaveError(null)
    try {
      const { data, status } = await saveSettings(request)

      // Применяем значения из ответа в поля независимо от статуса (200 или 403)
      const formState = responseToForm(data)
      setForm(formState)
      appliedFormRef.current = formState
      if (data.range) {
        setRange(data.range)
      }

      if (status === 403) {
        setSaveError('Некорректные значения настроек')
      }
    } catch (err) {
      console.error('Failed to save settings:', err)
      setSaveError('Ошибка связи с бэкендом при сохранении настроек')
    } finally {
      setIsSaving(false)
    }
  }, [form])

  /** Отмена: вернуть поля к последнему применённому состоянию. */
  const cancel = useCallback(() => {
    if (appliedFormRef.current) {
      setForm(appliedFormRef.current)
    }
    setSaveError(null)
  }, [])

  return {
    form,
    range,
    isLoading,
    isSaving,
    saveError,
    loadError,
    fieldErrors,
    hasErrors,
    handleThresholdChange,
    handleBasalChange,
    save,
    cancel,
    reload: loadSettings,
  }
}