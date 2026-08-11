export function AlertsPage() {
  return (
    <div className="pump-dashboard">
      <header className="pump-header">
        <div className="pump-header-info">
          <h1 className="pump-header-title">🔔 Тревоги</h1>
          <span className="pump-header-subtitle">
            Активные и исторические тревоги помпы
          </span>
        </div>
      </header>

      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">Активные тревоги</h2>
        </div>
        <div className="empty-state">
          Здесь будет список активных тревог с кнопками подтверждения.
        </div>
      </section>

      <section className="pump-card">
        <div className="pump-card-header">
          <h2 className="pump-card-title">История тревог</h2>
        </div>
        <div className="empty-state">
          Здесь будет таблица разрешённых тревог с фильтрами по серьёзности и
          дате.
        </div>
      </section>
    </div>
  )
}