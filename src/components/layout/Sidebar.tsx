import { NavLink } from 'react-router-dom'
import { Pill, ShoppingCart, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
}

const NAV_ITEMS: NavItem[] = [{ label: 'New Bill', icon: ShoppingCart, path: '/billing' }]

// ── Component ─────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-slate-900 text-white transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* ── Logo & Pharmacy Name ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          <Pill size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">PharmaCare Pro</p>
            <p className="text-xs text-slate-400 truncate">Pharmacy Manager</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} className="flex-shrink-0" />
            {!collapsed && <span className="flex-1">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom Section: Settings + User + Collapse ── */}
      <div className="border-t border-slate-700 p-2 space-y-1">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{user.role_name}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs"
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
