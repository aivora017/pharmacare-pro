import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"
import { collectionService, OutstandingCustomer } from "@/services/collectionService"
import { useAuthStore } from "@/store/authStore"
import toast from "react-hot-toast"
import { IndianRupee, MessageCircle, History, X, ChevronDown } from "lucide-react"

function openWhatsAppReminder(c: OutstandingCustomer) {
  if (!c.phone) { toast.error("No phone number for this customer"); return }
  const phone = c.phone.replace(/\D/g, '')
  const msg = `Dear ${c.name}, this is a gentle reminder that you have an outstanding balance of ₹${c.outstanding_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })} at our pharmacy. Kindly clear the dues at your earliest convenience. Thank you.`
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
}

export default function CollectionsPage() {
  const { user } = useAuthStore()
  const userId = user?.id ?? 1
  const [data, setData] = useState<{ customers: OutstandingCustomer[]; count: number; total_outstanding: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [collectTarget, setCollectTarget] = useState<OutstandingCustomer | null>(null)
  const [historyTarget, setHistoryTarget] = useState<OutstandingCustomer | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await collectionService.listOutstanding()) }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <PageHeader title="Outstanding Collections" subtitle="Customers with pending dues — collect and send reminders" />

      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-5">
            <p className="text-xs text-slate-500">Customers with Dues</p>
            <p className="text-3xl font-bold text-slate-800">{data.count}</p>
          </div>
          <div className="card p-5 bg-red-50 border border-red-100">
            <p className="text-xs text-slate-500">Total Outstanding</p>
            <p className="text-3xl font-bold text-red-600">
              ₹{data.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !data || data.customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <IndianRupee className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">No outstanding dues</p>
            <p className="text-xs mt-1">All customer balances are clear.</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-center">Pending Bills</th>
                <th className="px-4 py-3 text-left">Last Bill</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    ₹{c.outstanding_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.pending_bills}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{c.last_bill_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setCollectTarget(c)}
                        className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <IndianRupee className="w-3 h-3" /> Collect
                      </button>
                      <button
                        onClick={() => openWhatsAppReminder(c)}
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                        title="Send WhatsApp reminder"
                      >
                        <MessageCircle className="w-3 h-3" /> Remind
                      </button>
                      <button
                        onClick={() => setHistoryTarget(c)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500"
                        title="View collection history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {collectTarget && (
        <CollectModal
          customer={collectTarget}
          userId={userId}
          onClose={() => setCollectTarget(null)}
          onCollected={() => { setCollectTarget(null); load() }}
        />
      )}

      {historyTarget && (
        <HistoryModal
          customer={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}

function CollectModal({ customer, userId, onClose, onCollected }: {
  customer: OutstandingCustomer
  userId: number
  onClose: () => void
  onCollected: () => void
}) {
  const [amount, setAmount] = useState(customer.outstanding_balance)
  const [mode, setMode] = useState("cash")
  const [refNo, setRefNo] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (amount <= 0) { toast.error("Enter a valid amount"); return }
    setSaving(true)
    try {
      await collectionService.record(customer.id, amount, mode, refNo, notes, userId)
      toast.success(`₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} collected from ${customer.name}`)
      onCollected()
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Collect Payment</h2>
            <p className="text-sm text-slate-500">{customer.name} · Due: <span className="font-semibold text-red-600">₹{customer.outstanding_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
            <input
              type="number" min={0.01} max={customer.outstanding_balance} step={0.01}
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="input w-full text-lg font-semibold"
            />
            <p className="text-xs text-slate-400 mt-1">Max: ₹{customer.outstanding_balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
            <select value={mode} onChange={e => setMode(e.target.value)} className="input w-full">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference No.</label>
            <input type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className="input w-full" placeholder="UPI/Cheque/Transfer ref" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input w-full" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm">
              {saving ? "Recording..." : "Record Collection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HistoryModal({ customer, onClose }: { customer: OutstandingCustomer; onClose: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    collectionService.history(customer.id)
      .then(setData)
      .catch(e => toast.error(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [customer.id])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Collection History</h2>
            <p className="text-sm text-slate-500">{customer.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">
          {loading ? <div className="flex justify-center py-8"><Spinner size="lg" /></div> : (
            data?.history?.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">No collection history yet.</p>
            ) : (
              <>
                <div className="mb-4 text-sm font-medium text-slate-700">
                  Total collected: <span className="text-green-600 font-bold">₹{data?.total_collected?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="space-y-2">
                  {data?.history?.map((h: any) => (
                    <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">₹{h.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                        <p className="text-xs text-slate-500">{h.payment_date} · {h.payment_mode}{h.reference_no ? ` · ${h.reference_no}` : ''}</p>
                        {h.notes && <p className="text-xs text-slate-400">{h.notes}</p>}
                      </div>
                      <p className="text-xs text-slate-400">{h.collected_by ?? 'Staff'}</p>
                    </div>
                  ))}
                </div>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}
