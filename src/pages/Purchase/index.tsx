import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { medicineService } from '@/services/medicineService'
import { emailImportService, type IEmailImportRow } from '@/services/emailImportService'
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

type PurchaseReturnForm = {
  debit_note_no: string
  supplier_id?: number
  return_date: string
  reason: string
  total_amount: number
  notes: string
}

type EmailParsedRow = {
  medicine_name: string
  batch_number: string
  quantity: number
  unit_price: number
  expiry_date: string
  matched_medicine_id?: number
  matched_medicine_name?: string
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
  const [creatingReturn, setCreatingReturn] = useState(false)
  const [activeTab, setActiveTab] = useState<'bills' | 'po' | 'email'>('bills')
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
  const [returnForm, setReturnForm] = useState<PurchaseReturnForm>({
    debit_note_no: '',
    supplier_id: undefined,
    return_date: todayISODate(),
    reason: '',
    total_amount: 0,
    notes: '',
  })

  const [importRows, setImportRows] = useState<IEmailImportRow[]>([])
  const [rawCsvRows, setRawCsvRows] = useState<Record<string, string>[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [parsedRows, setParsedRows] = useState<EmailParsedRow[]>([])
  const [isImportingBill, setIsImportingBill] = useState(false)
  const [isAutoMatching, setIsAutoMatching] = useState(false)
  const [selectedImportSupplierId, setSelectedImportSupplierId] = useState<number | undefined>(undefined)
  const [mapping, setMapping] = useState({
    medicine_name: '',
    batch_number: '',
    quantity: '',
    unit_price: '',
    expiry_date: '',
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

      if (activeTab === 'email') {
        const logs = await emailImportService.listImports()
        setImportRows(logs)
      }
    } catch {
      toast.error('Could not load purchase data.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter, supplierFilter])

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

  const handleCreateReturn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!returnForm.debit_note_no.trim()) {
      toast.error('Debit note number is required.')
      return
    }
    if (!returnForm.supplier_id) {
      toast.error('Please select a supplier.')
      return
    }
    if (returnForm.total_amount <= 0) {
      toast.error('Return amount must be greater than zero.')
      return
    }

    setCreatingReturn(true)
    try {
      await purchaseService.createReturn(
        {
          debit_note_no: returnForm.debit_note_no.trim(),
          supplier_id: returnForm.supplier_id,
          return_date: returnForm.return_date,
          reason: returnForm.reason.trim() || undefined,
          total_amount: returnForm.total_amount,
          notes: returnForm.notes.trim() || undefined,
        },
        user.id
      )
      toast.success('Debit note created.')
      setReturnForm({
        debit_note_no: '',
        supplier_id: undefined,
        return_date: todayISODate(),
        reason: '',
        total_amount: 0,
        notes: '',
      })
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not create debit note.')
    } finally {
      setCreatingReturn(false)
    }
  }

  const handleCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const lower = file.name.toLowerCase()
    let rows: Record<string, string>[] = []
    if (lower.endsWith('.csv')) {
      const text = await file.text()
      const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
      if (result.errors.length > 0) {
        toast.error('Could not parse CSV file.')
        return
      }
      rows = (result.data ?? []).filter((row) => Object.keys(row).length > 0)
    } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const firstSheet = workbook.SheetNames[0]
      if (!firstSheet) {
        toast.error('No sheets found in Excel file.')
        return
      }
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
        defval: '',
      })
      rows = jsonRows.map((row) => {
        const normalized: Record<string, string> = {}
        for (const key of Object.keys(row)) {
          normalized[key] = String(row[key] ?? '').trim()
        }
        return normalized
      })
    } else {
      toast.error('Please upload CSV or Excel (.xlsx/.xls).')
      return
    }

    setRawCsvRows(rows)
    const columns = Object.keys(rows[0] ?? {})
    setCsvColumns(columns)
    setMapping({
      medicine_name: columns.find((c) => /medicine|item|product/i.test(c)) ?? '',
      batch_number: columns.find((c) => /batch/i.test(c)) ?? '',
      quantity: columns.find((c) => /qty|quantity/i.test(c)) ?? '',
      unit_price: columns.find((c) => /price|rate|cost/i.test(c)) ?? '',
      expiry_date: columns.find((c) => /expiry|exp/i.test(c)) ?? '',
    })
    toast.success(`Loaded ${rows.length} rows from CSV.`)
  }

  const handleBuildReview = () => {
    if (!mapping.medicine_name || !mapping.quantity || !mapping.unit_price) {
      toast.error('Please map medicine, quantity, and unit price columns.')
      return
    }

    const rows: EmailParsedRow[] = rawCsvRows.map((row) => ({
      medicine_name: String(row[mapping.medicine_name] ?? '').trim(),
      batch_number: String(row[mapping.batch_number] ?? '').trim(),
      quantity: Number(row[mapping.quantity] ?? 0) || 0,
      unit_price: Number(row[mapping.unit_price] ?? 0) || 0,
      expiry_date: String(row[mapping.expiry_date] ?? '').trim(),
    }))
    setParsedRows(rows.filter((row) => row.medicine_name && row.quantity > 0 && row.unit_price > 0))
  }

  const handleAutoMatch = async () => {
    if (parsedRows.length === 0) {
      toast.error('Build review rows first.')
      return
    }

    setIsAutoMatching(true)
    try {
      const uniqueNames = [...new Set(parsedRows.map((row) => row.medicine_name))]
      const map = new Map<string, { id?: number; name?: string }>()

      await Promise.all(
        uniqueNames.map(async (name) => {
          const matches = await medicineService.search({ query: name, sort: 'name_asc' })
          const top = matches[0]
          map.set(name, top ? { id: top.id, name: top.name } : {})
        })
      )

      setParsedRows((prev) =>
        prev.map((row) => ({
          ...row,
          matched_medicine_id: map.get(row.medicine_name)?.id,
          matched_medicine_name: map.get(row.medicine_name)?.name,
        }))
      )
      toast.success('Auto-match completed.')
    } catch {
      toast.error('Could not auto-match medicines.')
    } finally {
      setIsAutoMatching(false)
    }
  }

  const handleImportReviewed = async () => {
    if (!user) {
      toast.error('Please login again.')
      return
    }
    if (!selectedImportSupplierId) {
      toast.error('Select a supplier for this invoice.')
      return
    }
    if (parsedRows.length === 0) {
      toast.error('No parsed rows to import.')
      return
    }

    const total = parsedRows.reduce((sum, row) => sum + row.quantity * row.unit_price, 0)
    if (total <= 0) {
      toast.error('Total amount must be greater than zero.')
      return
    }

    setIsImportingBill(true)
    try {
      const billNo = `IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-5)}`
      await purchaseService.createBill(
        {
          bill_number: billNo,
          supplier_id: selectedImportSupplierId,
          bill_date: todayISODate(),
          total_amount: Number(total.toFixed(2)),
          amount_paid: 0,
          notes: `Imported from CSV review with ${parsedRows.length} line(s)`,
        },
        user.id
      )
      toast.success('Invoice imported as purchase bill.')
      setParsedRows([])
      setRawCsvRows([])
      await loadData()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not import invoice.')
    } finally {
      setIsImportingBill(false)
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
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'email' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Email Import
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
      ) : activeTab === 'po' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
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

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Purchase Return / Debit Note</h3>
            <form className="space-y-3" onSubmit={handleCreateReturn}>
              <input
                value={returnForm.debit_note_no}
                onChange={(e) =>
                  setReturnForm((prev) => ({ ...prev, debit_note_no: e.target.value }))
                }
                placeholder="Debit note number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <select
                value={returnForm.supplier_id ?? ''}
                onChange={(e) =>
                  setReturnForm((prev) => ({
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
                  value={returnForm.return_date}
                  onChange={(e) => setReturnForm((prev) => ({ ...prev, return_date: e.target.value }))}
                  type="date"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
                <input
                  value={returnForm.total_amount}
                  onChange={(e) =>
                    setReturnForm((prev) => ({ ...prev, total_amount: Number(e.target.value) || 0 }))
                  }
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Return amount"
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
                />
              </div>
              <input
                value={returnForm.reason}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Reason"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
              <textarea
                value={returnForm.notes}
                onChange={(e) => setReturnForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="Notes"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creatingReturn}
                className="w-full bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
              >
                {creatingReturn ? 'Saving...' : 'Create Debit Note'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-1 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Invoice Parser</h3>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleCsvFile}
              className="w-full text-sm"
            />
            <div className="grid grid-cols-1 gap-2">
              {Object.keys(mapping).map((key) => (
                <label key={key} className="text-xs text-slate-600">
                  {key}
                  <select
                    value={mapping[key as keyof typeof mapping]}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1 text-sm min-h-touch"
                  >
                    <option value="">Select column</option>
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleBuildReview}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
            >
              Build Review
            </button>
            <button
              type="button"
              onClick={handleAutoMatch}
              disabled={isAutoMatching}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
            >
              {isAutoMatching ? 'Matching...' : 'Auto-match Medicines'}
            </button>
            <select
              value={selectedImportSupplierId ?? ''}
              onChange={(e) =>
                setSelectedImportSupplierId(e.target.value ? Number(e.target.value) : undefined)
              }
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            >
              <option value="">Supplier for import</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleImportReviewed}
              disabled={isImportingBill}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg px-4 py-2 text-sm font-semibold min-h-touch"
            >
              {isImportingBill ? 'Importing...' : 'Import as Purchase Bill'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 xl:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Review Parsed Rows</h3>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
              {parsedRows.length === 0 ? (
                <p className="text-sm text-slate-500 p-4">No parsed rows yet.</p>
              ) : (
                parsedRows.map((row, index) => (
                  <div key={`${row.medicine_name}-${index}`} className="px-3 py-2">
                    <input
                      value={row.medicine_name}
                      onChange={(e) =>
                        setParsedRows((prev) => {
                          const next = [...prev]
                          next[index] = { ...next[index], medicine_name: e.target.value }
                          return next
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm min-h-touch"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                      <input
                        value={row.batch_number}
                        onChange={(e) =>
                          setParsedRows((prev) => {
                            const next = [...prev]
                            next[index] = { ...next[index], batch_number: e.target.value }
                            return next
                          })
                        }
                        placeholder="Batch"
                        className="border border-slate-300 rounded px-2 py-1 text-xs min-h-touch"
                      />
                      <input
                        value={row.quantity}
                        onChange={(e) =>
                          setParsedRows((prev) => {
                            const next = [...prev]
                            next[index] = { ...next[index], quantity: Number(e.target.value) || 0 }
                            return next
                          })
                        }
                        type="number"
                        min={0}
                        placeholder="Qty"
                        className="border border-slate-300 rounded px-2 py-1 text-xs min-h-touch"
                      />
                      <input
                        value={row.unit_price}
                        onChange={(e) =>
                          setParsedRows((prev) => {
                            const next = [...prev]
                            next[index] = { ...next[index], unit_price: Number(e.target.value) || 0 }
                            return next
                          })
                        }
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Unit price"
                        className="border border-slate-300 rounded px-2 py-1 text-xs min-h-touch"
                      />
                      <input
                        value={row.expiry_date}
                        onChange={(e) =>
                          setParsedRows((prev) => {
                            const next = [...prev]
                            next[index] = { ...next[index], expiry_date: e.target.value }
                            return next
                          })
                        }
                        placeholder="Expiry"
                        className="border border-slate-300 rounded px-2 py-1 text-xs min-h-touch"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Matched: {row.matched_medicine_name || 'Not matched'}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Import Log</h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
                {importRows.length === 0 ? (
                  <p className="text-sm text-slate-500 p-4">No import logs yet.</p>
                ) : (
                  importRows.map((row) => (
                    <div key={row.id} className="px-3 py-2">
                      <p className="text-xs text-slate-700">{row.email_from}</p>
                      <p className="text-xs text-slate-500">
                        {row.email_subject || 'No subject'} | {row.status || 'pending'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
