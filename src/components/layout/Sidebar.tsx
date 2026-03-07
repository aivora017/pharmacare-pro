/**
 * PharmaCare Pro — Sidebar Navigation
 *
 * The left sidebar with navigation links.
 * Design: Clean, icon + label, active state highlighted, grouped by function.
 * Non-IT users: Icons are large and labelled clearly in plain English.
 *
 * Copilot Instructions:
 * - Each nav item has an icon (Lucide), a label, and a route path
 * - Items are grouped into logical sections
 * - Active route is highlighted in blue
 * - Sidebar collapses to icon-only on small screens
 * - Show a badge count on items that have alerts (e.g., low stock count)
 * - Permission-based: hide items the current user can't access
 */

import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Pill, Package, Users, Stethoscope,
  Truck, AlertTriangle, Barcode, BarChart3, Bot, Settings,
  ChevronLeft, ChevronRight, LogOut, Building2
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────

interface NavItem {
  label: string           // Plain English label (clear for non-IT users)
  icon: React.ElementType
  path: string
  permission?: string     // Permission key required to show this item
  badge?: number          // Alert count to show as a badge
  badgeColor?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

// ── Nav Configuration ─────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard',     icon: LayoutDashboard, path: '/dashboard' },
      { label: 'New Bill',      icon: ShoppingCart,    path: '/billing',   permission: 'billing' },
    ],
  },
  {
    title: 'Stock & Medicines',
    items: [
      { label: 'Medicines',     icon: Pill,            path: '/medicine',  permission: 'medicine' },
      { label: 'Purchase Bills',icon: Package,         path: '/purchase',  permission: 'purchase' },
      { label: 'Suppliers',     icon: Truck,           path: '/suppliers', permission: 'purchase' },
      { label: 'Expiry Check',  icon: AlertTriangle,   path: '/expiry',    permission: 'expiry' },
      { label: 'Barcodes',      icon: Barcode,         path: '/barcodes',  permission: 'barcodes' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Customers',     icon: Users,           path: '/customers', permission: 'customers' },
      { label: 'Doctors',       icon: Stethoscope,     path: '/doctors',   permission: 'customers' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Reports',       icon: BarChart3,       path: '/reports',   permission: 'reports' },
      { label: 'AI Assistant',  icon: Bot,             path: '/ai',        permission: 'ai' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  const { hasPermission } = usePermission()
  const location = useLocation()

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

      {/* ── Navigation Items ── */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {NAV_GROUPS.map((group) => {
          // Filter items by permission
          const visibleItems = group.items.filter(
            (item) => !item.permission || hasPermission(item.permission)
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.title} className="mb-4">
              {/* Group title — hidden when collapsed */}
              {!collapsed && (
                <p className="text-xs font-semibold text-slate-500 uppercase px-3 mb-2 tracking-wider">
                  {group.title}
                </p>
              )}

              {visibleItems.map((item) => (
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
                  title={collapsed ? item.label : undefined}  // Tooltip when collapsed
                >
                  <item.icon size={18} className="flex-shrink-0" />

                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {/* Alert badge — e.g., "3 items expiring" */}
                      {item.badge && item.badge > 0 && (
                        <span className={clsx(
                          'text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center',
                          item.badgeColor || 'bg-red-500 text-white'
                        )}>
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* ── Bottom Section: Settings + User + Collapse ── */}
      <div className="border-t border-slate-700 p-2 space-y-1">

        {/* Settings */}
        {hasPermission('settings') && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
            title={collapsed ? 'Settings' : undefined}
          >
            <Settings size={18} className="flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        )}

        {/* Logged-in user info */}
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

        {/* Collapse toggle */}
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
