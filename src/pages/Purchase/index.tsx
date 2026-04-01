import { useEffect, useState, useCallback } from "react"
import { Plus, Package, Truck, Search, X, ChevronDown, ChevronUp } from "lucide-react"
import toast from "react-hot-toast"
import { purchaseService, supplierService } from "@/services/purchaseService"
import { useAuthStore } from "@/store/authStore"
import { useDebounce } from "@/hooks/useDebounce"
import { formatDate, formatForInput } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Spinner } from "@/components/shared/Spinner"
import type { ISupplier } from "@/types"

type Tab = "bills" | "suppliers"
type Bill = { id: number; bill_number: string; supplier_name: string; bill_date: string; total_amount: number; amount_paid: number; payment_status: string }

export default function PurchasePage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const [tab, setTab] = useState<Tab>("bills")

  return (
    <div className="space-y-5">
      <PageHeader title="Purchase Management" subtitle="Track supplier bills and manage supplier accounts" />

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([["bills", "Purchase Bills", Package], ["suppliers", "Suppliers", Truck]] as [Tab, string, React.ComponentType<{size:number}>][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {tab === "bills" ? <PurchaseBillsTab uid={uid} /> : <SuppliersTab uid={uid} />}
    </div>
  )
}

function PurchaseBillsTab({ uid }: { uid: number }) {
  const [bills, setBills] = useState<Bill[]>([])
  const [suppliers, setSuppliers] = useState<ISupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, s] = await Promise.all([
        purchaseService.listBills({ payment_status: filterStatus }),
        supplierService.list(),
      ])
      const data = b as { bills: Bill[] }
      setBills(data.bills ?? [])
      setSuppliers(s as ISupplier[])
    } catch { toast.error("Could not load purchase bills.") }
    finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-800">Purchase Bills</h2>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1 outline-none">
            <option value="">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} />Add Bill
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : bills.length === 0 ? (
        <EmptyState icon={<Package size={40} />} title="No purchase bills" subtitle="Add a purchase bill to track supplier invoices."
          action={<button onClick={() => setShowForm(true)} className="btn-primary text-sm"><Plus size={15} />Add Bill</button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Bill No</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-center px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bills.map(b => (
                <tr key={b.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{b.bill_number}</td>
                  <td className="px-4 py-3 text-slate-800">{b.supplier_name}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(b.bill_date)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(b.total_amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(b.amount_paid)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={b.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AddBillForm suppliers={suppliers} uid={uid}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function SuppliersTab({ uid }: { uid: number }) {
  const [suppliers, setSuppliers] = useState<ISupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [editSupplier, setEditSupplier] = useState<ISupplier | null>(null)
  const q = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSuppliers(await supplierService.list() as ISupplier[]) }
    catch { toast.error("Could not load suppliers.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = suppliers.filter(s =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) ||
    (s.phone ?? "").includes(q)
  )

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-800">Suppliers</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers…" className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button onClick={() => { setEditSupplier(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} />Add Supplier
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Truck size={40} />} title="No suppliers" subtitle="Add your medicine distributors and suppliers."
          action={<button onClick={() => { setEditSupplier(null); setShowForm(true) }} className="btn-primary text-sm"><Plus size={15} />Add Supplier</button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">GSTIN</th>
                <th className="text-left px-4 py-3">Drug Lic. Expiry</th>
                <th className="text-right px-4 py-3">Outstanding</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="table-row">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{s.name}</p>
                    {s.contact_person && <p className="text-xs text-slate-500">{s.contact_person}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.phone ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.gstin ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{s.drug_licence_expiry ? formatDate(s.drug_licence_expiry) : "—"}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${s.outstanding_balance > 0 ? "text-red-600" : "text-slate-600"}`}>
                    {formatCurrency(s.outstanding_balance)}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge status={s.is_active ? "active" : "inactive"} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditSupplier(s); setShowForm(true) }} className="text-xs text-blue-600 hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <SupplierForm supplier={editSupplier} uid={uid}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function AddBillForm({ suppliers, uid, onClose, onSaved }: { suppliers: ISupplier[]; uid: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ bill_number: "", supplier_id: "", bill_date: formatForInput(new Date().toISOString()), due_date: "", total_amount: "", amount_paid: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.bill_number || !form.supplier_id || !form.total_amount) { toast.error("Bill number, supplier and amount are required."); return }
    setSaving(true)
    try {
      await purchaseService.createBill({ ...form, supplier_id: parseInt(form.supplier_id), total_amount: parseFloat(form.total_amount), amount_paid: parseFloat(form.amount_paid) || 0 }, uid)
      toast.success("Purchase bill added.")
      onSaved()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not save.") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Add Purchase Bill</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bill Number <span className="text-red-500">*</span></label>
              <input value={form.bill_number} onChange={e => f("bill_number")(e.target.value)} placeholder="INV-2025-001" className="input" autoFocus />
            </div>
            <div>
              <label className="label">Supplier <span className="text-red-500">*</span></label>
              <select value={form.supplier_id} onChange={e => f("supplier_id")(e.target.value)} className="input">
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bill Date</label>
              <input type="date" value={form.bill_date} onChange={e => f("bill_date")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => f("due_date")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Total Amount (₹) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" value={form.total_amount} onChange={e => f("total_amount")(e.target.value)} placeholder="0.00" className="input" />
            </div>
            <div>
              <label className="label">Amount Paid (₹)</label>
              <input type="number" min="0" step="0.01" value={form.amount_paid} onChange={e => f("amount_paid")(e.target.value)} placeholder="0.00" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input value={form.notes} onChange={e => f("notes")(e.target.value)} placeholder="Optional notes…" className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <><Spinner size="sm" />Adding…</> : "Add Bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SupplierForm({ supplier, uid, onClose, onSaved }: { supplier: ISupplier | null; uid: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "", contact_person: supplier?.contact_person ?? "",
    phone: supplier?.phone ?? "", email: supplier?.email ?? "",
    gstin: supplier?.gstin ?? "", drug_licence_no: supplier?.drug_licence_no ?? "",
    drug_licence_expiry: supplier?.drug_licence_expiry ? formatForInput(supplier.drug_licence_expiry) : "",
    payment_terms: String(supplier?.payment_terms ?? 30),
    credit_limit: String(supplier?.credit_limit ?? 0),
    is_active: supplier?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Supplier name required."); return }
    setSaving(true)
    try {
      const data = { ...form, payment_terms: parseInt(form.payment_terms) || 30, credit_limit: parseFloat(form.credit_limit) || 0 }
      if (supplier) await supplierService.update(supplier.id, data, uid)
      else await supplierService.create(data, uid)
      toast.success(supplier ? "Supplier updated." : "Supplier added.")
      onSaved()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not save.") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900">{supplier ? "Edit Supplier" : "Add Supplier"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => f("name")(e.target.value)} placeholder="Supplier name" className="input" autoFocus />
            </div>
            <div>
              <label className="label">Contact Person</label>
              <input value={form.contact_person} onChange={e => f("contact_person")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => f("phone")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={e => f("email")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input value={form.gstin} onChange={e => f("gstin")(e.target.value)} placeholder="22AAAAA0000A1Z5" className="input font-mono" />
            </div>
            <div>
              <label className="label">Drug Licence No.</label>
              <input value={form.drug_licence_no} onChange={e => f("drug_licence_no")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Licence Expiry</label>
              <input type="date" value={form.drug_licence_expiry} onChange={e => f("drug_licence_expiry")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Payment Terms (days)</label>
              <input type="number" value={form.payment_terms} onChange={e => f("payment_terms")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Credit Limit (₹)</label>
              <input type="number" value={form.credit_limit} onChange={e => f("credit_limit")(e.target.value)} className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <><Spinner size="sm" />{supplier ? "Updating…" : "Adding…"}</> : supplier ? "Update" : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
