import { useEffect, useState, useCallback } from "react"
import { AlertTriangle, RefreshCw, Package, TrendingDown } from "lucide-react"
import toast from "react-hot-toast"
import { inventoryService } from "@/services/inventoryService"
import { formatDate } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Spinner } from "@/components/shared/Spinner"

type ExpiryItem = {
  id: number; medicine_id: number; medicine_name: string; batch_number: string
  barcode?: string; expiry_date: string; purchase_price: number; selling_price: number
  quantity_on_hand: number; rack_location?: string; days_left: number; risk_level: string
  supplier_name: string
}

const RISK_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  expired:  { label: "Expired",  bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  critical: { label: "Critical", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  high:     { label: "High",     bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  medium:   { label: "Medium",   bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  low:      { label: "Low",      bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" },
}

export default function ExpiryPage() {
  const [items, setItems] = useState<ExpiryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")
  const [withinDays, setWithinDays] = useState(90)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await inventoryService.getExpiryList(withinDays) as ExpiryItem[]
      setItems(data)
    } catch { toast.error("Could not load expiry data.") }
    finally { setLoading(false) }
  }, [withinDays])

  useEffect(() => { load() }, [load])

  const filtered = filter === "all" ? items : items.filter(i => i.risk_level === filter)

  const counts = {
    expired:  items.filter(i => i.risk_level === "expired").length,
    critical: items.filter(i => i.risk_level === "critical").length,
    high:     items.filter(i => i.risk_level === "high").length,
    medium:   items.filter(i => i.risk_level === "medium").length,
  }

  const totalLossValue = items
    .filter(i => i.risk_level === "expired" || i.risk_level === "critical")
    .reduce((sum, i) => sum + i.quantity_on_hand * i.purchase_price, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expiry Dashboard"
        subtitle="Track medicines expiring soon and take action before losses occur"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Show within</label>
              <select value={withinDays} onChange={e => setWithinDays(parseInt(e.target.value))}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
                {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </div>
            <button onClick={load} className="btn-ghost text-xs"><RefreshCw size={14} />Refresh</button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "expired",  label: "Expired",       value: counts.expired,  color: "red" },
          { key: "critical", label: "Critical (≤30d)",value: counts.critical, color: "red" },
          { key: "high",     label: "High (≤60d)",    value: counts.high,     color: "orange" },
          { key: "medium",   label: "Medium (≤90d)",  value: counts.medium,   color: "amber" },
        ].map(card => {
          const colorMap: Record<string, string> = { red:"bg-red-50 text-red-700 border-red-200", orange:"bg-orange-50 text-orange-700 border-orange-200", amber:"bg-amber-50 text-amber-700 border-amber-200" }
          return (
            <button key={card.key} onClick={() => setFilter(filter === card.key ? "all" : card.key)}
              className={`card p-4 text-left transition-all ${filter === card.key ? "ring-2 ring-blue-500" : ""}`}>
              <p className="text-xs text-slate-500 mb-2">{card.label}</p>
              <p className={`text-3xl font-bold ${card.value > 0 ? colorMap[card.color]?.split(' ')[1] : "text-slate-400"}`}>{card.value}</p>
              <p className="text-xs text-slate-400 mt-1">batches</p>
            </button>
          )
        })}
      </div>

      {/* Loss alert */}
      {totalLossValue > 0 && (
        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <TrendingDown size={24} className="text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Potential Inventory Loss</p>
            <p className="text-sm text-red-700">Expired + Critical batches represent <strong>{formatCurrency(totalLossValue)}</strong> of stock value. Take action now to minimise losses — contact suppliers for returns or run a promotion.</p>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {["all", "expired", "critical", "high", "medium", "low"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {f === "all" ? `All (${items.length})` : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Package size={40} />}
            title={filter === "all" ? "No expiring medicines" : `No ${filter} batches`}
            subtitle={filter === "all" ? `No medicines expiring within ${withinDays} days. Good!` : "Try a different filter."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Medicine</th>
                  <th className="text-left px-4 py-3">Batch</th>
                  <th className="text-left px-4 py-3">Expiry Date</th>
                  <th className="text-center px-4 py-3">Days Left</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Stock Value</th>
                  <th className="text-center px-4 py-3">Risk</th>
                  <th className="text-left px-4 py-3">Rack</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const risk = RISK_CONFIG[item.risk_level] ?? RISK_CONFIG.low
                  return (
                    <tr key={item.id} className={`table-row ${item.risk_level === "expired" || item.risk_level === "critical" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{item.medicine_name}</p>
                        {item.supplier_name && <p className="text-xs text-slate-400">{item.supplier_name}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.batch_number}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(item.expiry_date)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-bold text-sm ${item.days_left < 0 ? "text-red-600" : item.days_left <= 30 ? "text-red-500" : item.days_left <= 60 ? "text-orange-600" : "text-amber-600"}`}>
                          {item.days_left < 0 ? `${Math.abs(item.days_left)}d ago` : `${item.days_left}d`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{item.quantity_on_hand}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(item.quantity_on_hand * item.purchase_price)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${risk.bg} ${risk.text} ${risk.border}`}>
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{item.rack_location ?? "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
