import { BolusStatus } from '../services/api/types'
import { StatusBadge } from './StatusBadge'
import type { StatusBadgeVariant } from './StatusBadge'

interface BolusPanelProps {
  bolusStatus: BolusStatus | null
  onDeliverBolus: () => void
  isDelivering: boolean
  onResetBlock: () => void
  isResetting: boolean
  resetBlockMessage: string | null
}

const STATUS_META: Record<
  BolusStatus,
  { label: string; variant: StatusBadgeVariant }
> = {
  [BolusStatus.ALLOWED]: { label: 'Разрешён', variant: 'allowed' },
  [BolusStatus.WITH_WARNING]: { label: 'С предупреждением', variant: 'warning' },
  [BolusStatus.BLOCKED]: { label: 'Заблокирован', variant: 'blocked' },
  [BolusStatus.SUSPENDED]: { label: 'Приостановлен', variant: 'suspended' },
  [BolusStatus.LIMIT_CHECK]: { label: 'Проверка лимита', variant: 'warning' },
  [BolusStatus.PUMP_OFF]: { label: 'Помпа выключена', variant: 'off' },
}

const DEFAULT_RESET_MESSAGE = 'Требуется ручная разблокировка'

export function BolusPanel({
  bolusStatus,
  onDeliverBolus,
  isDelivering,
  onResetBlock,
  isResetting,
  resetBlockMessage,
}: BolusPanelProps) {
  const meta = bolusStatus ? STATUS_META[bolusStatus] : null
  const isBlocked = bolusStatus === BolusStatus.BLOCKED
  const canDeliverBolus = !isBlocked

  // Если сообщение не задано (первое появление блокировки) — показываем дефолт.
  // Если задано (после неудачной разблокировки) — показываем его.
  const displayResetMessage = resetBlockMessage ?? DEFAULT_RESET_MESSAGE

  return (
    <section className="pump-card" aria-label="Состояние болюса">
      <div className="pump-card-header">
        <h2 className="pump-card-title">Болюс</h2>
        {meta && <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>}
      </div>

      <div className="pump-card-body">
        <div className="flex flex-col gap-3">
          {/* Кнопка "Ввести болюс" */}
          <button
            type="button"
            className="pump-btn pump-btn-success pump-btn-full"
            onClick={onDeliverBolus}
            disabled={!canDeliverBolus || isDelivering}
          >
            {isDelivering ? 'Введение болюса…' : 'Ввести болюс'}
          </button>

          {/* Если bolus_status === blocked: кнопка разблокировки + сообщение */}
          {isBlocked && (
            <>
              <button
                type="button"
                className="pump-btn pump-btn-danger pump-btn-full"
                onClick={onResetBlock}
                disabled={isResetting}
              >
                {isResetting ? 'Снятие блокировки…' : 'Снять блокировку болюса'}
              </button>
              <p className="text-sm text-pump-red-dark text-center m-0">
                {displayResetMessage}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}