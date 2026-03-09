/**
 * Barcodes — Barcode Generation and Label Printing
 * 
 * EXCLUSIVE FEATURE: rack location encoded in barcode
 * Page structure:
 * 1. Tabs: "Generate" | "Print" | "Printers"
 * Generate tab:
 *   - Search medicine → select batch → preview barcode
 *   - Bulk generate: all batches without barcodes
 * Print tab:
 *   - Label template: medicine name, generic name, batch, expiry, rack, price
 *   - Quantity per label
 *   - Print queue management
 *   - Reprint failed labels
 * Printers tab:
 *   - Configure thermal printer (ESC/POS), barcode printer (ZPL), normal printer
 *   - Test print button per printer
 * Services: barcodeService, printerService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { barcodeService } from '@/services/barcodeService'
import {
  medicineService,
  type IBatchItem,
  type IMedicineListItem,
} from '@/services/medicineService'
import { printerService } from '@/services/printerService'

export default function BarcodesPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'print' | 'printers'>('generate')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<IMedicineListItem[]>([])
  const [selectedMedicine, setSelectedMedicine] = useState<IMedicineListItem | null>(null)
  const [batches, setBatches] = useState<IBatchItem[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([])
  const [lastBarcode, setLastBarcode] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [printers, setPrinters] = useState<string[]>([])

  useEffect(() => {
    let active = true
    if (query.trim().length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const rows = await medicineService.search({ query: query.trim(), sort: 'name_asc' })
        if (active) setResults(rows.slice(0, 10))
      } catch {
        if (active) toast.error('Could not search medicines.')
      } finally {
        if (active) setSearching(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const loadBatches = async (medicine: IMedicineListItem) => {
    setLoadingBatches(true)
    try {
      const rows = await medicineService.listBatches(medicine.id)
      setBatches(rows)
      setSelectedBatchIds([])
    } catch {
      toast.error('Could not load batches for selected medicine.')
    } finally {
      setLoadingBatches(false)
    }
  }

  const generateOne = async (batchId: number) => {
    setGenerating(true)
    try {
      const code = await barcodeService.generateForBatch(batchId)
      setLastBarcode(code)
      toast.success('Barcode generated.')
      if (selectedMedicine) await loadBatches(selectedMedicine)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not generate barcode.')
    } finally {
      setGenerating(false)
    }
  }

  const generateSelected = async () => {
    if (selectedBatchIds.length === 0) {
      toast.error('Select at least one batch.')
      return
    }
    setGenerating(true)
    try {
      const result = await barcodeService.generateBulk(selectedBatchIds)
      toast.success(`Generated ${result.total} barcode(s).`)
      if (selectedMedicine) await loadBatches(selectedMedicine)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not generate selected barcodes.')
    } finally {
      setGenerating(false)
    }
  }

  const generateAllMissing = async () => {
    setGenerating(true)
    try {
      const result = await barcodeService.generateBulk([])
      toast.success(`Generated ${result.total} missing barcode(s).`)
      if (selectedMedicine) await loadBatches(selectedMedicine)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not generate all missing barcodes.')
    } finally {
      setGenerating(false)
    }
  }

  const loadPrinters = async () => {
    try {
      const rows = await printerService.listPrinters()
      setPrinters(rows)
    } catch {
      toast.error('Could not load printers.')
    }
  }

  useEffect(() => {
    if (activeTab === 'printers') {
      void loadPrinters()
    }
  }, [activeTab])

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <PageHeader title="Barcodes" subtitle="Barcode Generation and Label Printing" />

      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'generate'
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Generate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('print')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'print' ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Print
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('printers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium min-h-touch ${
            activeTab === 'printers'
              ? 'bg-blue-600 text-white'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Printers
        </button>
      </div>

      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Select Medicine</h3>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search medicine"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
            />
            {searching && <p className="text-xs text-slate-500">Searching...</p>}
            <div className="border border-slate-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
              {results.length === 0 ? (
                <p className="text-sm text-slate-500 p-3">No medicines to show.</p>
              ) : (
                results.map((medicine) => (
                  <button
                    key={medicine.id}
                    type="button"
                    onClick={() => {
                      setSelectedMedicine(medicine)
                      void loadBatches(medicine)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-800">{medicine.name}</p>
                    <p className="text-xs text-slate-500">Stock: {medicine.total_stock}</p>
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                void generateAllMissing()
              }}
              disabled={generating}
              className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg px-3 py-2 text-sm font-semibold min-h-touch"
            >
              {generating ? 'Working...' : 'Generate All Missing Barcodes'}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {selectedMedicine ? `${selectedMedicine.name} Batches` : 'Batches'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  void generateSelected()
                }}
                disabled={generating || selectedBatchIds.length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg px-3 py-2 text-sm font-semibold min-h-touch"
              >
                Generate Selected ({selectedBatchIds.length})
              </button>
            </div>

            {loadingBatches ? (
              <LoadingSpinner text="Loading batches..." />
            ) : batches.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                Select a medicine to view batches.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-left text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2">Pick</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2">Expiry</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Barcode</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedBatchIds.includes(batch.id)}
                            onChange={(e) =>
                              setSelectedBatchIds((prev) =>
                                e.target.checked
                                  ? [...prev, batch.id]
                                  : prev.filter((id) => id !== batch.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-800">{batch.batch_number}</td>
                        <td className="px-3 py-2 text-slate-600">{batch.expiry_date}</td>
                        <td className="px-3 py-2 text-slate-600">{batch.quantity_on_hand}</td>
                        <td className="px-3 py-2 text-slate-600 font-mono">
                          {batch.barcode || '-'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              void generateOne(batch.id)
                            }}
                            disabled={generating}
                            className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50 min-h-touch"
                          >
                            Generate
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {lastBarcode && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Last generated</p>
                <p className="text-sm font-mono text-emerald-900">{lastBarcode}</p>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'print' ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-sm text-slate-700">
            Label print flow is available in backend command wiring. UI template designer is the
            next step.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Detected Printers</h3>
            <button
              type="button"
              onClick={() => {
                void loadPrinters()
              }}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 min-h-touch"
            >
              Refresh
            </button>
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {printers.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No printers detected.</p>
            ) : (
              printers.map((printer) => (
                <div key={printer} className="p-3">
                  <p className="text-sm text-slate-800">{printer}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
