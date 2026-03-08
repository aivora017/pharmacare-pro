/**
 * Suppliers — Distributor/Supplier Management
 * 
 * Page structure:
 * 1. Supplier list: name, drug licence status (valid/expiring/expired), outstanding, reliability score
 * 2. "Add Supplier" button
 * 3. Supplier detail:
 *   - Profile: GSTIN, drug licence + expiry date, payment terms, credit limit
 *   - Email domain for auto-import detection
 *   - Purchase history, outstanding balance
 *   - Reliability score gauge (0-100, from aiService)
 *   - Payment record
 * Services: supplierService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function SuppliersPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Suppliers" subtitle="Distributor/Supplier Management" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Suppliers module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Suppliers page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
