/**
 * AI Service (Tier 1 — offline, pure SQL analytics).
 */
import { invoke } from '@tauri-apps/api/core'
import type { IAnomaly, IBriefingAction, IDemandForecast, IExpiryRisk } from '@/types'

export interface ICustomerSegmentRow {
  customer_id: number
  customer_name: string
  segment: 'champion' | 'loyal' | 'at_risk' | 'dormant' | 'new'
  last_purchase_days: number
  avg_monthly_spend: number
  purchase_count_90d: number
}

async function safeInvoke<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load AI insights.'
    throw new Error(message)
  }
}

export const aiService = {
  getMorningBriefing: async (): Promise<{ actions: IBriefingAction[] }> =>
    safeInvoke<{ actions: IBriefingAction[] }>('ai_get_morning_briefing'),
  getDemandForecast: async (): Promise<IDemandForecast[]> =>
    safeInvoke<IDemandForecast[]>('ai_get_demand_forecast'),
  getExpiryRisks: async (): Promise<IExpiryRisk[]> =>
    safeInvoke<IExpiryRisk[]>('ai_get_expiry_risks'),
  getCustomerSegments: async (): Promise<ICustomerSegmentRow[]> =>
    safeInvoke<ICustomerSegmentRow[]>('ai_get_customer_segments'),
  getAnomalies: async (): Promise<IAnomaly[]> => safeInvoke<IAnomaly[]>('ai_get_anomalies'),
}
