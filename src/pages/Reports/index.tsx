/**
 * Reports — Reports and CA Annual Package
 * 
 * EXCLUSIVE FEATURE: one-click CA package ZIP (no Indian software has this)
 * Page structure:
 * 1. Sidebar of report types (highlight current)
 * 2. Date range picker (from/to)
 * 3. Report preview area with export buttons (PDF, Excel)
 *
 * Report types:
 * - Sales Report (daily/monthly/medicine-wise/doctor-wise)
 * - Purchase Report (supplier-wise)
 * - Stock Report (current valuation)
 * - GST Report (GSTR-1, GSTR-3B, HSN summary)
 * - Profit & Loss
 * - Audit Trail
 *
 * CA Package section (bottom):
 * - Financial year selector
 * - "Generate CA Package" big button → ZIP of all annual reports
 * - Shows progress bar during generation
 *
 * Services: reportService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function ReportsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Reports" subtitle="Reports and CA Annual Package" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Reports module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Reports page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
