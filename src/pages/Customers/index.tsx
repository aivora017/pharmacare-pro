import { useEffect, useState, useCallback } from "react"
import { Plus, Search, Users, Edit, X, CreditCard, History, Phone, Mail } from "lucide-react"
import toast from "react-hot-toast"
import { customerService } from "@/services/customerService"
import { useAuthStore } from "@/store/authStore"
import { useDebounce } from "@/hooks/useDebounce"
import { formatDate } from "@/utils/date"
import { formatCurrency } from "@/utils/currency"
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Spinner } from "@/components/shared/Spinner"
import type { ICustomer } from "@/types"

export default function CustomersPage() {
  const { user } = useAuthStore()
  const uid = user?.id ?? 1
  const [customers, setCustomers] = useState<ICustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<ICustomer | null>(null)
  const [history, setHistory] = useState<unknown[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editCust, setEditCust] = useState<ICustomer | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const q = useDebounce(search, 300)

  const load = useCallback(async () => {
    setLoading(true)
    try { setCustomers(await customerService.search(q) as ICustomer[]) }
    catch { toast.error("Could not load customers.") }
    finally { setLoading(false) }
  }, [q])

  useEffect(() => { load() }, [load])

  const selectCustomer = async (c: ICustomer) => {
    setSelected(c)
    try {
      const full = await customerService.get(c.id) as ICustomer
      setSelected(full)
      const h = await customerService.getHistory(c.id, 20)
      setHistory(h as unknown[])
    } catch { setHistory([]) }
  }

  return (
    <div className="flex h-full -m-5 overflow-hidden">
      {/* List panel */}
      <div className="flex flex-col w-[380px] flex-shrink-0 border-r border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-slate-900">Patients</h1>
            <button onClick={() => { setEditCust(null); setShowForm(true) }} className="btn-primary text-xs px-3 py-2">
              <Plus size={14} /> Add
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name or phone…" className="input pl-9 py-2 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32"><Spinner /></div>
          ) : customers.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="No patients found"
              subtitle={q ? "Try a different search." : "Add your first patient."}
              action={<button onClick={() => { setEditCust(null); setShowForm(true) }} className="btn-primary text-sm"><Plus size={15} />Add Patient</button>} />
          ) : (
            <div className="divide-y divide-slate-100">
              {customers.map(c => (
                <button key={c.id} onClick={() => selectCustomer(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${selected?.id === c.id ? "bg-blue-50 border-r-2 border-blue-600" : ""}`}>
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-blue-700">{c.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.phone ?? "No phone"}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {c.outstanding_balance > 0 && (
                      <p className="text-xs font-semibold text-red-600">₹{c.outstanding_balance.toFixed(0)} due</p>
                    )}
                    {c.loyalty_points > 0 && (
                      <p className="text-xs text-green-600">{c.loyalty_points} pts</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Users size={48} className="text-slate-200 mb-3" />
            <p className="font-medium">Select a patient</p>
            <p className="text-sm mt-1">Click any patient on the left to view details</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-4 animate-fade-in">
            <div className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-700">{selected.name[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      {selected.phone && <span className="flex items-center gap-1 text-sm text-slate-500"><Phone size={13} />{selected.phone}</span>}
                      {selected.email && <span className="flex items-center gap-1 text-sm text-slate-500"><Mail size={13} />{selected.email}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditCust(selected); setShowForm(true) }} className="btn-ghost text-xs"><Edit size={14} />Edit</button>
                  {selected.outstanding_balance > 0 && (
                    <button onClick={() => setShowPayment(true)} className="btn-primary text-xs px-3 py-2"><CreditCard size={14} />Collect Payment</button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-slate-100">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{formatCurrency(selected.loyalty_points * 0.1)}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{selected.loyalty_points} loyalty pts</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${selected.outstanding_balance > 0 ? "bg-red-50" : "bg-green-50"}`}>
                  <p className={`text-2xl font-bold ${selected.outstanding_balance > 0 ? "text-red-700" : "text-green-700"}`}>{formatCurrency(selected.outstanding_balance)}</p>
                  <p className={`text-xs mt-0.5 ${selected.outstanding_balance > 0 ? "text-red-600" : "text-green-600"}`}>outstanding</p>
                </div>
                {selected.date_of_birth && <div><p className="text-xs text-slate-500">Date of Birth</p><p className="text-sm font-medium mt-0.5">{formatDate(selected.date_of_birth)}</p></div>}
                {selected.blood_group && <div><p className="text-xs text-slate-500">Blood Group</p><p className="text-sm font-bold text-red-600 mt-0.5">{selected.blood_group}</p></div>}
              </div>

              {(Array.isArray(selected.allergies) && selected.allergies.length > 0) && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Known Allergies</p>
                  <div className="flex flex-wrap gap-1">
                    {selected.allergies.map((a, i) => <span key={i} className="badge-amber text-xs">{String(a)}</span>)}
                  </div>
                </div>
              )}

              {selected.notes && <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{selected.notes}</p>}
            </div>

            {/* Purchase History */}
            <div className="card">
              <div className="flex items-center gap-2 p-4 border-b border-slate-100">
                <History size={16} className="text-slate-500" />
                <h3 className="font-semibold text-slate-800">Purchase History</h3>
              </div>
              {history.length === 0 ? (
                <div className="py-10 text-center text-slate-400"><p className="text-sm">No purchase history yet.</p></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {(history as Record<string, unknown>[]).map(bill => (
                    <div key={String(bill.id)} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{String(bill.bill_number)}</p>
                        <p className="text-xs text-slate-500">{formatDate(String(bill.bill_date))} · {Number(bill.item_count)} items</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(Number(bill.net_amount))}</p>
                        {Number(bill.outstanding) > 0 && <p className="text-xs text-red-600">Due: {formatCurrency(Number(bill.outstanding))}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <CustomerForm customer={editCust} uid={uid}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); if (editCust && selected?.id === editCust.id) selectCustomer(editCust) }} />
      )}

      {showPayment && selected && (
        <PaymentCollector
          customer={selected} uid={uid}
          onClose={() => setShowPayment(false)}
          onSaved={async () => {
            setShowPayment(false)
            const updated = await customerService.get(selected.id) as ICustomer
            setSelected(updated)
            load()
          }} />
      )}
    </div>
  )
}

function CustomerForm({ customer, uid, onClose, onSaved }: { customer: ICustomer | null; uid: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: customer?.name ?? "", phone: customer?.phone ?? "",
    phone2: (customer as Record<string,unknown>)?.phone2 as string ?? "",
    email: customer?.email ?? "", date_of_birth: customer?.date_of_birth ?? "",
    gender: customer?.gender ?? "", blood_group: customer?.blood_group ?? "",
    address: customer?.address ?? "", notes: customer?.notes ?? "",
  })
  const [saving, setSaving] = useState(false)

  const f = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("Name is required."); return }
    setSaving(true)
    try {
      if (customer) await customerService.update(customer.id, form, uid)
      else await customerService.create(form, uid)
      toast.success(customer ? "Patient updated." : "Patient added.")
      onSaved()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not save.") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-slate-900">{customer ? "Edit Patient" : "Add New Patient"}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => f("name")(e.target.value)} placeholder="Patient name" className="input" autoFocus />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={form.phone} onChange={e => f("phone")(e.target.value)} placeholder="Mobile number" className="input" />
            </div>
            <div>
              <label className="label">Alt Phone</label>
              <input value={form.phone2} onChange={e => f("phone2")(e.target.value)} placeholder="Optional" className="input" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={form.email} onChange={e => f("email")(e.target.value)} placeholder="email@example.com" className="input" />
            </div>
            <div>
              <label className="label">Date of Birth</label>
              <input type="date" value={form.date_of_birth} onChange={e => f("date_of_birth")(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Gender</label>
              <select value={form.gender} onChange={e => f("gender")(e.target.value)} className="input">
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="label">Blood Group</label>
              <select value={form.blood_group} onChange={e => f("blood_group")(e.target.value)} className="input">
                <option value="">Select</option>
                {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input value={form.address} onChange={e => f("address")(e.target.value)} placeholder="Full address" className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea value={form.notes} onChange={e => f("notes")(e.target.value)} rows={2} placeholder="Any special notes about this patient…" className="input resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <><Spinner size="sm" />{customer ? "Updating…" : "Adding…"}</> : customer ? "Update Patient" : "Add Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentCollector({ customer, uid, onClose, onSaved }: { customer: ICustomer; uid: number; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("")
  const [saving, setSaving] = useState(false)

  const handlePay = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error("Enter a valid amount."); return }
    if (amt > customer.outstanding_balance) { toast.error(`Cannot collect more than outstanding balance (${formatCurrency(customer.outstanding_balance)}).`); return }
    setSaving(true)
    try {
      await customerService.recordPayment(customer.id, amt, uid)
      toast.success(`Payment of ${formatCurrency(amt)} recorded.`)
      onSaved()
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : "Could not record payment.") }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-900">Collect Payment</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="bg-red-50 rounded-xl p-4 mb-5 text-center">
          <p className="text-xs text-red-600 mb-1">Outstanding Balance — {customer.name}</p>
          <p className="text-3xl font-bold text-red-700">{formatCurrency(customer.outstanding_balance)}</p>
        </div>
        <div className="mb-5">
          <label className="label">Amount Received (₹)</label>
          <input type="number" autoFocus value={amount} onChange={e => setAmount(e.target.value)}
            placeholder={customer.outstanding_balance.toFixed(2)} className="input text-xl font-semibold" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handlePay} disabled={saving} className="btn-primary flex-1">
            {saving ? <><Spinner size="sm" />Saving…</> : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  )
}
