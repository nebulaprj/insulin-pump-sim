import { GlucoseLevel } from '../services/api/types'

interface GlucoseDisplayProps {
  value: number | null
  unit: string
  level: GlucoseLevel | null
}

const LEVEL_LABELS: Record<GlucoseLevel, string> = {
  [GlucoseLevel.NORMAL]: 'Норма',
  [GlucoseLevel.LOW]: 'Низкий',
  [GlucoseLevel.HIGH]: 'Высокий',
}

const LEVEL_VALUE_CLASS: Record<GlucoseLevel, string> = {
  [GlucoseLevel.NORMAL]: 'glucose-value-normal',
  [GlucoseLevel.LOW]: 'glucose-value-low',
  [GlucoseLevel.HIGH]: 'glucose-value-high',
}

const LEVEL_BADGE_CLASS: Record<GlucoseLevel, string> = {
  [GlucoseLevel.NORMAL]: 'glucose-level-normal',
  [GlucoseLevel.LOW]: 'glucose-level-low',
  [GlucoseLevel.HIGH]: 'glucose-level-high',
}

export function GlucoseDisplay({ value, unit, level }: GlucoseDisplayProps) {
  const valueClass = level ? LEVEL_VALUE_CLASS[level] : 'glucose-value-normal'
  const badgeClass = level ? LEVEL_BADGE_CLASS[level] : 'glucose-level-normal'
  const label = level ? LEVEL_LABELS[level] : 'Нет данных'

  return (
    <section className="glucose-display" aria-label="Текущий уровень глюкозы">
      <span className="pump-card-title">Текущая глюкоза</span>

      <div className="glucose-value-row">
        <span className={`glucose-value ${valueClass}`}>
          {value !== null ? value.toFixed(1) : '--'}
        </span>
        <span className="glucose-unit">{unit}</span>
      </div>

      <span className={`glucose-level-label ${badgeClass}`}>{label}</span>
    </section>
  )
}