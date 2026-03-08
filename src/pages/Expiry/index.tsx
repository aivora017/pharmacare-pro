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
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function ExpiryPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Expiry" subtitle="Expiry Check and Risk Dashboard" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Expiry module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Expiry page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
