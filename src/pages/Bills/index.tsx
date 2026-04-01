import { useState, useCallback, useEffect } from "react"
import { Receipt, Search, X, Printer, RotateCcw, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"
import { billingService } from "@/services/billingService"
import { printerService } from "@/services/printerService"
import { useAuthStore } from "@/store/authStore"
import { formatDate, formatDateTime } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Spinner } from "@/components/shared/Spinner"
import type { IBill, IBillItem } from "@/types"

type Filters = { search: string; status: string; from_date: string; to_date: string }

export default function BillsPage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + "01"

  const [bills, setBills]     = useState<IBill[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Filters>({ search:"", status:"active", from_date: monthStart, to_date: today })
  const [selectedBill, setSelectedBill]       = useState<IBill | null>(null)
  const [loadingDetail, setLoadingDetail]     = useState(false)
  const [cancelTarget, setCancelTarget]       = useState<IBill | null>(null)
  const [cancelReason, setCancelReason]       = useState("")
  const [cancelling, setCancelling]           = useState(false)
  const [showReturnForm, setShowReturnForm]   = useState(false)
  const [printing, setPrinting]               = useState<number | null>(null)

  const load = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const f: Record<string, unknown> = { page: pg, page_size: 50 }
      if (filters.status)    f.status = filters.status
      if (filters.from_date) f.from_date = filters.from_date
      if (filters.to_date)   f.to_date   = filters.to_date
      const res = await billingService.listBills(f) as { bills: IBill[]; total: number }
      setBills(res.bills ?? [])
      setTotal(res.total ?? 0)
      setPage(pg)
    } catch { toast.error("Could not load bills.") }
    finally { setLoading(false) }
  }, [filters])

  useEffect(() => { load(1) }, [load])

  const viewBill = async (bill: IBill) => {
    setLoadingDetail(true)
    setSelectedBill(null)
    try {
      const full = await billingService.getBill(bill.id) as IBill
      setSelectedBill(full)
    } catch { toast.error("Could not load bill details.") }
    finally { setLoadingDetail(false) }
  }

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) { toast.error("Please enter a reason."); return }
    setCancelling(true)
    try {
      await billingService.cancelBill(cancelTarget.id, cancelReason, uid)
      toast.success(`Bill ${cancelTarget.bill_number} cancelled.`)
      setCancelTarget(null); setCancelReason("")
      setSelectedBill(null); load(page)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setCancelling(false) }
  }

  const printBill = async (id: number) => {
    setPrinting(id)
    try { await printerService.printBill(id); toast.success("Sent to printer.") }
    catch { toast("Bill saved. Configure printer in Settings.",{icon:"💡"}) }
    finally { setPrinting(null) }
  }

  const setFilter = (k: keyof Filters, v: string) => setFilters(p => ({ ...p, [k]: v }))

  return (
    <div className="flex h-full -m-5 overflow-hidden">
      {/* Left: bill list */}
      <div className="flex flex-col w-[480px] flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Receipt size={18} className="text-blue-600"/>Bill History
            </h1>
            <button onClick={() => load(1)} className="btn-ghost text-xs py-1.5"><RefreshCw size={13}/>Refresh</button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={filters.from_date} onChange={e => setFilter("from_date", e.target.value)} className="input text-xs py-1.5"/>
            <input type="date" value={filters.to_date}   onChange={e => setFilter("to_date",   e.target.value)} className="input text-xs py-1.5"/>
          </div>
          <div className="flex gap-2">
            <select value={filters.status} onChange={e => setFilter("status", e.target.value)} className="input text-xs py-1.5 w-28">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => load(1)} disabled={loading} className="btn-primary text-xs py-1.5 flex-1">
              {loading ? <Spinner size="sm"/> : <><Search size={13}/>Search</>}
            </button>
          </div>
          <p className="text-xs text-slate-400">{total} bills found</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loading && <div className="flex justify-center py-12"><Spinner/></div>}
          {!loading && bills.length === 0 && (
            <EmptyState icon={<Receipt size={36}/>} title="No bills found" subtitle="Adjust your filters and search again."/>
          )}
          {!loading && bills.map(bill => (
            <button key={bill.id} onClick={() => viewBill(bill)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selectedBill?.id === bill.id ? "bg-blue-50 border-r-2 border-blue-600" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800 font-mono">{bill.bill_number}</p>
                  <StatusBadge status={bill.status}/>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {bill.customer_name ?? "Walk-in"} · {formatDate(bill.bill_date)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-900">{formatCurrency(bill.net_amount)}</p>
                {bill.outstanding > 0 && <p className="text-xs text-red-500">Due: {formatCurrency(bill.outstanding)}</p>}
              </div>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between p-3 border-t border-slate-200">
            <button onClick={() => load(page-1)} disabled={page===1||loading} className="btn-ghost text-xs py-1.5">← Prev</button>
            <span className="text-xs text-slate-500">Page {page} of {Math.ceil(total/50)}</span>
            <button onClick={() => load(page+1)} disabled={page>=Math.ceil(total/50)||loading} className="btn-ghost text-xs py-1.5">Next →</button>
          </div>
        )}
      </div>

      {/* Right: bill detail */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {!selectedBill && !loadingDetail && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Receipt size={48} className="text-slate-200 mb-3"/>
            <p className="font-medium">Select a bill to view details</p>
          </div>
        )}
        {loadingDetail && <div className="flex justify-center py-16"><Spinner size="lg"/></div>}
        {selectedBill && !loadingDetail && (
          <BillDetail
            bill={selectedBill}
            printing={printing === selectedBill.id}
            onPrint={() => printBill(selectedBill.id)}
            onCancel={() => { setCancelTarget(selectedBill); setCancelReason("") }}
            onReturn={() => setShowReturnForm(true)}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Bill?"
        message={`Cancel bill ${cancelTarget?.bill_number}? This will restore stock and cannot be undone.`}
        confirmText="Cancel Bill"
        danger
        loading={cancelling}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}>
        <div className="mt-3">
          <label className="label text-sm">Reason for cancellation <span className="text-red-500">*</span></label>
          <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} rows={2}
            placeholder="Enter reason…" className="input resize-none mt-1"/>
        </div>
      </ConfirmDialog>

      {showReturnForm && selectedBill && (
        <ReturnForm bill={selectedBill} uid={uid}
          onClose={() => setShowReturnForm(false)}
          onSaved={() => { setShowReturnForm(false); setSelectedBill(null); load(page) }}/>
      )}
    </div>
  )
}

function BillDetail({ bill, printing, onPrint, onCancel, onReturn }: {
  bill: IBill; printing: boolean;
  onPrint: () => void; onCancel: () => void; onReturn: () => void
}) {
  const items = (bill.items ?? []) as IBillItem[]
  const payments = (bill.payments ?? []) as { amount:number; payment_mode:string; reference_no?:string; payment_date:string }[]

  return (
    <div className="max-w-2xl space-y-4 animate-fade-in">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xl font-bold font-mono text-slate-900">{bill.bill_number}</p>
            <p className="text-slate-500 text-sm mt-0.5">{formatDateTime(bill.bill_date)}</p>
            <p className="text-slate-700 text-sm mt-1 font-medium">{bill.customer_name ?? "Walk-in Customer"}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={bill.status}/>
            <div className="flex gap-2">
              <button onClick={onPrint} disabled={printing} className="btn-ghost text-xs py-1.5">
                {printing ? <Spinner size="sm"/> : <><Printer size={13}/>Print</>}
              </button>
              {bill.status === "active" && (
                <>
                  <button onClick={onReturn} className="btn-ghost text-xs py-1.5 text-amber-600 hover:bg-amber-50">
                    <RotateCcw size={13}/>Return
                  </button>
                  <button onClick={onCancel} className="btn-ghost text-xs py-1.5 text-red-600 hover:bg-red-50">
                    <X size={13}/>Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <p className="font-semibold text-slate-800 text-sm">{items.length} Items</p>
        </div>
        <div className="divide-y divide-slate-50">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{item.medicine_name}</p>
                <p className="text-xs text-slate-400">Batch: {item.batch_number} · Exp: {formatDate(item.expiry_date)}</p>
                {item.discount_percent > 0 && <p className="text-xs text-green-600">Discount: {item.discount_percent}%</p>}
              </div>
              <p className="text-xs text-slate-500 w-10 text-center">{item.quantity}</p>
              <p className="text-xs text-slate-500 w-16 text-right">₹{item.unit_price.toFixed(2)}</p>
              <p className="text-sm font-semibold text-slate-900 w-20 text-right">{formatCurrency(item.total_amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="card p-4 space-y-2">
        {[
          { label:"Subtotal",      value: bill.subtotal ?? 0,        color:"" },
          { label:"Discount",      value: -(bill.discount_amount ?? 0), color:"text-green-600" },
          { label:"CGST",          value: bill.cgst_amount ?? 0,     color:"" },
          { label:"SGST",          value: bill.sgst_amount ?? 0,     color:"" },
          { label:"Round Off",     value: bill.round_off ?? 0,       color:"text-slate-400" },
        ].filter(r => Math.abs(r.value) > 0).map(r => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="text-slate-500">{r.label}</span>
            <span className={r.color || "text-slate-700"}>{formatCurrency(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200">
          <span>Net Total</span><span>{formatCurrency(bill.net_amount)}</span>
        </div>
        {bill.outstanding > 0 && (
          <div className="flex justify-between text-sm text-red-600 font-medium">
            <span>Outstanding</span><span>{formatCurrency(bill.outstanding)}</span>
          </div>
        )}
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="card p-4">
          <p className="font-semibold text-slate-800 text-sm mb-3">Payments</p>
          {payments.map((p, i) => (
            <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
              <span className="text-slate-600 capitalize">{p.payment_mode}{p.reference_no && ` · ${p.reference_no}`}</span>
              <span className="font-medium text-slate-900">{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReturnForm({ bill, uid, onClose, onSaved }: { bill: IBill; uid: number; onClose: () => void; onSaved: () => void }) {
  const items = (bill.items ?? []) as IBillItem[]
  const [selected, setSelected] = useState<Record<number, number>>({})
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  const toggle = (idx: number, qty: number) => {
    setSelected(p => p[idx] !== undefined ? (({ [idx]: _, ...rest }) => rest)(p) : { ...p, [idx]: qty })
  }
  const setQty = (idx: number, qty: number) => setSelected(p => ({ ...p, [idx]: qty }))

  const handleReturn = async () => {
    const toReturn = Object.entries(selected)
      .filter(([,q]) => q > 0)
      .map(([idx, qty]) => ({ ...items[Number(idx)], quantity: qty }))
    if (toReturn.length === 0) { toast.error("Select at least one item."); return }
    if (!reason.trim()) { toast.error("Reason is required."); return }
    setSaving(true)
    try {
      const id = await billingService.createReturn(bill.id, toReturn, reason, uid)
      toast.success(`Return created (ID: ${id}). Stock restored.`)
      onSaved()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="font-bold text-slate-900">Return Items — {bill.bill_number}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-500">Select items to return and specify quantities. Stock will be restored.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {items.map((item, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors cursor-pointer ${selected[i]!==undefined?"border-blue-500 bg-blue-50":"border-slate-200"}`}
                onClick={() => toggle(i, item.quantity)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.medicine_name}</p>
                  <p className="text-xs text-slate-400">Batch: {item.batch_number} · Sold: {item.quantity}</p>
                </div>
                {selected[i] !== undefined && (
                  <div onClick={e => e.stopPropagation()}>
                    <input type="number" min={1} max={item.quantity} value={selected[i]}
                      onChange={e => setQty(i, Math.min(parseInt(e.target.value)||1, item.quantity))}
                      className="w-16 text-center border border-slate-200 rounded-lg text-sm py-1 outline-none focus:ring-2 focus:ring-blue-500"/>
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.total_amount)}</span>
              </div>
            ))}
          </div>
          <div>
            <label className="label">Reason for Return <span className="text-red-500">*</span></label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              placeholder="Damaged, expired, wrong item…" className="input resize-none"/>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={handleReturn} disabled={saving} className="btn-primary flex-1">
              {saving ? <><Spinner size="sm"/>Processing…</> : "Process Return"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
