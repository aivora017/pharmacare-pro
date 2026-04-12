import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { TrendingUp, ShoppingCart, Pill, AlertTriangle, Users, ArrowRight, Plus, BarChart3, TrendingDown, DollarSign, Clock, PackageX, X } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import toast from "react-hot-toast"
import { invoke } from "@tauri-apps/api/core"
import { useAuthStore } from "@/store/authStore"
import { dashboardService } from "@/services/dashboardService"
import { aiService } from "@/services/aiService"
import { collectionService } from "@/services/collectionService"
import { formatCompact, formatCurrency } from "@/utils/currency"
import { Spinner } from "@/components/shared/Spinner"
import { LicenceAlertBanner } from "./LicenceAlertBanner"

interface ReorderItem { medicine_id: number; medicine_name: string; current_stock: number; reorder_level: number; unit: string }

function ReorderAlertBanner() {
  const navigate = useNavigate()
  const [items,     setItems]     = useState<ReorderItem[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    invoke<ReorderItem[]>("reorder_alerts")
      .then(r => setItems(r))
      .catch(() => {})
  }, [])

  if (dismissed || items.length === 0) return null

  const critical = items.filter(i => i.current_stock === 0)
  const low      = items.filter(i => i.current_stock > 0)

  return (
    <div className="relative bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
      <button onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-orange-400 hover:text-orange-600">
        <X size={14}/>
      </button>
      <div className="flex items-start gap-3">
        <PackageX size={18} className="text-orange-500 mt-0.5 shrink-0"/>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-800">
            {items.length} item{items.length !== 1 ? "s" : ""} need reordering
            {critical.length > 0 && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{critical.length} out of stock</span>}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {items.slice(0, 8).map(item => (
              <span key={item.medicine_id}
                className={`text-xs px-2 py-0.5 rounded-full ${item.current_stock === 0 ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                {item.medicine_name} ({item.current_stock} {item.unit})
              </span>
            ))}
            {items.length > 8 && <span className="text-xs text-orange-500">+{items.length - 8} more</span>}
          </div>
        </div>
        <button onClick={() => navigate("/inventory")}
          className="shrink-0 text-xs text-orange-700 font-medium hover:text-orange-900 flex items-center gap-1 mt-0.5">
          View all <ArrowRight size={12}/>
        </button>
      </div>
    </div>
  )
}

interface Summary {
  today: { revenue: number; bill_count: number; avg_bill_value: number }
  alerts: { low_stock: number; expiry_alerts: number; outstanding_customers: number }
  sales_trend: { date: string; revenue: number; bills: number }[]
  payment_split: { mode: string; amount: number }[]
}

interface ExtendedData {
  today_pl: { revenue: number; cogs: number; gross_profit: number; expenses: number; net_profit: number; margin_pct: number }
  cashier_sales: { name: string; bills: number; revenue: number }[]
  expiry_buckets: { days_7: number; days_30: number; days_90: number }
  monthly: { this_month: number; last_month: number; mom_change_pct: number }
  top_medicines_today: { name: string; qty: number; revenue: number }[]
}

export default function DashboardPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const [data,     setData]     = useState<Summary | null>(null)
  const [extended, setExtended] = useState<ExtendedData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [briefing, setBriefing] = useState<{ priority: string; message: string; link?: string }[]>([])

  useEffect(() => {
    dashboardService.getSummary()
      .then(d => setData(d as Summary))
      .catch(() => toast.error("Could not load dashboard."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    collectionService.dashboardExtended()
      .then(d => setExtended(d as ExtendedData))
      .catch(() => { /* silent — may not have data yet */ })
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
      <ReorderAlertBanner />
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
            <button onClick={() => navigate("/collections")}
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

      {/* Extended KPIs — Sprint 9 */}
      {extended && (
        <>
          {/* P&L + MoM row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Today's P&L */}
            <div className="card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <DollarSign size={16} className="text-green-600" /> Today's P&amp;L
                </h3>
                {extended.monthly.mom_change_pct !== 0 && (
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full
                    ${extended.monthly.mom_change_pct >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"}`}>
                    {extended.monthly.mom_change_pct >= 0
                      ? <TrendingUp size={11} />
                      : <TrendingDown size={11} />}
                    {Math.abs(extended.monthly.mom_change_pct).toFixed(1)}% vs last month
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Revenue",      value: extended.today_pl.revenue,      color: "text-slate-800" },
                  { label: "COGS",         value: extended.today_pl.cogs,         color: "text-slate-500" },
                  { label: "Gross Profit", value: extended.today_pl.gross_profit, color: "text-blue-600"  },
                  { label: "Expenses",     value: extended.today_pl.expenses,     color: "text-amber-600" },
                  { label: "Net Profit",   value: extended.today_pl.net_profit,   color: extended.today_pl.net_profit >= 0 ? "text-green-600" : "text-red-600" },
                ].map(item => (
                  <div key={item.label} className="text-center bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className={`text-sm font-bold ${item.color}`}>{formatCompact(item.value)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, extended.today_pl.margin_pct))}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  {extended.today_pl.margin_pct.toFixed(1)}% margin
                </span>
              </div>
            </div>

            {/* Month comparison */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">Month Revenue</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">This Month</p>
                  <p className="text-2xl font-bold text-slate-900">{formatCompact(extended.monthly.this_month)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Last Month</p>
                  <p className="text-lg font-semibold text-slate-500">{formatCompact(extended.monthly.last_month)}</p>
                </div>
                {extended.monthly.last_month > 0 && (
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                    ${extended.monthly.mom_change_pct >= 0
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"}`}>
                    {extended.monthly.mom_change_pct >= 0
                      ? <TrendingUp size={14} />
                      : <TrendingDown size={14} />}
                    {extended.monthly.mom_change_pct >= 0 ? "+" : ""}
                    {extended.monthly.mom_change_pct.toFixed(1)}% MoM
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cashier sales + Expiry buckets + Top medicines */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cashier sales */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Users size={15} className="text-blue-500" /> Cashier Sales Today
              </h3>
              {extended.cashier_sales.length > 0 ? (
                <div className="space-y-2">
                  {extended.cashier_sales.map(cs => (
                    <div key={cs.name} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{cs.name}</p>
                        <p className="text-xs text-slate-400">{cs.bills} bills</p>
                      </div>
                      <p className="text-sm font-bold text-blue-600">{formatCompact(cs.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">No sales recorded today.</p>
              )}
            </div>

            {/* Expiry countdown buckets */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Clock size={15} className="text-amber-500" /> Expiry Watch
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Expiring in 7 days",  count: extended.expiry_buckets.days_7,  color: "bg-red-50 text-red-700 border-red-100",    dot: "bg-red-500"    },
                  { label: "Expiring in 30 days", count: extended.expiry_buckets.days_30, color: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-amber-500" },
                  { label: "Expiring in 90 days", count: extended.expiry_buckets.days_90, color: "bg-yellow-50 text-yellow-700 border-yellow-100", dot: "bg-yellow-400" },
                ].map(bucket => (
                  <button key={bucket.label}
                    onClick={() => navigate("/expiry")}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors hover:opacity-80 ${bucket.color}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${bucket.dot}`} />
                      <span className="font-medium">{bucket.label}</span>
                    </div>
                    <span className="font-bold">{bucket.count} batches</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Top medicines today */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Pill size={15} className="text-purple-500" /> Top Medicines Today
              </h3>
              {extended.top_medicines_today.length > 0 ? (
                <div className="space-y-2">
                  {extended.top_medicines_today.slice(0, 5).map((m, i) => (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-xs font-bold text-slate-500 flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.qty} units</p>
                      </div>
                      <p className="text-xs font-semibold text-slate-600 whitespace-nowrap">{formatCompact(m.revenue)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">No sales yet today.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
