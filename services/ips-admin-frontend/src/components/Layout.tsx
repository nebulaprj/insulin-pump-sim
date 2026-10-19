import { Outlet, NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: '📊 Дашборд' },
  // Здесь будут добавлены другие разделы админки:
  // { to: '/users', label: '👥 Пользователи' },
  // { to: '/pumps', label: '💉 Помпы' },
  // { to: '/settings', label: '⚙️ Настройки' },
]

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-64 lg:min-h-screen bg-admin-surface lg:bg-slate-900 border-b lg:border-b-0 lg:border-r border-admin-border p-4 flex flex-col">
        {/* Заголовок */}
        <div className="flex items-start gap-2 text-xl font-bold mb-4 lg:mb-6 lg:text-white">
          <span className="flex-shrink-0">🛠️</span>
          <span>Админ-панель</span>
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
                    ? 'bg-admin-violet text-white'
                    : 'text-slate-600 hover:bg-slate-100 lg:text-slate-300 lg:hover:bg-slate-800'
                }`
              }
            >
              <span>{item.label}</span>
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