import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { supplierCreditService, SupplierCreditNote, SupplierCreditNoteItem } from "@/services/supplierCreditService"
import { useAuthStore } from "@/store/authStore"
import toast from "react-hot-toast"
import { Plus, RotateCcw, X, CheckCircle } from "lucide-react"

function todayISO() { return new Date().toISOString().slice(0, 10) }

const REASON_BADGE: Record<string, string> = {
  damaged: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
  wrong_item: "bg-yellow-100 text-yellow-700",
  excess_quantity: "bg-blue-100 text-blue-700",
  other: "bg-slate-100 text-slate-600",
}
const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  applied: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
}

export default function SupplierCreditPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 1

  const [notes, setNotes] = useState<SupplierCreditNote[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await supplierCreditService.list()
      setNotes(res.credit_notes)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const loadSuppliers = async () => {
    try {
      const res = await invoke<{ suppliers: any[] }>('supplier_list', { q: '', page: 1, perPage: 200 })
      setSuppliers(res.suppliers ?? [])
    } catch { /* ignore */ }
  }

  const apply = async (id: number) => {
    if (!confirm("Apply this credit note? Supplier's outstanding balance will be reduced.")) return
    try {
      await supplierCreditService.apply(id, userId)
      toast.success("Credit note applied successfully")
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier Credit Notes"
        subtitle="Manage vendor returns, damaged goods and credit adjustments"
      />

      <div className="flex justify-end">
        <button
          onClick={() => { loadSuppliers(); setShowModal(true) }}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> New Credit Note
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RotateCcw className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No credit notes found</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">CN No.</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notes.map(cn => (
                <tr key={cn.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{cn.cn_number}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{cn.supplier_name}</p>
                    {cn.purchase_bill_number && (
                      <p className="text-xs text-slate-400">Bill: {cn.purchase_bill_number}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cn.cn_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REASON_BADGE[cn.reason] ?? 'bg-slate-100 text-slate-600'}`}>
                      {cn.reason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ₹{cn.total_amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[cn.status] ?? ''}`}>
                      {cn.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cn.status === 'pending' && (
                      <button
                        onClick={() => apply(cn.id)}
                        className="flex items-center gap-1 text-xs text-green-600 hover:underline mx-auto"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Apply
                      </button>
                    )}
                    {cn.status !== 'pending' && <span className="text-xs text-slate-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <NewCreditNoteModal
          suppliers={suppliers}
          userId={userId}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function NewCreditNoteModal({ suppliers, userId, onClose, onCreated }: {
  suppliers: any[]
  userId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [supplierId, setSupplierId] = useState<number | "">("")
  const [cnDate, setCnDate] = useState(todayISO())
  const [reason, setReason] = useState("damaged")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<SupplierCreditNoteItem[]>([
    { medicine_name: "", batch_number: "", quantity: 1, unit_price: 0, total_amount: 0 }
  ])
  const [saving, setSaving] = useState(false)

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated.total_amount = updated.quantity * updated.unit_price
      }
      return updated
    }))
  }

  const addItem = () => setItems(prev => [
    ...prev,
    { medicine_name: "", batch_number: "", quantity: 1, unit_price: 0, total_amount: 0 }
  ])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const save = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return }
    if (items.some(i => !i.medicine_name || i.quantity <= 0)) {
      toast.error("Fill all item details"); return
    }
    setSaving(true)
    try {
      await supplierCreditService.create({
        supplier_id: supplierId,
        cn_date: cnDate,
        reason,
        notes,
        items,
      }, userId)
      toast.success("Credit note created")
      onCreated()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">New Supplier Credit Note</h2>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={cnDate} onChange={e => setCnDate(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} className="input w-full">
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="wrong_item">Wrong Item</option>
                <option value="excess_quantity">Excess Quantity</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input w-full" placeholder="Optional" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Return Items</label>
              <button onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input col-span-4 text-sm"
                    placeholder="Medicine name"
                    value={item.medicine_name}
                    onChange={e => updateItem(idx, 'medicine_name', e.target.value)}
                  />
                  <input
                    className="input col-span-2 text-sm"
                    placeholder="Batch"
                    value={item.batch_number}
                    onChange={e => updateItem(idx, 'batch_number', e.target.value)}
                  />
                  <input
                    className="input col-span-2 text-sm text-right"
                    type="number" min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                  />
                  <input
                    className="input col-span-2 text-sm text-right"
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
              {saving ? "Creating..." : "Create Credit Note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
