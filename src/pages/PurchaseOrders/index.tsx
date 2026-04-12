import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { purchaseOrderService, PurchaseOrder, PurchaseOrderItem } from "@/services/purchaseOrderService"
import { useAuthStore } from "@/store/authStore"
import toast from "react-hot-toast"
import { Plus, RefreshCw, Package, Truck, ClipboardCheck, X, ChevronDown } from "lucide-react"

function todayISO() { return new Date().toISOString().slice(0, 10) }

const STATUS_TABS = ["all", "draft", "sent", "partially_received", "received", "cancelled"] as const
const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", sent: "Sent", partially_received: "Partially Received",
  received: "Received", cancelled: "Cancelled"
}

export default function PurchaseOrdersPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 1

  const [activeTab, setActiveTab] = useState<string>("all")
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showNewPO, setShowNewPO] = useState(false)
  const [showAutoGenerate, setShowAutoGenerate] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await purchaseOrderService.list(activeTab === "all" ? undefined : activeTab)
      setOrders(res.orders)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [activeTab])

  useEffect(() => { load() }, [load])

  const loadSuppliers = async () => {
    try {
      const res = await invoke<{ suppliers: any[] }>('supplier_list', { q: '', page: 1, perPage: 200 })
      setSuppliers(res.suppliers ?? [])
    } catch { /* ignore */ }
  }

  const openDetail = async (po: PurchaseOrder) => {
    try {
      const full = await purchaseOrderService.get(po.id)
      setSelectedPO(full)
      setShowDetail(true)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  const updateStatus = async (id: number, status: string) => {
    try {
      await purchaseOrderService.updateStatus(id, status, userId)
      toast.success(`PO marked as ${STATUS_LABEL[status] ?? status}`)
      setShowDetail(false)
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  const runAutoGenerate = async () => {
    try {
      const res = await purchaseOrderService.autoGenerate(userId)
      setSuggestions(res.suggestions)
      await loadSuppliers()
      setShowAutoGenerate(true)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        subtitle="Manage supplier purchase orders and auto-generate from reorder levels"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                activeTab === tab ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "all" ? "All" : STATUS_LABEL[tab] ?? tab}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={runAutoGenerate} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Auto-Generate PO
          </button>
          <button onClick={() => { loadSuppliers(); setShowNewPO(true) }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New PO
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No purchase orders found</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetail(po)}>
                  <td className="px-4 py-3 font-medium text-slate-800">{po.po_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{po.supplier_name}</p>
                    {po.supplier_phone && <p className="text-xs text-slate-400">{po.supplier_phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{po.order_date}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    ₹{po.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[po.status] ?? ''}`}>
                      {STATUS_LABEL[po.status] ?? po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openDetail(po)} className="text-xs text-blue-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedPO && (
        <PODetailModal
          po={selectedPO}
          onClose={() => setShowDetail(false)}
          onUpdateStatus={updateStatus}
        />
      )}

      {/* New PO Modal */}
      {showNewPO && (
        <NewPOModal
          suppliers={suppliers}
          userId={userId}
          onClose={() => setShowNewPO(false)}
          onCreated={() => { setShowNewPO(false); load() }}
        />
      )}

      {/* Auto-Generate Modal */}
      {showAutoGenerate && (
        <AutoGenerateModal
          suggestions={suggestions}
          suppliers={suppliers}
          userId={userId}
          onClose={() => setShowAutoGenerate(false)}
          onCreated={() => { setShowAutoGenerate(false); load() }}
        />
      )}
    </div>
  )
}

function PODetailModal({ po, onClose, onUpdateStatus }: {
  po: PurchaseOrder
  onClose: () => void
  onUpdateStatus: (id: number, status: string) => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{po.po_number}</h2>
            <p className="text-sm text-slate-500">{po.supplier_name} · {po.order_date}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGE[po.status] ?? ''}`}>
              {STATUS_LABEL[po.status] ?? po.status}
            </span>
            {po.expected_date && <span className="text-sm text-slate-500">Expected: {po.expected_date}</span>}
          </div>
          {po.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{po.notes}</p>}

          {/* Items Table */}
          <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Medicine</th>
                  <th className="px-3 py-2 text-right">Ordered</th>
                  <th className="px-3 py-2 text-right">Received</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(po.items ?? []).map((item, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-medium">{item.medicine_name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity_ordered}</td>
                    <td className="px-3 py-2 text-right">{item.quantity_received ?? 0}</td>
                    <td className="px-3 py-2 text-right">₹{item.unit_price}</td>
                    <td className="px-3 py-2 text-right font-medium">₹{item.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan={4} className="px-3 py-2 font-semibold text-right">Total</td>
                  <td className="px-3 py-2 font-bold text-right">₹{po.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Status Actions */}
          <div className="flex gap-2 pt-2">
            {po.status === 'draft' && (
              <>
                <button onClick={() => onUpdateStatus(po.id, 'sent')} className="btn-primary text-sm">Mark Sent</button>
                <button onClick={() => onUpdateStatus(po.id, 'cancelled')} className="btn-secondary text-sm text-red-600">Cancel PO</button>
              </>
            )}
            {po.status === 'sent' && (
              <>
                <button onClick={() => onUpdateStatus(po.id, 'partially_received')} className="btn-secondary text-sm">Mark Partially Received</button>
                <button onClick={() => onUpdateStatus(po.id, 'received')} className="btn-primary text-sm">Mark Received</button>
                <button onClick={() => onUpdateStatus(po.id, 'cancelled')} className="btn-secondary text-sm text-red-600">Cancel PO</button>
              </>
            )}
            {po.status === 'partially_received' && (
              <button onClick={() => onUpdateStatus(po.id, 'received')} className="btn-primary text-sm">Mark Fully Received</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NewPOModal({ suppliers, userId, onClose, onCreated }: {
  suppliers: any[]
  userId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState<number | "">("")
  const [orderDate, setOrderDate] = useState(todayISO())
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<PurchaseOrderItem[]>([
    { medicine_id: 0, medicine_name: "", quantity_ordered: 1, unit_price: 0, total_amount: 0 }
  ])
  const [saving, setSaving] = useState(false)

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity_ordered' || field === 'unit_price') {
        updated.total_amount = updated.quantity_ordered * updated.unit_price
      }
      return updated
    }))
  }

  const addItem = () => setItems(prev => [...prev, { medicine_id: 0, medicine_name: "", quantity_ordered: 1, unit_price: 0, total_amount: 0 }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return }
    if (items.some(i => !i.medicine_name || i.quantity_ordered <= 0)) {
      toast.error("Fill all item details"); return
    }
    setSaving(true)
    try {
      await purchaseOrderService.create({
        supplier_id: supplierId as number,
        order_date: orderDate,
        expected_date: expectedDate || undefined,
        notes,
        items
      }, userId)
      toast.success("Purchase order created")
      onCreated()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">New Purchase Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))} className="input w-full">
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Order Date</label>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery</label>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input w-full" placeholder="Optional notes" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Items</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Add Item</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input col-span-5 text-sm"
                    placeholder="Medicine name"
                    value={item.medicine_name}
                    onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                  />
                  <input
                    className="input col-span-2 text-sm text-right"
                    type="number" min={1}
                    placeholder="Qty"
                    value={item.quantity_ordered}
                    onChange={e => updateItem(idx, 'quantity_ordered', Number(e.target.value))}
                  />
                  <input
                    className="input col-span-3 text-sm text-right"
                    type="number" min={0} step="0.01"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                  />
                  <div className="col-span-1 text-right text-sm font-medium text-slate-700">
                    ₹{item.total_amount.toFixed(0)}
                  </div>
                  <button onClick={() => removeItem(idx)} className="col-span-1 text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : "Create PO"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AutoGenerateModal({ suggestions, suppliers, userId, onClose, onCreated }: {
  suggestions: any[]
  suppliers: any[]
  userId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState<number | "">("")
  const [selected, setSelected] = useState<Set<number>>(new Set(suggestions.map((_: any, i: number) => i)))
  const [prices, setPrices] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)

  const toggle = (idx: number) => setSelected(prev => {
    const s = new Set(prev)
    s.has(idx) ? s.delete(idx) : s.add(idx)
    return s
  })

  const save = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return }
    const items = suggestions
      .filter((_: any, i: number) => selected.has(i))
      .map((s: any, i: number) => ({
        medicine_id: s.medicine_id,
        medicine_name: s.medicine_name,
        quantity_ordered: s.reorder_quantity,
        unit_price: prices[i] ?? 0,
        total_amount: s.reorder_quantity * (prices[i] ?? 0),
      }))
    if (items.length === 0) { toast.error("Select at least one item"); return }
    setSaving(true)
    try {
      await purchaseOrderService.create({ supplier_id: supplierId as number, items }, userId)
      toast.success("Purchase order created from reorder suggestions")
      onCreated()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Auto-Generate Purchase Order</h2>
            <p className="text-sm text-slate-500">{suggestions.length} medicines at or below reorder level</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
            <select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))} className="input w-full">
              <option value="">Select supplier for this PO</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="overflow-hidden border border-slate-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-center w-8"></th>
                  <th className="px-3 py-2 text-left">Medicine</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Reorder Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suggestions.map((s: any, i: number) => (
                  <tr key={i} className={selected.has(i) ? "" : "opacity-40"}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="w-4 h-4 accent-blue-600" />
                    </td>
                    <td className="px-3 py-2 font-medium">{s.medicine_name}</td>
                    <td className="px-3 py-2 text-right text-red-600 font-medium">{s.current_stock}</td>
                    <td className="px-3 py-2 text-right">{s.reorder_quantity}</td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number" min={0} step="0.01"
                        value={prices[i] ?? ""}
                        onChange={e => setPrices(prev => ({ ...prev, [i]: Number(e.target.value) }))}
                        className="input w-24 text-right text-sm py-1"
                        placeholder="₹"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? "Creating..." : `Create PO (${selected.size} items)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
