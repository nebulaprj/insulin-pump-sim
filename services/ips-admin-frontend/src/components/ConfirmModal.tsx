interface ConfirmModalProps {
  isOpen: boolean
  title: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  isOpen,
  title,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <p className="modal-title">{title}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="admin-btn admin-btn-danger"
            onClick={onConfirm}
          >
            Да
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-outline"
            onClick={onCancel}
          >
            Нет
          </button>
        </div>
      </div>
    </div>
  )
}