import { useState } from 'react'
import { useScenarios } from '../hooks/useScenarios'

interface CreateGeneratorBlockProps {
  onStart: (scenarioName: string, pumpId: string) => Promise<void>
}

export function CreateGeneratorBlock({ onStart }: CreateGeneratorBlockProps) {
  const { scenarios, isLoading, loadError, reload } = useScenarios()

  const [pumpId, setPumpId] = useState('')
  const [selectedScenario, setSelectedScenario] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  const canStart =
    pumpId.trim() !== '' && selectedScenario !== '' && !isStarting

  const handleStart = async () => {
    if (!canStart) return

    setIsStarting(true)
    try {
      await onStart(selectedScenario, pumpId.trim())
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Создание генератора</h2>
        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={reload}
          disabled={isLoading}
        >
          {isLoading ? 'Обновление…' : 'Обновить сценарии'}
        </button>
      </div>

      <div className="admin-card-body">
        {loadError && (
          <p className="admin-card-note" style={{ marginBottom: 12 }}>
            ⚠️ {loadError}
          </p>
        )}

        <div className="create-generator-form">
          {/* Поле ввода pump_id */}
          <input
            type="text"
            className="create-generator-input"
            placeholder="pump_id"
            value={pumpId}
            onChange={e => setPumpId(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-label="Идентификатор помпы"
          />

          {/* Дропбокс со сценариями */}
          <select
            className="create-generator-select"
            value={selectedScenario}
            onChange={e => setSelectedScenario(e.target.value)}
            disabled={isLoading}
            aria-label="Выбор сценария"
          >
            <option value="">
              {isLoading ? 'Загрузка сценариев…' : 'Выберите сценарий'}
            </option>
            {scenarios.map(scenario => (
              <option
                key={scenario.scenario_name}
                value={scenario.scenario_name}
              >
                {scenario.scenario_name}
              </option>
            ))}
          </select>

          {/* Кнопка Старт: квадратная с иконкой Play, как в списке генераторов */}
          <button
            type="button"
            className="generator-control-btn generator-control-btn-play"
            title="Старт"
            aria-label="Запустить генератор"
            onClick={handleStart}
            disabled={!canStart}
          >
            ▶
          </button>
        </div>
      </div>
    </section>
  )
}