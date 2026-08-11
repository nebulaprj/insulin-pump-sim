import { usePumpId } from '../hooks/usePumpId'

export function PumpHeader() {
  const { draft, setDraft, apply, hasChanges } = usePumpId()

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      apply()
    }
  }

  return (
    <header className="pump-header">
      <div className="pump-header-info">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold whitespace-nowrap">
            Название помпы:
          </span>
          <input
            type="text"
            className="px-2 py-1 rounded-lg border border-pump-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-pump-blue focus:border-transparent min-w-[180px]"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="например, student_ivanov"
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className="pump-btn pump-btn-primary"
            onClick={apply}
            disabled={!hasChanges}
          >
            Применить
          </button>
        </div>
      </div>
    </header>
  )
}