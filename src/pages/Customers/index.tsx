/**
 * Customers — Customer Profiles and Purchase History
 * 
 * Page structure:
 * 1. Search by name or phone (large search input — most common action)
 * 2. Customer list with: name, phone, outstanding balance (red if > 0), last visit
 * 3. "Add Customer" button
 * 4. Customer detail (click row):
 *   - Demographics: name, phone, DOB, gender, blood group
 *   - Allergies list (editable chip list)
 *   - Chronic conditions (editable chip list)
 *   - Purchase history timeline (bills list)
 *   - Outstanding balance + payment button
 *   - Loyalty points balance
 *   - Drug interactions warning for their allergy profile
 *   - Assigned doctor
 *   - Med sync date
 *   - Communication preferences (WhatsApp/SMS/email)
 * Services: customerService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function CustomersPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Customers" subtitle="Customer Profiles and Purchase History" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Customers module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Customers page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
