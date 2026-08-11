interface BasalRateCardProps {
  basalSpeedPc: number | null
}

export function BasalRateCard({ basalSpeedPc }: BasalRateCardProps) {
  const value = basalSpeedPc ?? 0
  // Базал может достигать 300% от профиля (user_max_basal_limit / hardware).
  // Шкала растягивается на 0–300%, чтобы видеть превышение 100%.
  const progressWidth = Math.min(Math.max(value, 0) / 3, 100)

  return (
    <section className="pump-card" aria-label="Базальная скорость">
      <div className="pump-card-header">
        <h2 className="pump-card-title">Базальная скорость</h2>
      </div>

      <div className="pump-card-body">
        <div className="basal-value-row">
          <span className="basal-value">{value}</span>
          <span className="basal-unit">%</span>
        </div>

        <div
          className="basal-progress"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={300}
        >
          <div
            className="basal-progress-bar"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <p className="pump-card-note" style={{ marginTop: 12 }}>
          Относительно штатного профиля подачи
        </p>
      </div>
    </section>
  )
}