/**
 * Purchase — Purchase Bills and PO Management
 * 
 * Page structure:
 * 1. Tabs: "Bills" | "Purchase Orders" | "Email Import"
 * Bills tab:
 *   - List of purchase bills with supplier, date, amount, payment status badge
 *   - Filters: date range, supplier, payment status
 *   - "Add Bill" button → AddPurchaseBill form
 *   - AddPurchaseBill: select supplier, date, then add line items (medicine, batch, qty, price)
 * Email Import tab:
 *   - Setup IMAP config (host, port, email, password — stored in OS keychain)
 *   - "Fetch Now" button → shows list of detected invoices
 *   - Review & import each detected invoice
 *   - Import history table
 * Services: purchaseService, supplierService, emailImportService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function PurchasePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Purchase" subtitle="Purchase Bills and PO Management" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Purchase module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Purchase page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
