import { usePumpState } from '../hooks/usePumpState'
import { PumpHeader } from '../components/PumpHeader'
import { GlucoseDisplay } from '../components/GlucoseDisplay'
import { BolusPanel } from '../components/BolusPanel'
import { BasalRateCard } from '../components/BasalRateCard'
import { MessageFeed } from '../components/MessageFeed'

export function DashboardPage() {
  const {
    pumpState,
    hasLoaded,
    messages,
    deliverBolus,
    isDelivering,
    resetBolusBlock,
    isResettingBlock,
    resetBlockMessage,
  } = usePumpState()

  // До первой загрузки показываем экран загрузки.
  // Это убирает мигание мок-данных при доступном бэкенде.
  if (!hasLoaded) {
    return (
      <div className="pump-dashboard">
        <PumpHeader />
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">Загрузка состояния помпы…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pump-dashboard">
      <PumpHeader />

      {pumpState && (
        <div className="pump-grid">
          <div className="pump-grid-main">
            <GlucoseDisplay
              value={pumpState.current_glucose_value}
              unit="mmol/L"
              level={pumpState.glucose_level}
            />
            <MessageFeed messages={messages} />
          </div>

          <div className="pump-grid-side">
            <BolusPanel
              bolusStatus={pumpState.bolus_status}
              onDeliverBolus={deliverBolus}
              isDelivering={isDelivering}
              onResetBlock={resetBolusBlock}
              isResetting={isResettingBlock}
              resetBlockMessage={resetBlockMessage}
            />
            <BasalRateCard basalSpeedPc={pumpState.basal_speed_pc} />
          </div>
        </div>
      )}
    </div>
  )
}