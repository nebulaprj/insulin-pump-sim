import { usePumpSettings } from '../hooks/usePumpSettings'
import type { ThresholdFields } from '../hooks/usePumpSettings'

/** Описание строк таблицы порогов. */
const THRESHOLD_ROWS: {
  label: string
  low: keyof ThresholdFields
  high: keyof ThresholdFields
}[] = [
  { label: 'Оповещение', low: 'notificationLow', high: 'notificationHigh' },
  { label: 'Предупреждение', low: 'warningLow', high: 'warningHigh' },
  { label: 'Критический', low: 'criticalLow', high: 'criticalHigh' },
]

/** Единица измерения для порогов глюкозы. */
const GLUCOSE_UNIT = 'ммоль/л'

export function SettingsPage() {
  const {
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
    reload,
  } = usePumpSettings()

  const header = (
    <header className="pump-header">
      <div className="pump-header-info">
        <h1 className="pump-header-title">⚙️ Настройки</h1>
        <span className="pump-header-subtitle">
          Параметры порогов безопасности
        </span>
      </div>
    </header>
  )

  // Состояние загрузки
  if (isLoading) {
    return (
      <div className="pump-dashboard">
        {header}
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">Загрузка настроек…</p>
          </div>
        </div>
      </div>
    )
  }

  // Ошибка загрузки
  if (loadError || !form) {
    return (
      <div className="pump-dashboard">
        {header}
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">
              ⚠️ {loadError ?? 'Не удалось загрузить настройки'}
            </p>
            <div className="mt-3">
              <button
                type="button"
                className="pump-btn pump-btn-primary"
                onClick={reload}
              >
                Повторить
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const basalError = fieldErrors?.basalRateLimit

  return (
    <div className="pump-dashboard">
      {header}

      {/* Пороги глюкозы */}
      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">Пороги глюкозы</h2>
          <span className="settings-range-hint">
            Допустимый диапазон: {range.min_level}–{range.max_level} {GLUCOSE_UNIT}
          </span>
        </div>
        <div className="pump-card-body">
          <div className="settings-thresholds">
            {THRESHOLD_ROWS.map(row => {
              const lowError = fieldErrors?.[row.low]
              const highError = fieldErrors?.[row.high]
              const lowInvalid = Boolean(lowError?.isEmpty || lowError?.isOutOfRange)
              const highInvalid = Boolean(highError?.isEmpty || highError?.isOutOfRange)

              return (
                <div key={row.label} className="settings-row">
                  <span className="settings-row-label">{row.label}:</span>
                  <div className="settings-row-inputs">
                    <label className="settings-input-group">
                      <span className="settings-input-caption">ниже</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`settings-input ${lowInvalid ? 'settings-input-error' : ''}`}
                        value={form.thresholds[row.low]}
                        onChange={e =>
                          handleThresholdChange(row.low, e.target.value)
                        }
                        placeholder="0.0"
                        aria-label={`${row.label}: ниже`}
                      />
                    </label>

                    <span className="settings-row-or">или</span>

                    <label className="settings-input-group">
                      <span className="settings-input-caption">выше</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={`settings-input ${highInvalid ? 'settings-input-error' : ''}`}
                        value={form.thresholds[row.high]}
                        onChange={e =>
                          handleThresholdChange(row.high, e.target.value)
                        }
                        placeholder="0.0"
                        aria-label={`${row.label}: выше`}
                      />
                    </label>

                    {/* Единица измерения в конце строки */}
                    <span className="settings-input-caption">{GLUCOSE_UNIT}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Лимиты подачи инсулина */}
      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">Лимиты подачи инсулина</h2>
          <span className="settings-range-hint">
            Допустимый диапазон: {range.min_basal}–{range.max_basal}%
          </span>
        </div>
        <div className="pump-card-body">
          <div className="settings-row">
            <span className="settings-row-label">Лимит базальной скорости:</span>
            <label className="settings-input-group">
              <input
                type="text"
                inputMode="numeric"
                className={`settings-input ${
                  basalError?.isEmpty || basalError?.isOutOfRange
                    ? 'settings-input-error'
                    : ''
                }`}
                value={form.basalRateLimit}
                onChange={e => handleBasalChange(e.target.value)}
                placeholder="0"
                aria-label="Лимит базальной скорости"
              />
              <span className="settings-input-caption">%</span>
            </label>
          </div>
        </div>
      </section>

      {/* Кнопки Сохранить / Отмена */}
      <div className="settings-actions">
        <button
          type="button"
          className="pump-btn pump-btn-primary"
          onClick={save}
          disabled={hasErrors || isSaving}
        >
          {isSaving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <button
          type="button"
          className="pump-btn pump-btn-outline"
          onClick={cancel}
          disabled={isSaving}
        >
          Отмена
        </button>
      </div>

      {/* Сообщение об ошибке сохранения (в т.ч. при 403) */}
      {saveError && <p className="settings-save-error">{saveError}</p>}
    </div>
  )
}