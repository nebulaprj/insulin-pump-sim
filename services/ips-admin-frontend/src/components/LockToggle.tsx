import { useState } from 'react'

export function LockToggle() {
  const [isLocked, setIsLocked] = useState(false)

  return (
    <label className="lock-toggle">
      <input
        type="checkbox"
        className="lock-toggle-input"
        checked={isLocked}
        onChange={() => setIsLocked(!isLocked)}
        aria-label="Блокировка"
      />
      <span className="lock-toggle-track">
        <span className="lock-toggle-thumb" />
      </span>
      <span className="lock-toggle-label">
        {isLocked ? 'Заблокировано' : 'Блокировка'}
      </span>
    </label>
  )
}