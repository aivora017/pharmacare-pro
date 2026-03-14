import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { aiService, type ICustomerSegmentRow } from '@/services/aiService'
import { claudeService } from '@/services/claudeService'
import { customerService } from '@/services/customerService'
import type { IAnomaly, IBriefingAction, IDemandForecast } from '@/types'
import { formatCurrency, formatNumber } from '@/utils/currency'

interface ICustomerOption {
  id: number
  name: string
  phone?: string
}

function segmentLabel(segment: ICustomerSegmentRow['segment']): string {
  if (segment === 'at_risk') return 'At Risk'
  return segment.charAt(0).toUpperCase() + segment.slice(1)
}

export default function AIPage() {
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)
  const [briefingActions, setBriefingActions] = useState<IBriefingAction[]>([])
  const [forecastRows, setForecastRows] = useState<IDemandForecast[]>([])
  const [segmentRows, setSegmentRows] = useState<ICustomerSegmentRow[]>([])
  const [anomalyRows, setAnomalyRows] = useState<IAnomaly[]>([])

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isAsking, setIsAsking] = useState(false)

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerOptions, setCustomerOptions] = useState<ICustomerOption[]>([])
  const [selectedCustomerName, setSelectedCustomerName] = useState('')
  const [selectedSituation, setSelectedSituation] = useState('Refill reminder')
  const [composerDetails, setComposerDetails] = useState('Your medicines are ready for pickup.')
  const [draftMessage, setDraftMessage] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const segmentSummary = useMemo(() => {
    const base: Record<ICustomerSegmentRow['segment'], number> = {
      champion: 0,
      loyal: 0,
      at_risk: 0,
      dormant: 0,
      new: 0,
    }
    for (const row of segmentRows) {
      base[row.segment] += 1
    }
    return base
  }, [segmentRows])

  useEffect(() => {
    const loadInsights = async () => {
      try {
        setIsLoadingInsights(true)
        const [briefing, forecast, segments, anomalies] = await Promise.all([
          aiService.getMorningBriefing(),
          aiService.getDemandForecast(),
          aiService.getCustomerSegments(),
          aiService.getAnomalies(),
        ])
        setBriefingActions(briefing.actions ?? [])
        setForecastRows(forecast ?? [])
        setSegmentRows(segments ?? [])
        setAnomalyRows(anomalies ?? [])
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not load AI dashboard.'
        toast.error(message)
      } finally {
        setIsLoadingInsights(false)
      }
    }

    void loadInsights()
  }, [])

  useEffect(() => {
    const q = customerQuery.trim()
    if (q.length < 2) {
      setCustomerOptions([])
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        const rows = await customerService.search(q)
        if (!active) return
        setCustomerOptions(
          rows.slice(0, 8).map((row) => ({ id: row.id, name: row.name, phone: row.phone }))
        )
      } catch {
        if (!active) return
        setCustomerOptions([])
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [customerQuery])

  const askPharmaCare = async () => {
    const q = question.trim()
    if (!q) {
      toast.error('Enter a question first.')
      return
    }

    try {
      setIsAsking(true)
      const result = await claudeService.askQuestion(q)
      setAnswer(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not fetch AI answer.'
      toast.error(message)
    } finally {
      setIsAsking(false)
    }
  }

  const composeMessage = async () => {
    const customerName = selectedCustomerName.trim()
    if (!customerName) {
      toast.error('Select a customer name first.')
      return
    }

    try {
      setIsComposing(true)
      const draft = await claudeService.composeMessage(selectedSituation, customerName, {
        details: composerDetails.trim() || 'Please contact us for details.',
      })
      setDraftMessage(draft)
      toast.success('WhatsApp draft generated.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not compose message.'
      toast.error(message)
    } finally {
      setIsComposing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader title="AI" subtitle="AI Features Dashboard" />

      {isLoadingInsights ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10">
          <LoadingSpinner text="Loading AI insights..." />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Morning Briefing</h3>
            <div className="mt-3 space-y-2">
              {briefingActions.length === 0 ? (
                <p className="text-sm text-slate-500">No briefing actions for now.</p>
              ) : (
                briefingActions.map((item, idx) => (
                  <div
                    key={`${item.message}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-slate-800">{item.message}</p>
                    <p className="text-xs text-slate-500 capitalize">Priority: {item.priority}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Demand Forecast (Top Items)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Medicine</th>
                    <th className="px-4 py-3 text-right font-medium">Current Stock</th>
                    <th className="px-4 py-3 text-right font-medium">30-Day Forecast</th>
                    <th className="px-4 py-3 text-right font-medium">Recommended Order</th>
                    <th className="px-4 py-3 text-left font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastRows.map((row) => (
                    <tr key={row.medicine_id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-800">{row.medicine_name}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {formatNumber(row.current_stock)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">
                        {formatNumber(row.forecast_30day)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatNumber(row.recommended_order)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 capitalize">{row.trend}</td>
                    </tr>
                  ))}
                  {forecastRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No forecast data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Customer Segments</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  Champion: {segmentSummary.champion}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  Loyal: {segmentSummary.loyal}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  At Risk: {segmentSummary.at_risk}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  Dormant: {segmentSummary.dormant}
                </div>
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto space-y-1.5">
                {segmentRows.slice(0, 20).map((row) => (
                  <div
                    key={row.customer_id}
                    className="rounded border border-slate-200 px-2 py-1.5"
                  >
                    <p className="text-sm font-medium text-slate-800">{row.customer_name}</p>
                    <p className="text-xs text-slate-500">
                      {segmentLabel(row.segment)} | Last purchase {row.last_purchase_days} day(s) |
                      Avg spend {formatCurrency(row.avg_monthly_spend)}
                    </p>
                  </div>
                ))}
                {segmentRows.length === 0 && (
                  <p className="text-sm text-slate-500">No segment data available.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Anomaly Alerts</h3>
              <div className="mt-3 max-h-72 overflow-y-auto space-y-1.5">
                {anomalyRows.slice(0, 25).map((row) => (
                  <div key={row.id} className="rounded border border-slate-200 px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-800">{row.anomaly_type}</p>
                    <p className="text-xs text-slate-500">{row.description}</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">
                      Severity: {row.severity}
                    </p>
                  </div>
                ))}
                {anomalyRows.length === 0 && (
                  <p className="text-sm text-slate-500">No anomalies found.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">Ask PharmaCare</h3>
              <p className="mt-1 text-xs text-slate-500">
                Example: Which category sold highest this week?
              </p>
              <textarea
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={4}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ask about stock, sales, GST, anomalies..."
              />
              <button
                type="button"
                onClick={() => void askPharmaCare()}
                disabled={isAsking}
                className="mt-3 min-h-touch rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isAsking ? 'Asking...' : 'Get Answer'}
              </button>
              {answer && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-800">
                  {answer}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">WhatsApp Message Composer</h3>
              <div className="mt-3 space-y-2">
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                  placeholder="Search customer..."
                />
                {customerOptions.length > 0 && (
                  <div className="rounded-lg border border-slate-200 max-h-28 overflow-y-auto">
                    {customerOptions.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerName(row.name)
                          setCustomerQuery(row.name)
                          setCustomerOptions([])
                        }}
                        className="w-full border-b last:border-b-0 border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        {row.name} {row.phone ? `(${row.phone})` : ''}
                      </button>
                    ))}
                  </div>
                )}
                <select
                  value={selectedSituation}
                  onChange={(event) => setSelectedSituation(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-touch"
                >
                  <option>Refill reminder</option>
                  <option>Medicine available</option>
                  <option>Payment due reminder</option>
                  <option>Health camp invitation</option>
                </select>
                <textarea
                  value={composerDetails}
                  onChange={(event) => setComposerDetails(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Extra context for message"
                />
                <button
                  type="button"
                  onClick={() => void composeMessage()}
                  disabled={isComposing}
                  className="min-h-touch rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                >
                  {isComposing ? 'Generating...' : 'Generate Draft'}
                </button>
                {draftMessage && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-slate-800 whitespace-pre-wrap">
                    {draftMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
