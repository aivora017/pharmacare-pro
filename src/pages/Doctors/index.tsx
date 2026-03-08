/**
 * Doctors — Doctor Profiles and Prescription Tracking
 * 
 * Page structure:
 * 1. Doctor list: name, specialisation, registration number, prescriptions count
 * 2. "Add Doctor" button → simple form
 * 3. Doctor detail: all fields + patient list + prescription history
 * Services: customerService.listDoctors(), customerService.createDoctor()

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function DoctorsPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="Doctors" subtitle="Doctor Profiles and Prescription Tracking" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="Doctors module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the Doctors page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
