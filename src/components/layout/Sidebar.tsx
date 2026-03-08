/**
 * Sidebar navigation — big icons + clear labels for non-IT users.
 * Copilot: add alert badge counts from inventoryService.getLowStock() and aiService.getExpiryRisks()
 */
import { NavLink } from "react-router-dom"
import { LayoutDashboard, ShoppingCart, Pill, Package, Users,
  Stethoscope, Truck, AlertTriangle, Barcode, BarChart3,
  Bot, Settings, ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { useState } from "react"
import { useAuthStore } from "@/store/authStore"
import clsx from "clsx"

const NAV = [
  { section: "Daily Work", items: [
    { label:"Dashboard",      icon:LayoutDashboard, path:"/dashboard" },
    { label:"New Bill",       icon:ShoppingCart,    path:"/billing",  shortcut:"F2" },
  ]},
  { section: "Stock & Orders", items: [
    { label:"Medicines",      icon:Pill,            path:"/medicine" },
    { label:"Purchase Bills", icon:Package,         path:"/purchase" },
    { label:"Suppliers",      icon:Truck,           path:"/suppliers" },
    { label:"Expiry Check",   icon:AlertTriangle,   path:"/expiry" },
    { label:"Barcodes",       icon:Barcode,         path:"/barcodes" },
  ]},
  { section: "People", items: [
    { label:"Customers",      icon:Users,           path:"/customers" },
    { label:"Doctors",        icon:Stethoscope,     path:"/doctors" },
  ]},
  { section: "Insights", items: [
    { label:"Reports",        icon:BarChart3,       path:"/reports" },
    { label:"AI Assistant",   icon:Bot,             path:"/ai" },
  ]},
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()
  return (
    <aside className={clsx("flex flex-col h-screen bg-slate-900 text-white flex-shrink-0 transition-all duration-200", collapsed ? "w-16" : "w-56")}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Pill size={16} className="text-white" />
        </div>
        {!collapsed && <div>
          <p className="text-sm font-bold text-white leading-none">PharmaCare Pro</p>
          <p className="text-xs text-slate-400 mt-0.5">Pharmacy Manager</p>
        </div>}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map(g => (
          <div key={g.section} className="mb-3">
            {!collapsed && <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 mb-1">{g.section}</p>}
            {g.items.map(item => (
              <NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined}
                className={({ isActive }) => clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5",
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}>
                <item.icon size={17} className="flex-shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!collapsed && "shortcut" in item && <kbd className="text-xs text-slate-500 font-mono">{(item as {shortcut:string}).shortcut}</kbd>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-700 p-2 space-y-1 flex-shrink-0">
        <NavLink to="/settings" title={collapsed ? "Settings" : undefined}
          className={({ isActive }) => clsx("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white")}>
          <Settings size={17} className="flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
        {!collapsed && user && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold">{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize truncate">{user.role_name}</p>
            </div>
            <button onClick={logout} title="Logout" className="text-slate-400 hover:text-red-400 transition-colors"><LogOut size={14} /></button>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-xs">
          {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
