import { useTelemetryScenarios } from '../hooks/useTelemetryScenarios'
import type { ScenarioInfo } from '../services/api/types'

export function TelemetryPage() {
  const {
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
    reload,
  } = useTelemetryScenarios()

  const currentName = currentScenario?.scenario_name ?? null

  const header = (
    <header className="pump-header">
      <div className="pump-header-info">
        <h1 className="pump-header-title">📈 Телеметрия</h1>
        <span className="pump-header-subtitle">
          Список сценариев для генерации уровня глюкозы
        </span>
      </div>
    </header>
  )

  // Первая загрузка
  if (isLoading) {
    return (
      <div className="pump-dashboard">
        {header}
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">Загрузка сценариев…</p>
          </div>
        </div>
      </div>
    )
  }

  // Ошибка загрузки
  if (loadError) {
    return (
      <div className="pump-dashboard">
        {header}
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">⚠️ {loadError}</p>
            <div className="mt-3">
              <button
                type="button"
                className="pump-btn pump-btn-primary"
                onClick={() => reload()}
              >
                Повторить
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pump-dashboard">
      {header}

      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">Сценарии телеметрии</h2>
          <button
            type="button"
            className="pump-btn pump-btn-outline"
            onClick={refresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        <div className="pump-card-body">
          {actionError && (
            <p className="settings-save-error" style={{ marginBottom: 12 }}>
              ⚠️ {actionError}
            </p>
          )}

          {scenarios.length === 0 ? (
            <div className="empty-state">Сценариев нет</div>
          ) : (
            <div className="scenarios-list">
              {scenarios.map(scenario => (
                <ScenarioItem
                  key={scenario.scenario_name}
                  scenario={scenario}
                  isCurrent={scenario.scenario_name === currentName}
                  isPending={
                    pendingScenario === scenario.scenario_name ||
                    (pendingScenario === '__stop__' &&
                      scenario.scenario_name === currentName)
                  }
                  onStart={() => handleStart(scenario.scenario_name)}
                  onStop={handleStop}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

interface ScenarioItemProps {
  scenario: ScenarioInfo
  isCurrent: boolean
  isPending: boolean
  onStart: () => void
  onStop: () => void
}

function ScenarioItem({
  scenario,
  isCurrent,
  isPending,
  onStart,
  onStop,
}: ScenarioItemProps) {
  return (
    <div className="scenario-item">
      <div className="scenario-item-info">
        <span className="scenario-item-name">{scenario.scenario_name}</span>
        <span className="scenario-item-description">{scenario.description}</span>
      </div>
      {isCurrent ? (
        <button
          type="button"
          className="pump-btn pump-btn-danger"
          onClick={onStop}
          disabled={isPending}
        >
          {isPending ? 'Остановка…' : 'Stop'}
        </button>
      ) : (
        <button
          type="button"
          className="pump-btn pump-btn-success"
          onClick={onStart}
          disabled={isPending}
        >
          {isPending ? 'Запуск…' : 'Play'}
        </button>
      )}
    </div>
  )
}