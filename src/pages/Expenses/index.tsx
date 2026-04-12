import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { expenseService, Expense, EXPENSE_CATEGORIES } from "@/services/expenseService"
import { useAuthStore } from "@/store/authStore"
import toast from "react-hot-toast"
import { Plus, Edit2, Trash2, X, Receipt } from "lucide-react"

function todayISO() { return new Date().toISOString().slice(0, 10) }
function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const BLANK_EXPENSE: Partial<Expense> = {
  expense_date: todayISO(), category: "General", description: "",
  amount: 0, payment_mode: "cash", reference_no: "", vendor_name: "", notes: ""
}

const TABS = ["Expenses", "Cash Book", "Summary"] as const
type Tab = typeof TABS[number]

export default function ExpensesPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 1
  const [activeTab, setActiveTab] = useState<Tab>("Expenses")

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses & Cash Book" subtitle="Track pharmacy expenses and daily cash position" />
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              activeTab === tab ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {activeTab === "Expenses" && <ExpensesTab userId={userId} />}
      {activeTab === "Cash Book" && <CashBookTab />}
      {activeTab === "Summary" && <SummaryTab />}
    </div>
  )
}

function ExpensesTab({ userId }: { userId: number }) {
  const [from, setFrom] = useState(monthStartISO())
  const [to, setTo] = useState(todayISO())
  const [category, setCategory] = useState("")
  const [data, setData] = useState<{ expenses: Expense[]; count: number; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await expenseService.list(from, to, category || undefined)
      setData(res)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [from, to, category])

  useEffect(() => { load() }, [load])

  const del = async (id: number) => {
    if (!confirm("Delete this expense?")) return
    try {
      await expenseService.delete(id)
      toast.success("Expense deleted")
      load()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="input text-sm py-1.5">
              <option value="">All Categories</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ml-auto">
            <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Expense
            </button>
          </div>
        </div>
        {data && (
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">{data.count} expenses</span>
            <span className="text-sm font-semibold text-slate-800">Total: ₹{data.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : !data || data.expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Receipt className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">No expenses found</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Vendor</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Mode</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.expenses.map(exp => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{exp.expense_date}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-medium text-slate-600">{exp.category}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{exp.description}</td>
                  <td className="px-4 py-3 text-slate-500">{exp.vendor_name || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    ₹{exp.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${exp.payment_mode === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {exp.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => { setEditing(exp); setShowModal(true) }} className="p-1 hover:bg-slate-100 rounded text-slate-500">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(exp.id)} className="p-1 hover:bg-red-50 rounded text-red-400">
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
        <ExpenseModal
          initial={editing ?? BLANK_EXPENSE}
          userId={userId}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </div>
  )
}

function ExpenseModal({ initial, userId, onClose, onSaved }: {
  initial: Partial<Expense>
  userId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<Partial<Expense>>({ ...BLANK_EXPENSE, ...initial })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof Expense, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.description) { toast.error("Description is required"); return }
    if (!form.amount || form.amount <= 0) { toast.error("Enter a valid amount"); return }
    setSaving(true)
    try {
      if (initial.id) {
        await expenseService.update(initial.id, form)
        toast.success("Expense updated")
      } else {
        await expenseService.create(form, userId)
        toast.success("Expense added")
      }
      onSaved()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">{initial.id ? "Edit Expense" : "Add Expense"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="input w-full">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)} className="input w-full" placeholder="e.g. Monthly rent payment" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" min={0} step="0.01" value={form.amount} onChange={e => set('amount', Number(e.target.value))} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
              <select value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)} className="input w-full">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Name</label>
              <input type="text" value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)} className="input w-full" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
              <input type="text" value={form.reference_no} onChange={e => set('reference_no', e.target.value)} className="input w-full" placeholder="Invoice/receipt no." />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)} className="input w-full" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? "Saving..." : (initial.id ? "Update" : "Add Expense")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CashBookTab() {
  const [from, setFrom] = useState(monthStartISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await expenseService.cashBook(from, to)
      setData(res)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-1.5" />
          </div>
        </div>
      </div>
      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="card p-5">
            <p className="text-xs text-slate-500 mb-1">Cash In (Sales)</p>
            <p className="text-2xl font-bold text-green-600">₹{data.cash_sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-slate-500 mb-1">Cash Out (Expenses)</p>
            <p className="text-2xl font-bold text-red-500">₹{data.cash_expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-slate-500 mb-1">Cash Out (Purchases)</p>
            <p className="text-2xl font-bold text-amber-600">₹{data.cash_purchases.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className={`card p-5 ${data.net_cash >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <p className="text-xs text-slate-500 mb-1">Net Cash</p>
            <p className={`text-2xl font-bold ${data.net_cash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              ₹{data.net_cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryTab() {
  const [from, setFrom] = useState(monthStartISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await expenseService.summary(from, to)
      setData(res)
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm py-1.5" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm py-1.5" />
          </div>
        </div>
      </div>
      {loading && <div className="flex justify-center py-12"><Spinner size="lg" /></div>}
      {data && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between">
            <span className="font-semibold text-slate-700">Expense by Category</span>
            <span className="font-bold text-slate-800">Total: ₹{data.grand_total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Count</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.by_category.map((row: any) => (
                <tr key={row.category} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.category}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{row.count}</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{row.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {data.grand_total > 0 ? `${((row.total / data.grand_total) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
