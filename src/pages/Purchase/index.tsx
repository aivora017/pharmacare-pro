import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { purchaseService, supplierService } from '@/services/supplierService'
import { useAuthStore } from '@/store/authStore'
import type { IPurchaseBill, ISupplier } from '@/types'

type PurchaseListResponse = { bills: IPurchaseBill[]; total: number }

type PurchaseForm = {
  bill_number: string
  supplier_id?: number
  bill_date: string
  due_date: string
  total_amount: number
  amount_paid: number
  notes: string
}

type PurchaseOrderForm = {
  po_number: string
  supplier_id?: number
  expected_by: string
  total_amount: number
  notes: string
}

function paymentBadge(status: string) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-700'
  if (status === 'partial') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

export default function PurchasePage() {
  const user = useAuthStore((state) => state.user)
  const [suppliers, setSuppliers] = useState<ISupplier[]>([])
  const [rows, setRows] = useState<IPurchaseBill[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [creatingPo, setCreatingPo] = useState(false)
  const [activeTab, setActiveTab] = useState<'bills' | 'po'>('bills')
  const [supplierFilter, setSupplierFilter] = useState<number | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState<PurchaseForm>({
    bill_number: '',
    supplier_id: undefined,
    bill_date: todayISODate(),
    due_date: '',
    total_amount: 0,
    amount_paid: 0,
    notes: '',
  })
  const [poForm, setPoForm] = useState<PurchaseOrderForm>({
    po_number: '',
    supplier_id: undefined,
    expected_by: '',
    total_amount: 0,
    notes: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [supplierRows, purchaseRows] = await Promise.all([
        supplierService.list(),
        purchaseService.listBills({ supplier_id: supplierFilter, payment_status: statusFilter }),
      ])

      const list = purchaseRows as PurchaseListResponse
      setSuppliers(supplierRows)
      setRows(list.bills ?? [])
    } catch {
      toast.error('Could not load purchase data.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, supplierFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const supplierMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const supplier of suppliers) map.set(supplier.id, supplier.name)
    return map
  }, [suppliers])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!form.bill_number.trim()) {
      toast.error('Purchase bill number is required.')
      return
    }
    if (!form.supplier_id) {
      toast.error('Please select a supplier.')
      return
    }
    if (form.total_amount <= 0) {
      toast.error('Total amount must be greater than zero.')
      return
    }

    setCreating(true)
    try {
      await purchaseService.createBill(
        {
          bill_number: form.bill_number.trim(),
          supplier_id: form.supplier_id,
          bill_date: form.bill_date,
          due_date: form.due_date || undefined,
          total_amount: form.total_amount,
          amount_paid: form.amount_paid,
          notes: form.notes.trim() || undefined,
        },
        user.id
      )
      toast.success('Purchase bill saved.')
      setForm({
        bill_number: '',
        supplier_id: undefined,
        bill_date: todayISODate(),
        due_date: '',
        total_amount: 0,
        amount_paid: 0,
        notes: '',
      })
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not save purchase bill.')
    } finally {
      setCreating(false)
    }
  }

  const handleCreatePo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!poForm.po_number.trim()) {
      toast.error('Purchase order number is required.')
      return
    }
    if (!poForm.supplier_id) {
      toast.error('Please select a supplier.')
      return
    }

    setCreatingPo(true)
    try {
      await purchaseService.createPO(
        {
          po_number: poForm.po_number.trim(),
          supplier_id: poForm.supplier_id,
          expected_by: poForm.expected_by || undefined,
          total_amount: poForm.total_amount || undefined,
          notes: poForm.notes.trim() || undefined,
        },
        user.id
      )
      toast.success('Purchase order created.')
      setPoForm({
        po_number: '',
        supplier_id: undefined,
        expected_by: '',
        total_amount: 0,
        notes: '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create purchase order.')
    } finally {
      setCreatingPo(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Purchase" subtitle="Manual purchase bill entry and tracking" />

      <div className="bg-white rounded-xl border border-slate-200 p-2 inline-flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('bills')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'bills' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Bills
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('po')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'po' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Purchase Orders
        </button>
      </div>

      {activeTab === 'bills' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-1">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Purchase Bill</h3>
            <form className="space-y-2" onSubmit={handleCreate}>
              <input
                value={form.bill_number}
                onChange={(e) => setForm((prev) => ({ ...prev, bill_number: e.target.value }))}
                placeholder="Bill number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <select
                value={form.supplier_id ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    supplier_id: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.bill_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, bill_date: e.target.value }))}
                  type="date"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                  type="date"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={form.total_amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, total_amount: Number(e.target.value) || 0 }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Total amount"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={form.amount_paid}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount_paid: Number(e.target.value) || 0 }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount paid"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
              </div>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Notes"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creating}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
              >
                {creating ? 'Saving...' : 'Save Purchase Bill'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-2">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <select
                value={supplierFilter ?? ''}
                onChange={(e) =>
                  setSupplierFilter(e.target.value ? Number(e.target.value) : undefined)
                }
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              >
                <option value="">All suppliers</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              >
                <option value="">All payment status</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {loading ? (
              <div className="py-10">
                <LoadingSpinner text="Loading purchase bills..." />
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
                {rows.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">No purchase bills found.</p>
                ) : (
                  rows.map((row) => (
                    <div key={row.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{row.bill_number}</p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${paymentBadge(
                            row.payment_status
                          )}`}
                        >
                          {row.payment_status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {supplierMap.get(row.supplier_id) ?? row.supplier_name ?? 'Supplier'} |{' '}
                        {new Date(row.bill_date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-600">
                        Total: Rs {row.total_amount.toFixed(2)} | Paid: Rs{' '}
                        {row.amount_paid.toFixed(2)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-3xl">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Create Purchase Order</h3>
          <form className="space-y-3" onSubmit={handleCreatePo}>
            <input
              value={poForm.po_number}
              onChange={(e) => setPoForm((prev) => ({ ...prev, po_number: e.target.value }))}
              placeholder="PO number"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
            <select
              value={poForm.supplier_id ?? ''}
              onChange={(e) =>
                setPoForm((prev) => ({
                  ...prev,
                  supplier_id: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={poForm.expected_by}
                onChange={(e) => setPoForm((prev) => ({ ...prev, expected_by: e.target.value }))}
                type="date"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <input
                value={poForm.total_amount}
                onChange={(e) =>
                  setPoForm((prev) => ({ ...prev, total_amount: Number(e.target.value) || 0 }))
                }
                type="number"
                min={0}
                step="0.01"
                placeholder="Expected total"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
            </div>
            <textarea
              value={poForm.notes}
              onChange={(e) => setPoForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Notes"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={creatingPo}
              className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
            >
              {creatingPo ? 'Saving...' : 'Create Purchase Order'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
