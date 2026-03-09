/**
 * Expiry — Expiry Check and Risk Dashboard
 * 
 * EXCLUSIVE FEATURE: scan barcode → instantly see expiry + rack location
 * Page structure:
 * 1. Big barcode scan input at top (always focused, auto-clears after scan)
 * 2. After scan: show card with medicine name, batch, expiry date, rack location, stock qty, supplier
 * 3. Below: Expiry risk dashboard
 *   - Summary: critical (red), high (amber), medium (yellow) count cards
 *   - Table of batches sorted by risk level then expiry date
 *   - Columns: medicine, batch, expiry, qty, risk level badge, action suggested
 *   - "Build Return List" button → generate PDF of items to return to supplier
 * Services: inventoryService.getExpiryList(), aiService.getExpiryRisks()

 */
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PageHeader } from '@/components/shared/PageHeader'
import { inventoryService } from '@/services/inventoryService'
import { medicineService, type IBatchItem } from '@/services/medicineService'

type ExpiryRow = IBatchItem & {
  medicine_name?: string
  supplier_name?: string
}

function daysToExpiry(expiryDate: string) {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const ms = expiry.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

function riskForRow(row: ExpiryRow) {
  const days = daysToExpiry(row.expiry_date)
  if (days < 0) return { level: 'critical', label: 'Expired', action: 'Return or dispose immediately' }
  if (days <= 30) return { level: 'critical', label: 'Critical', action: 'Push sale / return to supplier' }
  if (days <= 60) return { level: 'high', label: 'High', action: 'Place on priority shelf' }
  if (days <= 90) return { level: 'medium', label: 'Medium', action: 'Track weekly' }
  return { level: 'low', label: 'Low', action: 'Normal monitoring' }
}

function riskBadge(level: string) {
  if (level === 'critical') return 'bg-rose-100 text-rose-700 border-rose-200'
  if (level === 'high') return 'bg-amber-100 text-amber-700 border-amber-200'
  if (level === 'medium') return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

export default function ExpiryPage() {
  const [withinDays, setWithinDays] = useState(90)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ExpiryRow[]>([])
  const [scanInput, setScanInput] = useState('')
  const [scanned, setScanned] = useState<ExpiryRow | null>(null)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const scanRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await inventoryService.getExpiryList(withinDays)
      setRows(result as ExpiryRow[])
    } catch {
      toast.error('Could not load expiry list.')
    } finally {
      setLoading(false)
    }
  }, [withinDays])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    scanRef.current?.focus()
  }, [])

  const summary = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 }
    for (const row of rows) {
      const risk = riskForRow(row)
      counts[risk.level as keyof typeof counts] += 1
    }
    return counts
  }, [rows])

  const sortedRows = useMemo(() => {
    const weight: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    return [...rows].sort((a, b) => {
      const ra = riskForRow(a)
      const rb = riskForRow(b)
      const score = weight[ra.level] - weight[rb.level]
      if (score !== 0) return score
      return a.expiry_date.localeCompare(b.expiry_date)
    })
  }, [rows])

  const selectedRows = useMemo(
    () => sortedRows.filter((row) => selected[row.id]),
    [selected, sortedRows]
  )

  const scanBarcode = async (event: FormEvent) => {
    event.preventDefault()
    const barcode = scanInput.trim()
    if (!barcode) return

    try {
      const batch = await medicineService.getBatchByBarcode(barcode)
      const medicine = await medicineService.get(batch.medicine_id)
      const row: ExpiryRow = {
        ...batch,
        medicine_name: medicine.name,
      }
      setScanned(row)
      setSelected((prev) => ({ ...prev, [batch.id]: true }))
      setScanInput('')
      toast.success('Batch scanned and added to return list.')
    } catch {
      toast.error('Barcode not found.')
    }
  }

  const buildReturnList = () => {
    if (selectedRows.length === 0) {
      toast.error('Select at least one batch for return list.')
      return
    }

    const lines = [
      'medicine_name,batch_number,expiry_date,quantity_on_hand,risk_level,supplier_name',
      ...selectedRows.map((row) => {
        const risk = riskForRow(row)
        return [
          row.medicine_name ?? '',
          row.batch_number,
          row.expiry_date,
          row.quantity_on_hand,
          risk.label,
          row.supplier_name ?? '',
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      }),
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `expiry-return-list-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Return list downloaded.')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Expiry" subtitle="Expiry Check and Risk Dashboard" />

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <form onSubmit={scanBarcode} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-3">
            <label className="text-xs text-slate-500">Scan Barcode</label>
            <input
              ref={scanRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Scan or type barcode, then press Enter"
              className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Within Days</label>
            <input
              type="number"
              min={1}
              value={withinDays}
              onChange={(e) => setWithinDays(Math.max(1, Number(e.target.value) || 90))}
              className="w-full min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="min-h-touch rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-semibold"
          >
            Check Batch
          </button>
        </form>

        {scanned && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{scanned.medicine_name ?? 'Unknown medicine'}</p>
            <p className="text-xs text-slate-600 mt-1">
              Batch: {scanned.batch_number} | Expiry: {scanned.expiry_date} | Rack:{' '}
              {scanned.rack_location || '-'} | Qty: {scanned.quantity_on_hand}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs text-rose-700">Critical</p>
          <p className="text-2xl font-bold text-rose-800">{summary.critical}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-700">High</p>
          <p className="text-2xl font-bold text-amber-800">{summary.high}</p>
        </div>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-xs text-yellow-700">Medium</p>
          <p className="text-2xl font-bold text-yellow-800">{summary.medium}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs text-emerald-700">Low</p>
          <p className="text-2xl font-bold text-emerald-800">{summary.low}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Expiry Risk Table</h3>
          <button
            type="button"
            onClick={buildReturnList}
            className="min-h-touch rounded-lg bg-rose-700 hover:bg-rose-800 text-white px-3 py-2 text-sm font-semibold"
          >
            Build Return List ({selectedRows.length})
          </button>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading expiry data..." />
        ) : sortedRows.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No expiring batches found in selected window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Select</th>
                  <th className="px-3 py-2">Medicine</th>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.map((row) => {
                  const risk = riskForRow(row)
                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[row.id])}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-slate-800 font-medium">{row.medicine_name || '-'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.batch_number}</td>
                      <td className="px-3 py-2 text-slate-600">{row.expiry_date}</td>
                      <td className="px-3 py-2 text-slate-600">{row.quantity_on_hand}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full border text-xs font-medium ${riskBadge(risk.level)}`}
                        >
                          {risk.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{risk.action}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
