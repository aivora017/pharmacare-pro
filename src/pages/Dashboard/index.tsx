/**
 * Dashboard — first screen after login.
 * Copilot: fetch real data from billingService.getTodaySummary(), inventoryService.getLowStock(), aiService.getMorningBriefing()
 * Add: MorningBriefing card, 7-day sales BarChart (recharts), at-risk customers list, recent bills
 */
import { ShoppingCart, Pill, AlertTriangle, TrendingUp, Plus, Barcode } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuthStore } from "@/store/authStore"

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  // TODO (Copilot): replace with real data
  const todaySales = 0, billCount = 0, lowStockCount = 0, expiryCount = 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Good morning, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-slate-500 text-sm mt-1">Here is what needs your attention today.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"New Bill", icon:<ShoppingCart size={28}/>, sub:"Press F2 anytime", path:"/billing", primary:true },
          { label:"Add Medicine", icon:<Plus size={28}/>, sub:"Update inventory", path:"/medicine", primary:false },
          { label:"Expiry Check", icon:<Barcode size={28}/>, sub:"Scan barcodes", path:"/expiry", primary:false },
        ].map(b => (
          <button key={b.label} onClick={() => navigate(b.path)}
            className={`flex flex-col items-center gap-2 rounded-xl p-5 transition-colors shadow-sm ${b.primary ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"}`}>
            <div className={b.primary ? "" : "text-blue-600"}>{b.icon}</div>
            <span className="font-semibold text-sm">{b.label}</span>
            <span className={`text-xs ${b.primary ? "text-blue-200" : "text-slate-400"}`}>{b.sub}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label:"Today Sales",  value:`₹${todaySales.toLocaleString("en-IN")}`, sub:`${billCount} bills`,     color:"green",  icon:<TrendingUp size={20}/> },
          { label:"Bills Today",  value:String(billCount),                         sub:"since opening",          color:"blue",   icon:<ShoppingCart size={20}/> },
          { label:"Low Stock",    value:String(lowStockCount),                     sub:"need reorder",           color: lowStockCount>0?"amber":"green", icon:<Pill size={20}/>, link:"/medicine" },
          { label:"Expiry Alerts",value:String(expiryCount),                       sub:"high risk batches",      color: expiryCount>0?"red":"green",     icon:<AlertTriangle size={20}/>, link:"/expiry" },
        ].map(s => (
          <div key={s.label} onClick={() => s.link && navigate(s.link)}
            className={`bg-white rounded-xl p-4 border border-slate-200 shadow-sm ${s.link ? "cursor-pointer hover:border-blue-300" : ""} transition-colors`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</span>
              <div className={`w-8 h-8 bg-${s.color}-50 rounded-lg flex items-center justify-center text-${s.color}-600`}>{s.icon}</div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
      {/* Copilot: Add MorningBriefing, SalesTrendChart, AtRiskCustomers, RecentBills below */}
    </div>
  )
}
