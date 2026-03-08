/**
 * Settings — App Configuration and User Management
 * 
 * Tabs: Pharmacy Info | Printers | Email Import | Users | License | Backup
 *
 * Pharmacy Info: name, GSTIN, drug licence, address, phone, logo upload
 * Printers: thermal printer name, normal printer, barcode printer, test buttons
 * Email Import: IMAP config (host, port, email, password stored in keychain), test connection
 * Users: list users, add user, change role, deactivate
 * License: show status (trial/active/expired), enter license key, machine info
 * Backup: auto-backup schedule, manual backup now, backup list, restore
 *
 * Services: settingsService, printerService, backupService, licenseService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function SettingsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Settings" subtitle="App Configuration and User Management" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Settings module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Settings page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
