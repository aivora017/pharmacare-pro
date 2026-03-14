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
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { barcodeService } from '@/services/barcodeService'
import {
  medicineService,
  type IBatchItem,
  type IMedicineListItem,
} from '@/services/medicineService'
import { printerService, type IPrintJobItem } from '@/services/printerService'
import { useAuthStore } from '@/store/authStore'

export default function BarcodesPage() {
  const user = useAuthStore((state) => state.user)
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
  const [printBatchIds, setPrintBatchIds] = useState<number[]>([])
  const [printQuantity, setPrintQuantity] = useState<number>(1)
  const [printing, setPrinting] = useState(false)
  const [printJobs, setPrintJobs] = useState<IPrintJobItem[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState('System Default')
  const [testingPrinter, setTestingPrinter] = useState('')
  const [testPrinterType, setTestPrinterType] = useState<'thermal' | 'normal' | 'barcode'>(
    'barcode'
  )
  const [templateFields, setTemplateFields] = useState({
    generic: true,
    batch: true,
    expiry: true,
    rack: true,
    price: true,
  })

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
      setPrintBatchIds([])
    } catch {
      toast.error('Could not load batches for selected medicine.')
    } finally {
      setLoadingBatches(false)
    }
  }

  const generateOne = async (batchId: number) => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    setGenerating(true)
    try {
      const code = await barcodeService.generateForBatch(batchId, user.id)
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
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    if (selectedBatchIds.length === 0) {
      toast.error('Select at least one batch.')
      return
    }
    setGenerating(true)
    try {
      const result = await barcodeService.generateBulk(selectedBatchIds, user.id)
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
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    setGenerating(true)
    try {
      const result = await barcodeService.generateBulk([], user.id)
      toast.success(`Generated ${result.total} missing barcode(s).`)
      if (selectedMedicine) await loadBatches(selectedMedicine)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not generate all missing barcodes.')
    } finally {
      setGenerating(false)
    }
  }

  const loadPrinters = useCallback(async () => {
    if (!user) {
      setPrinters([])
      return
    }
    try {
      const rows = await printerService.listPrinters(user.id)
      setPrinters(rows)
      if (rows.length > 0 && !rows.includes(selectedPrinter)) {
        setSelectedPrinter(rows[0])
      }
    } catch {
      toast.error('Could not load printers.')
    }
  }, [selectedPrinter, user])

  const loadPrintJobs = useCallback(async () => {
    if (!user) {
      setPrintJobs([])
      return
    }
    setLoadingJobs(true)
    try {
      const payload = await printerService.listJobs(user.id)
      setPrintJobs(payload.items)
    } catch {
      toast.error('Could not load print queue.')
    } finally {
      setLoadingJobs(false)
    }
  }, [user])

  const printSelectedLabels = async () => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    if (!selectedMedicine) {
      toast.error('Select a medicine in Generate tab first.')
      return
    }
    if (printBatchIds.length === 0) {
      toast.error('Select at least one batch to print labels.')
      return
    }
    if (printQuantity < 1 || printQuantity > 100) {
      toast.error('Quantity per batch must be between 1 and 100.')
      return
    }

    const byId = new Map(batches.map((batch) => [batch.id, batch]))
    const selected = printBatchIds
      .map((batchId) => byId.get(batchId))
      .filter((batch): batch is IBatchItem => Boolean(batch))

    if (selected.length === 0) {
      toast.error('Selected batches are not available. Refresh and try again.')
      return
    }

    const labels = selected.flatMap((batch) =>
      Array.from({ length: printQuantity }, () => ({
        medicine_name: selectedMedicine.name,
        generic_name: templateFields.generic ? selectedMedicine.generic_name : null,
        batch_number: templateFields.batch ? batch.batch_number : null,
        expiry_date: templateFields.expiry ? batch.expiry_date : null,
        rack_location: templateFields.rack ? (batch.rack_location ?? '-') : null,
        selling_price: templateFields.price ? batch.selling_price : null,
        barcode: batch.barcode ?? '',
      }))
    )

    setPrinting(true)
    try {
      await barcodeService.printLabels(labels, selectedPrinter, user.id)
      toast.success(`Queued ${labels.length} label(s) for print.`)
      await loadPrintJobs()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not queue labels for printing.')
    } finally {
      setPrinting(false)
    }
  }

  const requeueJob = async (fileName: string) => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    try {
      await printerService.requeueJob(fileName, selectedPrinter, user.id)
      toast.success('Print job requeued.')
      await loadPrintJobs()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not requeue print job.')
    }
  }

  const testPrint = async (printerName: string) => {
    if (!user) {
      toast.error('Session expired. Please login again.')
      return
    }
    setTestingPrinter(printerName)
    try {
      await printerService.testPrint(printerName, testPrinterType, user.id)
      toast.success(`Test print queued for ${printerName}.`)
      await loadPrintJobs()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(message || 'Could not run test print.')
    } finally {
      setTestingPrinter('')
    }
  }

  useEffect(() => {
    if (activeTab === 'printers' || activeTab === 'print') {
      void loadPrinters()
      void loadPrintJobs()
    }
  }, [activeTab, loadPrinters, loadPrintJobs])

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Label Template</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateFields.generic}
                  onChange={(e) =>
                    setTemplateFields((prev) => ({ ...prev, generic: e.target.checked }))
                  }
                />
                Show Generic Name
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateFields.batch}
                  onChange={(e) =>
                    setTemplateFields((prev) => ({ ...prev, batch: e.target.checked }))
                  }
                />
                Show Batch
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateFields.expiry}
                  onChange={(e) =>
                    setTemplateFields((prev) => ({ ...prev, expiry: e.target.checked }))
                  }
                />
                Show Expiry
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateFields.rack}
                  onChange={(e) =>
                    setTemplateFields((prev) => ({ ...prev, rack: e.target.checked }))
                  }
                />
                Show Rack Location
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={templateFields.price}
                  onChange={(e) =>
                    setTemplateFields((prev) => ({ ...prev, price: e.target.checked }))
                  }
                />
                Show Price
              </label>
            </div>

            <label className="block text-sm text-slate-700">
              Printer
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              >
                {printers.length === 0 ? (
                  <option>System Default</option>
                ) : (
                  printers.map((printer) => <option key={printer}>{printer}</option>)
                )}
              </select>
            </label>

            <label className="block text-sm text-slate-700">
              Quantity Per Batch
              <input
                type="number"
                min={1}
                max={100}
                value={printQuantity}
                onChange={(e) => setPrintQuantity(Number(e.target.value || 1))}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                void printSelectedLabels()
              }}
              disabled={printing || printBatchIds.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg px-3 py-2 text-sm font-semibold min-h-touch"
            >
              {printing ? 'Queueing Labels...' : `Queue Labels (${printBatchIds.length} Batch)`}
            </button>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Batch Selection For Print</h3>
              <button
                type="button"
                onClick={() => {
                  if (selectedMedicine) {
                    void loadBatches(selectedMedicine)
                  }
                }}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 min-h-touch"
              >
                Refresh Batches
              </button>
            </div>

            {selectedMedicine ? (
              <p className="text-xs text-slate-600">
                Printing for <span className="font-semibold">{selectedMedicine.name}</span>
              </p>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Select a medicine from the Generate tab first. Its batches will be used for label
                printing.
              </p>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs text-slate-500 uppercase">
                    <th className="px-3 py-2">Pick</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Expiry</th>
                    <th className="px-3 py-2">Rack</th>
                    <th className="px-3 py-2">Barcode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                        No batches available for printing.
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={printBatchIds.includes(batch.id)}
                            onChange={(e) =>
                              setPrintBatchIds((prev) =>
                                e.target.checked
                                  ? [...prev, batch.id]
                                  : prev.filter((id) => id !== batch.id)
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-slate-800">{batch.batch_number}</td>
                        <td className="px-3 py-2 text-slate-600">{batch.expiry_date}</td>
                        <td className="px-3 py-2 text-slate-600">{batch.rack_location || '-'}</td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {batch.barcode || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between p-3 border-b border-slate-200">
                <h4 className="text-sm font-semibold text-slate-800">Print Queue</h4>
                <button
                  type="button"
                  onClick={() => {
                    void loadPrintJobs()
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-50 min-h-touch"
                >
                  Refresh Queue
                </button>
              </div>
              {loadingJobs ? (
                <div className="p-3">
                  <LoadingSpinner text="Loading print queue..." />
                </div>
              ) : printJobs.length === 0 ? (
                <p className="text-sm text-slate-500 p-3">No queued print jobs.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {printJobs.slice(0, 10).map((job) => (
                    <div
                      key={job.file_name}
                      className="p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm text-slate-800 font-medium">{job.file_name}</p>
                        <p className="text-xs text-slate-500">
                          {job.size_bytes} bytes | {job.job_type ?? 'print'} | {job.printer_type || 'default'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Status: <span className="font-medium uppercase">{job.status ?? 'queued'}</span>
                          {' | '}Retries: {job.retry_count ?? 0}
                        </p>
                        {job.last_error && (
                          <p className="text-xs text-red-600 break-all">Error: {job.last_error}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void requeueJob(job.file_name)
                        }}
                        className="px-3 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 min-h-touch"
                      >
                        Retry
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Detected Printers</h3>
            <div className="flex items-center gap-2">
              <select
                value={testPrinterType}
                onChange={(e) =>
                  setTestPrinterType(e.target.value as 'thermal' | 'normal' | 'barcode')
                }
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-touch"
              >
                <option value="barcode">Barcode</option>
                <option value="thermal">Thermal</option>
                <option value="normal">Normal</option>
              </select>
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
          </div>
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {printers.length === 0 ? (
              <p className="text-sm text-slate-500 p-3">No printers detected.</p>
            ) : (
              printers.map((printer) => (
                <div key={printer} className="p-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-800">{printer}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void testPrint(printer)
                    }}
                    disabled={testingPrinter === printer}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-300 hover:bg-slate-50 min-h-touch"
                  >
                    {testingPrinter === printer ? 'Queueing...' : 'Test Print'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
