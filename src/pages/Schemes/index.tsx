import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { schemeService, Scheme } from "@/services/schemeService"
import { useAuthStore } from "@/store/authStore"
import toast from "react-hot-toast"
import { Plus, Edit2, Trash2, X, Tag, ToggleLeft, ToggleRight } from "lucide-react"

function todayISO() { return new Date().toISOString().slice(0, 10) }

const BLANK: Partial<Scheme> = {
  name: "", scheme_type: "percent", value: 0,
  buy_quantity: 0, get_quantity: 0, min_bill_amount: 0,
  start_date: todayISO(), end_date: "", is_active: true, notes: ""
}

const TYPE_BADGE: Record<string, string> = {
  percent: "bg-blue-100 text-blue-700",
  flat: "bg-green-100 text-green-700",
  bxgy: "bg-purple-100 text-purple-700",
}
const TYPE_LABEL: Record<string, string> = {
  percent: "% Discount", flat: "Flat Off", bxgy: "Buy X Get Y"
}

export default function SchemesPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 1
  const [schemes, setSchemes] = useState<Scheme[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Scheme | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await schemeService.list(activeOnly)
      setSchemes(res.schemes)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [activeOnly])

  useEffect(() => { load() }, [load])

  const del = async (id: number) => {
    if (!confirm("Delete this scheme?")) return
    try { await schemeService.delete(id); toast.success("Scheme deleted"); load() }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  const toggleActive = async (s: Scheme) => {
    try {
      await schemeService.update(s.id, { ...s, is_active: !s.is_active })
      toast.success(s.is_active ? "Scheme deactivated" : "Scheme activated")
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  const describeScheme = (s: Scheme) => {
    if (s.scheme_type === 'percent') return `${s.value}% off${s.min_bill_amount > 0 ? ` on bills ≥ ₹${s.min_bill_amount}` : ''}`
    if (s.scheme_type === 'flat') return `₹${s.value} off${s.min_bill_amount > 0 ? ` on bills ≥ ₹${s.min_bill_amount}` : ''}`
    if (s.scheme_type === 'bxgy') return `Buy ${s.buy_quantity}, Get ${s.get_quantity} Free`
    return ""
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Schemes & Promotions" subtitle="Manage discounts, bulk offers and buy-get schemes" />

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="w-4 h-4 accent-blue-600" />
          Active only
        </label>
        <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Scheme
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : schemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Tag className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No schemes found. Create one to apply at billing.</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Offer</th>
                <th className="px-4 py-3 text-left">Applies To</th>
                <th className="px-4 py-3 text-left">Validity</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schemes.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {s.name}
                    {s.notes && <p className="text-xs text-slate-400">{s.notes}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[s.scheme_type] ?? ''}`}>
                      {TYPE_LABEL[s.scheme_type] ?? s.scheme_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{describeScheme(s)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {s.medicine_id ? s.medicine_name : "All Medicines"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {s.start_date ? `${s.start_date}` : ''}
                    {s.end_date ? ` → ${s.end_date}` : s.start_date ? ' onwards' : 'Always'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(s)} title={s.is_active ? "Deactivate" : "Activate"}>
                      {s.is_active
                        ? <ToggleRight className="w-6 h-6 text-green-500 mx-auto" />
                        : <ToggleLeft className="w-6 h-6 text-slate-400 mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(s); setShowModal(true) }} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(s.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <SchemeModal
          initial={editing ?? BLANK}
          userId={userId}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function SchemeModal({ initial, userId, onClose, onSaved }: {
  initial: Partial<Scheme>
  userId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Partial<Scheme>>({ ...BLANK, ...initial })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Scheme, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.name?.trim()) { toast.error("Scheme name is required"); return }
    if ((form.value ?? 0) <= 0 && form.scheme_type !== 'bxgy') { toast.error("Enter a valid value"); return }
    if (form.scheme_type === 'bxgy' && ((form.buy_quantity ?? 0) <= 0 || (form.get_quantity ?? 0) <= 0)) {
      toast.error("Enter buy and get quantities"); return
    }
    setSaving(true)
    try {
      if (initial.id) { await schemeService.update(initial.id, form); toast.success("Scheme updated") }
      else { await schemeService.create(form, userId); toast.success("Scheme created") }
      onSaved()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? "Edit Scheme" : "New Scheme"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Name *</label>
            <input type="text" value={form.name ?? ""} onChange={e => set('name', e.target.value)}
              className="input w-full" placeholder="e.g. Monsoon Sale 20% Off" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scheme Type</label>
            <div className="flex gap-2">
              {(['percent', 'flat', 'bxgy'] as const).map(t => (
                <button key={t} onClick={() => set('scheme_type', t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.scheme_type === t ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {form.scheme_type !== 'bxgy' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {form.scheme_type === 'percent' ? 'Discount %' : 'Flat Discount (₹)'}
                </label>
                <input type="number" min={0} step={form.scheme_type === 'percent' ? 1 : 0.01}
                  max={form.scheme_type === 'percent' ? 100 : undefined}
                  value={form.value ?? 0} onChange={e => set('value', Number(e.target.value))}
                  className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Bill Amount (₹)</label>
                <input type="number" min={0} step={0.01}
                  value={form.min_bill_amount ?? 0} onChange={e => set('min_bill_amount', Number(e.target.value))}
                  className="input w-full" placeholder="0 = no minimum" />
              </div>
            </div>
          )}

          {form.scheme_type === 'bxgy' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Buy Quantity</label>
                <input type="number" min={1} value={form.buy_quantity ?? 0}
                  onChange={e => set('buy_quantity', Number(e.target.value))} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Get Free Quantity</label>
                <input type="number" min={1} value={form.get_quantity ?? 0}
                  onChange={e => set('get_quantity', Number(e.target.value))} className="input w-full" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input type="date" value={form.start_date ?? ""} onChange={e => set('start_date', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input type="date" value={form.end_date ?? ""} onChange={e => set('end_date', e.target.value)} className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input type="text" value={form.notes ?? ""} onChange={e => set('notes', e.target.value)}
              className="input w-full" placeholder="Internal note (not shown to customer)" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.is_active ?? true}
              onChange={e => set('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
            Active (available at billing counter)
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : (initial.id ? "Update" : "Create Scheme")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
