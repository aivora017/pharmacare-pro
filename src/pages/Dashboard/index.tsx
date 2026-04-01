import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TrendingUp, ShoppingCart, Pill, AlertTriangle, Users, ArrowRight, Plus, BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import toast from "react-hot-toast"
import { useAuthStore } from "@/store/authStore"
import { dashboardService } from "@/services/dashboardService"
import { aiService } from "@/services/aiService"
import { formatCompact, formatCurrency } from "@/utils/currency"
import { Spinner } from "@/components/shared/Spinner"
import { LicenceAlertBanner } from "./LicenceAlertBanner"

interface Summary {
  today: { revenue: number; bill_count: number; avg_bill_value: number }
  alerts: { low_stock: number; expiry_alerts: number; outstanding_customers: number }
  sales_trend: { date: string; revenue: number; bills: number }[]
  payment_split: { mode: string; amount: number }[]
}

export default function DashboardPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [data,     setData]     = useState<Summary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [briefing, setBriefing] = useState<{ priority: string; message: string; link?: string }[]>([])

  useEffect(() => {
    dashboardService.getSummary()
      .then(d => setData(d as Summary))
      .catch(() => toast.error("Could not load dashboard."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Morning briefing — non-blocking, silently fails if DB not ready
    aiService.morningBriefing()
      .then(b => setBriefing(b.actions.filter(a => a.priority === "urgent" || a.priority === "important")))
      .catch(() => { /* silent — DB may not have data yet */ })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  const { today, alerts, sales_trend: trend = [], payment_split: payments = [] } =
    data ?? { today: { revenue: 0, bill_count: 0, avg_bill_value: 0 }, alerts: { low_stock: 0, expiry_alerts: 0, outstanding_customers: 0 } }

  const icons: Record<string, string>  = { cash: "💵", upi: "📱", card: "💳", credit: "📒", cheque: "🏦" }
  const payColors: Record<string, string> = {
    cash:   "bg-green-50 text-green-700",
    upi:    "bg-blue-50 text-blue-700",
    card:   "bg-purple-50 text-purple-700",
    credit: "bg-amber-50 text-amber-700",
    cheque: "bg-slate-50 text-slate-700",
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <LicenceAlertBanner />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good morning, {user?.name?.split(" ")[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here's what needs your attention today.</p>
        </div>
        <div className="text-sm text-slate-400">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Morning briefing alerts */}
      {briefing.length > 0 && (
        <div className="space-y-2">
          {briefing.map((a, i) => (
            <button key={i} onClick={() => a.link && navigate(a.link)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors
                ${a.priority === "urgent"
                  ? "bg-red-50 border-red-200 hover:bg-red-100"
                  : "bg-amber-50 border-amber-200 hover:bg-amber-100"}`}>
              <span className="text-lg">{a.priority === "urgent" ? "⚠" : "⏰"}</span>
              <span className={`text-sm font-medium flex-1
                ${a.priority === "urgent" ? "text-red-800" : "text-amber-800"}`}>
                {a.message}
              </span>
              <ArrowRight size={14} className={a.priority === "urgent" ? "text-red-400" : "text-amber-400"} />
            </button>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "New Bill",      sub: "F2",           icon: ShoppingCart, path: "/billing",  primary: true  },
          { label: "Add Medicine",  sub: "Update stock", icon: Plus,         path: "/medicine", primary: false },
          { label: "Expiry Check",  sub: "Scan batches", icon: AlertTriangle,path: "/expiry",   primary: false },
          { label: "Reports",       sub: "View analytics",icon: BarChart3,   path: "/reports",  primary: false },
        ].map(a => (
          <button key={a.label} onClick={() => navigate(a.path)}
            className={`flex items-center gap-3 p-4 rounded-xl transition-colors text-left
              ${a.primary
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                : "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700"}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
              ${a.primary ? "bg-blue-500" : "bg-blue-50"}`}>
              <a.icon size={18} className={a.primary ? "text-white" : "text-blue-600"} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-none ${a.primary ? "text-white" : "text-slate-800"}`}>
                {a.label}
              </p>
              <p className={`text-xs mt-1 ${a.primary ? "text-blue-200" : "text-slate-400"}`}>{a.sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Today's Revenue",  value: formatCompact(today.revenue),             sub: `${today.bill_count} bills`,      icon: <TrendingUp size={18} />, color: "green", link: "/reports"  },
          { label: "Avg Bill Value",   value: formatCurrency(today.avg_bill_value),      sub: "per transaction",                icon: <ShoppingCart size={18}/>, color: "blue", link: "/reports"  },
          { label: "Low Stock",        value: String(alerts.low_stock),                  sub: "need reorder",                   icon: <Pill size={18} />,       color: alerts.low_stock  > 0 ? "amber" : "green", link: "/medicine" },
          { label: "Expiry Alerts",    value: String(alerts.expiry_alerts),              sub: "within 30 days",                 icon: <AlertTriangle size={18}/>,color: alerts.expiry_alerts > 0 ? "red"   : "green", link: "/expiry"   },
        ].map(k => {
          const bg: Record<string, string> = {
            green: "bg-green-50 text-green-600",
            blue:  "bg-blue-50 text-blue-600",
            amber: "bg-amber-50 text-amber-600",
            red:   "bg-red-50 text-red-600",
          }
          return (
            <button key={k.label} onClick={() => navigate(k.link)}
              className="card p-4 text-left hover:shadow-card transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{k.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg[k.color]}`}>{k.icon}</div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.sub}</p>
            </button>
          )
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Sales — Last 7 Days</h3>
            <button onClick={() => navigate("/reports")}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              Full report <ArrowRight size={12} />
            </button>
          </div>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={trend} barSize={28}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={d => { try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) } catch { return d } }} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickFormatter={v => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`} width={50} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                  labelFormatter={l => { try { return new Date(l).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) } catch { return l } }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">
              No sales yet. Start billing to see the trend.
            </div>
          )}
        </div>

        {/* Payment split */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Today's Payments</h3>
          {payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.mode}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg
                    ${payColors[p.mode] ?? "bg-slate-50 text-slate-700"}`}>
                  <div className="flex items-center gap-2">
                    <span>{icons[p.mode] ?? "💰"}</span>
                    <span className="text-sm font-medium capitalize">{p.mode}</span>
                  </div>
                  <span className="text-sm font-bold">{formatCompact(p.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[120px] text-slate-400">
              <ShoppingCart size={28} className="text-slate-200 mb-2" />
              <p className="text-sm">No payments today</p>
            </div>
          )}
          {alerts.outstanding_customers > 0 && (
            <button onClick={() => navigate("/customers")}
              className="mt-4 w-full flex items-center justify-between px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm hover:bg-amber-100 transition-colors">
              <div className="flex items-center gap-2">
                <Users size={14} />
                <span className="font-medium">{alerts.outstanding_customers} outstanding balances</span>
              </div>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
