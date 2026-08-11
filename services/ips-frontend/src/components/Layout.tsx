import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: '📊 Панель управления' },
  { to: '/telemetry', label: '📈 Телеметрия' },
  { to: '/alerts', label: '🔔 Тревоги' },
  { to: '/settings', label: '⚙️ Настройки' },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 lg:min-h-screen bg-pump-surface lg:bg-slate-900 border-b lg:border-b-0 lg:border-r border-pump-border p-4">
        <div className="text-xl font-bold mb-4 lg:mb-6 lg:text-white">
          💉 Инсулиновая Помпа
        </div>
        <nav className="flex flex-row lg:flex-col gap-1 lg:gap-2 overflow-x-auto lg:overflow-x-visible">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg transition-colors whitespace-nowrap lg:whitespace-normal text-sm font-medium ${
                  isActive
                    ? 'bg-pump-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100 lg:text-slate-300 lg:hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}