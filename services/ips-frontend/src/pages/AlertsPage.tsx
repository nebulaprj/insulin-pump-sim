import { useAlertsContext } from '../context/AlertsContext'
import type { AlertResponse } from '../services/api/types'

/** Форматирует ISO-строку в вид dd-mm-yyyy hh-mm. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')

  return `${dd}-${mm}-${yyyy} ${hh}-${min}`
}

export function AlertsPage() {
  const {
    alerts,
    isLoadingAlerts,
    isClearing,
    alertsError,
    refreshAlerts,
    clearAlert,
    clearAllAlerts,
  } = useAlertsContext()

  // Разворачиваем список: последний элемент полученного списка сверху
  const reversedAlerts = [...alerts].reverse()

  return (
    <div className="pump-dashboard">
      <header className="pump-header">
        <div className="pump-header-info">
          <h1 className="pump-header-title">🔔 Тревоги</h1>
          <span className="pump-header-subtitle">Активные тревоги помпы</span>
        </div>
      </header>

      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">Активные тревоги</h2>
          <button
            type="button"
            className="pump-btn pump-btn-outline"
            onClick={refreshAlerts}
            disabled={isLoadingAlerts || isClearing}
          >
            {isLoadingAlerts ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        <div className="pump-card-body">
          {alertsError && (
            <p className="settings-save-error" style={{ marginBottom: 12 }}>
              ⚠️ {alertsError}
            </p>
          )}

          {isLoadingAlerts && alerts.length === 0 ? (
            <p className="pump-card-note">Загрузка тревог…</p>
          ) : reversedAlerts.length === 0 ? (
            <div className="empty-state">Активных тревог нет</div>
          ) : (
            <>
              <div className="alerts-list">
                {reversedAlerts.map((alert, index) => (
                  <AlertItem
                    key={`${alert.timestamp}-${index}`}
                    alert={alert}
                    isClearing={isClearing}
                    onClear={() => clearAlert(alert)}
                  />
                ))}
              </div>

              {/* Кнопка «Очистить все» с выравниванием по правому краю */}
              <div className="alerts-footer">
                <button
                  type="button"
                  className="pump-btn pump-btn-danger"
                  onClick={clearAllAlerts}
                  disabled={isClearing}
                >
                  {isClearing ? 'Очистка…' : 'Очистить все'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

interface AlertItemProps {
  alert: AlertResponse
  isClearing: boolean
  onClear: () => void
}

function AlertItem({ alert, isClearing, onClear }: AlertItemProps) {
  const formattedTimestamp = formatTimestamp(alert.timestamp)

  return (
    <div
      className="alert-item"
      // Данные тревоги зашиты в атрибуты веб-элемента
      data-alert-level={alert.level}
      data-alert-level-str={alert.level_str}
      data-alert-message={alert.message}
      data-alert-action-message={alert.action_message}
      data-alert-timestamp={alert.timestamp}
    >
      <div className="alert-item-info">
        <div className="alert-item-header">
          <span className="alert-item-level">{alert.level_str}</span>
          <span className="alert-item-timestamp">{formattedTimestamp}</span>
        </div>
        <span className="alert-item-message">Сообщение: {alert.message}</span>
        <span className="alert-item-action">Действия: {alert.action_message}</span>
      </div>

      <button
        type="button"
        className="alert-clear-btn"
        title="Очистить тревогу"
        aria-label="Очистить тревогу"
        onClick={onClear}
        disabled={isClearing}
      >
        ✕
      </button>
    </div>
  )
}