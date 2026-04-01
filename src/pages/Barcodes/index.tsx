import { useState, useCallback } from "react"
import { Barcode, RefreshCw, Download, CheckCircle } from "lucide-react"
import toast from "react-hot-toast"
import { medicineService } from "@/services/medicineService"
import { barcodeService } from "@/services/barcodeService"
import { useAuthStore } from "@/store/authStore"
import { PageHeader } from "@/components/shared/PageHeader"
import { Spinner } from "@/components/shared/Spinner"

type BatchRow = { id: number; batch_number: string; barcode?: string; expiry_date: string; quantity_on_hand: number; medicine_name?: string }

export default function BarcodesPage() {
  const { user } = useAuthStore()
  const [search, setSearch] = useState("")
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState<Set<number>>(new Set())
  const [generated, setGenerated] = useState<Record<number,string>>({})

  const handleSearch = useCallback(async () => {
    if (!search.trim()) { toast.error("Enter a medicine name to search."); return }
    setLoading(true)
    try {
      const meds = await medicineService.search(search) as { id:number;name:string }[]
      if (meds.length === 0) { toast.error("No medicines found."); setBatches([]); return }
      const allBatches: BatchRow[] = []
      for (const med of meds.slice(0,10)) {
        const bs = await medicineService.listBatches(med.id) as BatchRow[]
        bs.forEach(b => allBatches.push({ ...b, medicine_name: med.name }))
      }
      setBatches(allBatches)
    } catch { toast.error("Could not fetch batches.") }
    finally { setLoading(false) }
  }, [search])

  const generateOne = async (batchId: number) => {
    setGenerating(p => new Set(p).add(batchId))
    try {
      const code = await barcodeService.generate(batchId)
      setGenerated(p => ({ ...p, [batchId]: code }))
      setBatches(p => p.map(b => b.id === batchId ? { ...b, barcode: code } : b))
      toast.success("Barcode generated.")
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error") }
    finally { setGenerating(p => { const s = new Set(p); s.delete(batchId); return s }) }
  }

  const generateAll = async () => {
    const without = batches.filter(b => !b.barcode)
    if (without.length === 0) { toast("All batches already have barcodes."); return }
    const ids = without.map(b => b.id)
    toast.loading(`Generating ${ids.length} barcodes…`, { id:"bulk" })
    try {
      const result = await barcodeService.generateBulk(ids) as { batch_id:number;barcode:string }[]
      const map: Record<number,string> = {}
      result.forEach(r => { map[r.batch_id] = r.barcode })
      setGenerated(p => ({ ...p, ...map }))
      setBatches(p => p.map(b => map[b.id] ? { ...b, barcode: map[b.id] } : b))
      toast.success(`${result.length} barcodes generated!`, { id:"bulk" })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Error", { id:"bulk" }) }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Barcode Management" subtitle="Generate and print barcodes for your medicine batches"/>

      <div className="card p-5">
        <h3 className="font-semibold text-slate-800 mb-3">Search Batches</h3>
        <div className="flex gap-3">
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()}
            placeholder="Enter medicine name…" className="input flex-1"/>
          <button onClick={handleSearch} disabled={loading} className="btn-primary">
            {loading?<><Spinner size="sm"/>Searching…</>:"Search"}
          </button>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">{batches.length} Batches Found</h3>
            <button onClick={generateAll} className="btn-secondary text-xs px-3 py-2">
              <RefreshCw size={14}/>Generate All Missing
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr className="text-xs text-slate-500 uppercase">
                <th className="text-left px-4 py-3">Medicine</th>
                <th className="text-left px-4 py-3">Batch</th>
                <th className="text-left px-4 py-3">Barcode</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr></thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="table-row">
                    <td className="px-4 py-3 font-medium text-slate-800">{b.medicine_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.batch_number}</td>
                    <td className="px-4 py-3">
                      {b.barcode ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-green-500 flex-shrink-0"/>
                          <span className="font-mono text-xs text-slate-700 bg-slate-50 px-2 py-1 rounded">{b.barcode}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not generated</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{b.quantity_on_hand}</td>
                    <td className="px-4 py-3 text-center">
                      {b.barcode ? (
                        <button onClick={()=>{navigator.clipboard.writeText(b.barcode!);toast.success("Copied!")}} className="text-xs text-blue-600 hover:underline">
                          <Download size={13}/> Copy
                        </button>
                      ) : (
                        <button onClick={()=>generateOne(b.id)} disabled={generating.has(b.id)} className="btn-primary text-xs px-3 py-1.5">
                          {generating.has(b.id)?<Spinner size="sm"/>:<><Barcode size={13}/>Generate</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
