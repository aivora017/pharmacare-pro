import { useState, useCallback } from "react"
import { Package, Search, AlertTriangle, Plus, Minus, ClipboardList } from "lucide-react"
import toast from "react-hot-toast"
import { inventoryService } from "@/services/inventoryService"
import { medicineService } from "@/services/medicineService"
import { useAuthStore } from "@/store/authStore"
import { useDebounce } from "@/hooks/useDebounce"
import { formatDate } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { Spinner } from "@/components/shared/Spinner"

type AdjType = "damage"|"theft"|"expired"|"return"|"physical_count"|"other"
type BatchRow = { id:number; batch_number:string; expiry_date:string; quantity_on_hand:number; purchase_price:number; rack_location?:string; medicine_name?:string; medicine_id?:number }

const ADJ_TYPES: { id:AdjType; label:string; icon:string }[] = [
  {id:"damage",         label:"Damage",           icon:"💔"},
  {id:"theft",          label:"Theft / Missing",  icon:"🔍"},
  {id:"expired",        label:"Expired Write-off", icon:"⏰"},
  {id:"return",         label:"Return to Supplier",icon:"↩"},
  {id:"physical_count", label:"Physical Count",    icon:"📋"},
  {id:"other",          label:"Other",             icon:"📝"},
]

export default function StockAdjustPage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const [search, setSearch] = useState("")
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<BatchRow | null>(null)
  const [adjType, setAdjType] = useState<AdjType>("damage")
  const [quantity, setQuantity] = useState("")
  const [physActual, setPhysActual] = useState("")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const dq = useDebounce(search, 300)

  const searchBatches = useCallback(async (q: string) => {
    if (q.length < 2) { setBatches([]); return }
    setLoading(true)
    try {
      const meds = await medicineService.search(q, true) as { id:number;name:string }[]
      const all: BatchRow[] = []
      for (const m of meds.slice(0,8)) {
        const bs = await medicineService.listBatches(m.id) as BatchRow[]
        bs.filter(b => b.quantity_on_hand > 0).forEach(b => all.push({ ...b, medicine_name: m.name, medicine_id: m.id }))
      }
      setBatches(all)
    } catch { toast.error("Search failed.") }
    finally { setLoading(false) }
  }, [])

  const handleSubmit = async () => {
    if (!selected) { toast.error("Select a batch first."); return }
    if (!reason.trim()) { toast.error("Reason is required."); return }

    setSaving(true)
    try {
      if (adjType === "physical_count") {
        const actual = parseInt(physActual)
        if (isNaN(actual) || actual < 0) { toast.error("Enter valid actual quantity."); return }
        await inventoryService.physicalCount(selected.id, actual, uid)
        toast.success(`Physical count updated. System had ${selected.quantity_on_hand}, actual: ${actual}.`)
      } else {
        const qty = parseInt(quantity)
        if (isNaN(qty) || qty <= 0) { toast.error("Enter valid quantity."); return }
        if (qty > selected.quantity_on_hand) { toast.error(`Cannot adjust more than available stock (${selected.quantity_on_hand}).`); return }
        await inventoryService.adjustStock(selected.id, qty, adjType, reason, uid)
        toast.success(`${qty} units marked as ${adjType}.`)
      }
      setSelected(null); setQuantity(""); setPhysActual(""); setReason("")
      // Refresh search
      await searchBatches(dq)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Could not save.") }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Stock Adjustments" subtitle="Record damage, theft, expired write-offs and physical count corrections"/>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Search panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-slate-800 mb-3">Find Batch</h3>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>{setSearch(e.target.value);searchBatches(e.target.value)}}
                placeholder="Medicine name…" className="input pl-9 text-sm"/>
            </div>
            {loading && <div className="flex justify-center py-4"><Spinner/></div>}
            {batches.length > 0 && (
              <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                {batches.map(b => (
                  <button key={b.id} onClick={() => { setSelected(b); setQuantity(""); setPhysActual(String(b.quantity_on_hand)) }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${selected?.id===b.id?"bg-blue-50 border border-blue-200":"hover:bg-slate-50 border border-transparent"}`}>
                    <p className="font-medium text-slate-800">{b.medicine_name}</p>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-slate-400">Batch: {b.batch_number}</span>
                      <span className={`text-xs font-semibold ${b.quantity_on_hand<=0?"text-red-600":"text-slate-700"}`}>{b.quantity_on_hand} in stock</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!loading && dq.length >= 2 && batches.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-4">No batches found with stock.</p>
            )}
          </div>
        </div>

        {/* Adjustment form */}
        <div className="lg:col-span-3 space-y-4">
          {!selected ? (
            <div className="card p-8">
              <EmptyState icon={<Package size={40}/>} title="Select a batch" subtitle="Search and select a medicine batch on the left to adjust its stock."/>
            </div>
          ) : (
            <div className="card p-5 space-y-4">
              {/* Selected batch info */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="font-semibold text-blue-900">{selected.medicine_name}</p>
                <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
                  <div><p className="text-xs text-blue-500">Batch</p><p className="font-medium text-blue-800">{selected.batch_number}</p></div>
                  <div><p className="text-xs text-blue-500">Expires</p><p className="font-medium text-blue-800">{formatDate(selected.expiry_date)}</p></div>
                  <div><p className="text-xs text-blue-500">In Stock</p><p className="text-2xl font-bold text-blue-900">{selected.quantity_on_hand}</p></div>
                </div>
                {selected.rack_location && <p className="text-xs text-blue-500 mt-2">Rack: {selected.rack_location}</p>}
              </div>

              {/* Adjustment type */}
              <div>
                <label className="label">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ADJ_TYPES.map(a => (
                    <button key={a.id} onClick={() => setAdjType(a.id)}
                      className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-colors ${adjType===a.id?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200 hover:border-slate-300 text-slate-600"}`}>
                      <span className="text-lg">{a.icon}</span>{a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity input */}
              {adjType === "physical_count" ? (
                <div>
                  <label className="label">Actual Physical Count</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="0" value={physActual} onChange={e=>setPhysActual(e.target.value)} className="input text-xl font-bold w-32 text-center"/>
                    <div className="text-sm text-slate-500">
                      {physActual !== "" && parseInt(physActual) !== selected.quantity_on_hand && (
                        <div className={`flex items-center gap-1 font-medium ${parseInt(physActual) < selected.quantity_on_hand ? "text-red-600" : "text-green-600"}`}>
                          {parseInt(physActual) < selected.quantity_on_hand
                            ? <><Minus size={14}/>{selected.quantity_on_hand - parseInt(physActual)} shortage</>
                            : <><Plus size={14}/>{parseInt(physActual) - selected.quantity_on_hand} surplus</>}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">System shows {selected.quantity_on_hand} units. Enter what you physically counted.</p>
                </div>
              ) : (
                <div>
                  <label className="label">Quantity to Remove</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" max={selected.quantity_on_hand} value={quantity} onChange={e=>setQuantity(e.target.value)} className="input text-xl font-bold w-32 text-center"/>
                    <p className="text-sm text-slate-500">of {selected.quantity_on_hand} units</p>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="label">Reason <span className="text-red-500">*</span></label>
                <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={2}
                  placeholder={adjType==="damage"?"Describe damage…":adjType==="theft"?"Report details…":"Explain the adjustment…"}
                  className="input resize-none"/>
              </div>

              {adjType !== "physical_count" && quantity && parseInt(quantity) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm text-amber-800">
                    <AlertTriangle size={14} className="inline mr-1"/>
                    Estimated loss: <strong>{formatCurrency(parseInt(quantity) * selected.purchase_price)}</strong> at cost price
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1">
                  {saving ? <><Spinner size="sm"/>Saving…</> : <><ClipboardList size={15}/>Record Adjustment</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
