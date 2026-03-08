/**
 * AI — AI Features Dashboard
 * 
 * Page structure:
 * 1. Morning Briefing card (Tier 1: SQL analytics, always available)
 * 2. Demand Forecast table (Tier 1) — top 20 medicines needing reorder
 * 3. Customer Segments (Tier 1) — Champion/Loyal/At-Risk/Dormant counts with lists
 * 4. Anomaly Alerts (Tier 1) — unreviewed anomalies list
 * 5. Ask PharmaCare (Tier 3: Claude API) — chat input, requires internet
 *    - Show placeholder with examples when no API key configured
 * 6. WhatsApp Message Composer (Tier 3) — select situation + customer → draft message
 *
 * Services: aiService, claudeService

 */
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'

export default function AIPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="AI" subtitle="AI Features Dashboard" />
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <EmptyState
          title="AI module — ready to build"
          subtitle="Open Copilot Chat and type the prompt below"
        />
        <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 font-medium">Copilot prompt:</p>
          <code className="text-xs text-slate-700">
            @workspace implement the AI page following .github/copilot-instructions.md
          </code>
        </div>
      </div>
    </div>
  )
}
