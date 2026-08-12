import { Outlet, NavLink } from 'react-router-dom'
import { useAlertsContext } from '../context/AlertsContext'
import { DevPanel } from './DevPanel'

const navItems = [
  { to: '/dashboard', label: '📊 Панель управления', showBadge: false },
  { to: '/telemetry', label: '📈 Телеметрия', showBadge: false },
  { to: '/alerts', label: '🔔 Тревоги', showBadge: true },
  { to: '/settings', label: '⚙️ Настройки', showBadge: false },
]

export function Layout() {
  const { alertsCount } = useAlertsContext()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 lg:min-h-screen bg-pump-surface lg:bg-slate-900 border-b lg:border-b-0 lg:border-r border-pump-border p-4 flex flex-col">
        {/* Заголовок */}
        <div className="flex items-start gap-2 text-xl font-bold mb-4 lg:mb-6 lg:text-white">
          <span className="flex-shrink-0">💉</span>
          <span>Инсулиновая Помпа</span>
        </div>

        {/* Навигация */}
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-2 overflow-x-auto lg:overflow-x-visible">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg transition-colors whitespace-nowrap lg:whitespace-normal text-sm font-medium flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-pump-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100 lg:text-slate-300 lg:hover:bg-slate-800'
                }`
              }
            >
              <span>{item.label}</span>
              {item.showBadge && alertsCount > 0 && (
                <span className="nav-badge">{alertsCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Панель разработчика */}
        <div className="lg:mt-auto lg:pt-4">
          <DevPanel />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}