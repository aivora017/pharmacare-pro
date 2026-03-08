/**
 * Medicine — Medicine Master — inventory list and batch management
 * 
 * Page structure (Copilot: implement each section):
 * 1. Header with search bar and "Add Medicine" button
 * 2. Filters: category, schedule (H/OTC/etc), stock status
 * 3. Medicine table: name, generic, schedule badge, total stock, reorder alert, expiry badge
 * 4. Click row → MedicineDetail drawer (batches, purchase history, alternates)
 * 5. Add/Edit Medicine form (drawer or modal) — all fields from IMedicine type
 * 6. Add Batch form: batch_number, expiry_date, quantity, purchase_price, selling_price, rack_location
 * 7. Barcode generate button per batch
 * 8. Low stock rows highlighted amber, out-of-stock rows highlighted red
 *
 * Services: medicineService.search(), medicineService.create(), medicineService.createBatch()

 */
import { PageHeader } from "@/components/shared/PageHeader"
import { EmptyState } from "@/components/shared/EmptyState"

export default function MedicinePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Medicine" subtitle="Medicine Master — inventory list and batch management" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Medicine module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">@workspace implement the Medicine page following .github/copilot-instructions.md</code>
        </div>
      </div>
    </div>
  )
}
