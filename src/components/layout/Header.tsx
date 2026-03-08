import { Bell, Search } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
// Copilot: add notification bell badge from uiStore.notifications count
export function Header() {
  const { user } = useAuthStore()
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
      <div className="flex items-center gap-3 flex-1 max-w-sm">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input placeholder="Quick search... (Ctrl+K)"
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
          Press <kbd className="font-mono font-bold">F2</kbd> for New Bill
        </span>
        <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-touch min-w-touch flex items-center justify-center">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{user?.name?.charAt(0).toUpperCase() ?? "U"}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-800 leading-none">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{user?.role_name}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
