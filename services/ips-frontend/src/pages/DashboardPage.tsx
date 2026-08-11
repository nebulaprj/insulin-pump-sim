import { usePumpState } from '../hooks/usePumpState'
import { PumpHeader } from '../components/PumpHeader'
import { GlucoseDisplay } from '../components/GlucoseDisplay'
import { BolusPanel } from '../components/BolusPanel'
import { BasalRateCard } from '../components/BasalRateCard'
import { MessageFeed } from '../components/MessageFeed'

export function DashboardPage() {
  const {
    pumpState,
    messages,
    deliverBolus,
    isDelivering,
    resetBolusBlock,
    isResettingBlock,
    resetBlockMessage,
    isLoading,
  } = usePumpState()

  return (
    <div className="pump-dashboard">
      <PumpHeader />

      {isLoading && (
        <div className="pump-card">
          <div className="pump-card-body">
            <p className="pump-card-note">Загрузка состояния помпы…</p>
          </div>
        </div>
      )}

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
    </div>
  )
}