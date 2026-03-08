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
import { EmptyState } from '@/components/shared/EmptyState'

export default function BarcodesPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Barcodes" subtitle="Barcode Generation and Label Printing" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Barcodes module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Barcodes page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
