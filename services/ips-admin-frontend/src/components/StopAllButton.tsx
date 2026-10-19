import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'

interface StopAllButtonProps {
  onStopAll: () => Promise<void>
  isStoppingAll: boolean
}

export function StopAllButton({
  onStopAll,
  isStoppingAll,
}: StopAllButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClick = () => setIsModalOpen(true)

  const handleConfirm = () => {
    setIsModalOpen(false)
    onStopAll()
  }

  const handleCancel = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="generator-control-btn generator-control-btn-stop"
        title="Остановить все генераторы"
        aria-label="Остановить все генераторы"
        onClick={handleClick}
        disabled={isStoppingAll}
      >
        ■
      </button>

      <ConfirmModal
        isOpen={isModalOpen}
        title="Остановить все генераторы?"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  )
}