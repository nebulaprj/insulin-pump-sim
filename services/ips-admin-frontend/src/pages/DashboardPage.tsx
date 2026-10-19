import { memo, useState } from 'react'
import { useGenerators } from '../hooks/useGenerators'
import type { StatusFilter, SortField } from '../hooks/useGenerators'
import type { GeneratorInfo } from '../services/api/types'
import { CreateGeneratorBlock } from '../components/CreateGeneratorBlock'
import { LockToggle } from '../components/LockToggle'
import { StopAllButton } from '../components/StopAllButton'

export function DashboardPage() {
  const {
    generators,
    total,
    running,
    isLoading,
    loadError,
    pendingAction,
    actionError,
    isStoppingAll,
    statusFilter,
    setStatusFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    reload,
    startScenario,
    stopScenario,
    stopAllGenerators,
  } = useGenerators()

  // Состояние для поля ввода лимита генераторов
  const [limitValue, setLimitValue] = useState('')

  /** Обработчик ввода лимита: принимает только положительные целые числа. */
  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (/^\d*$/.test(value)) {
      setLimitValue(value)
    }
  }

  return (
    <div className="admin-dashboard">
      {/* Заголовок с тогглом блокировки и кнопкой остановки справа */}
      <header className="admin-header">
        <div className="flex flex-col">
          <h1 className="admin-header-title">🛠️ Админ-панель</h1>
          <span className="admin-header-subtitle">
            Управление системой «Инсулиновая Помпа»
          </span>
        </div>

        {/* Тоггл блокировки + кнопка остановки всех генераторов */}
        <div className="header-actions">
          <LockToggle />
          <StopAllButton
            onStopAll={stopAllGenerators}
            isStoppingAll={isStoppingAll}
          />
        </div>
      </header>

      {/* Блок «Создание генератора» на всю ширину */}
      <CreateGeneratorBlock onStart={startScenario} />

      {/* Блок «Генераторы телеметрии» */}
      <section className="admin-card">
        <div className="admin-card-header">
          {/* Левая группа: название + контрол лимита */}
          <div className="flex items-center">
            <h2 className="admin-card-title">Генераторы телеметрии</h2>

            {/* Контрол лимита: поле ввода + кнопка «Лимит» (компактный gap) */}
            <div className="flex items-center gap-2 ml-4">
              <input
                type="text"
                inputMode="numeric"
                className="limit-input"
                placeholder="0"
                value={limitValue}
                onChange={handleLimitChange}
                spellCheck={false}
                autoComplete="off"
                aria-label="Лимит генераторов"
              />
              <button
                type="button"
                className="admin-btn admin-btn-outline limit-btn"
                onClick={() => {
                  // Пока ничего не происходит
                }}
              >
                Лимит
              </button>
            </div>
          </div>

          {/* Кнопка «Обновить» справа */}
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={reload}
            disabled={isLoading}
          >
            {isLoading ? 'Обновление…' : 'Обновить'}
          </button>
        </div>

        <div className="admin-card-body">
          {/* Панель фильтров, сортировки и поиска */}
          <div className="filters-panel">
            <input
              type="text"
              className="search-input"
              placeholder="Поиск по pump_id…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />

            <select
              className="filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="Фильтр по статусу"
            >
              <option value="all">Все статусы</option>
              <option value="running">Запущенные</option>
              <option value="stopped">Остановленные</option>
            </select>

            <select
              className="filter-select"
              value={sortField}
              onChange={e => setSortField(e.target.value as SortField)}
              aria-label="Сортировка"
            >
              <option value="pump_id">По названию помпы</option>
              <option value="scenario_name">По названию сценария</option>
              <option value="status">По статусу</option>
            </select>

            <button
              type="button"
              className="admin-btn admin-btn-outline sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
              aria-label="Направление сортировки"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Краткая статистика */}
          <div className="generators-stats">
            Всего генераторов: <strong>{total}</strong> · Запущено:{' '}
            <strong>{running}</strong>
          </div>

          {/* Сообщение об ошибке загрузки */}
          {loadError && (
            <p className="admin-card-note" style={{ marginBottom: 12 }}>
              ⚠️ {loadError}
            </p>
          )}

          {/* Сообщение об ошибке действий */}
          {actionError && (
            <p className="admin-card-note" style={{ marginBottom: 12 }}>
              ⚠️ {actionError}
            </p>
          )}

          {/* Список генераторов */}
          {isLoading && generators.length === 0 ? (
            <p className="admin-card-note">Загрузка генераторов…</p>
          ) : generators.length === 0 ? (
            <div className="empty-state">Генераторов нет</div>
          ) : (
            <div className="generator-list">
              {generators.map(generator => (
                <GeneratorItem
                  key={generator.pump_id}
                  generator={generator}
                  isPending={pendingAction === generator.pump_id}
                  onStart={startScenario}
                  onStop={stopScenario}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

interface GeneratorItemProps {
  generator: GeneratorInfo
  isPending: boolean
  onStart: (scenarioName: string, pumpId: string) => void
  onStop: (pumpId: string) => void
}

const GeneratorItem = memo(
  function GeneratorItem({
    generator,
    isPending,
    onStart,
    onStop,
  }: GeneratorItemProps) {
    const scenarioName = generator.scenario_name || '—'

    return (
      <div className="generator-item">
        <div className="generator-item-info">
          <span className="generator-item-pump">{generator.pump_id}</span>
          <span className="generator-item-separator">:</span>
          <span className="generator-item-scenario">{scenarioName}</span>
        </div>

        {generator.is_running ? (
          <button
            type="button"
            className="generator-control-btn generator-control-btn-stop"
            title="Остановить"
            aria-label="Остановить генератор"
            onClick={() => onStop(generator.pump_id)}
            disabled={isPending}
          >
            ■
          </button>
        ) : (
          <button
            type="button"
            className="generator-control-btn generator-control-btn-play"
            title="Запустить"
            aria-label="Запустить генератор"
            onClick={() => onStart(generator.scenario_name, generator.pump_id)}
            disabled={isPending}
          >
            ▶
          </button>
        )}
      </div>
    )
  },
  (prevProps, nextProps) =>
    prevProps.generator.pump_id === nextProps.generator.pump_id &&
    prevProps.generator.scenario_name === nextProps.generator.scenario_name &&
    prevProps.generator.is_running === nextProps.generator.is_running &&
    prevProps.isPending === nextProps.isPending,
)