/**
 * AI Service (Tier 1 — offline, pure SQL analytics).
 */
import { invoke } from "@tauri-apps/api/core"
import type { IDemandForecast, IExpiryRisk, IAnomaly, IBriefingAction } from "@/types"

export const aiService = {
  getMorningBriefing:   async (): Promise<{ actions: IBriefingAction[] }> =>
    invoke("ai_get_morning_briefing"),
  getDemandForecast:    async (): Promise<IDemandForecast[]> =>
    invoke<IDemandForecast[]>("ai_get_demand_forecast"),
  getExpiryRisks:       async (): Promise<IExpiryRisk[]> =>
    invoke<IExpiryRisk[]>("ai_get_expiry_risks"),
  getCustomerSegments:  async () =>
    invoke("ai_get_customer_segments"),
  getAnomalies:         async (): Promise<IAnomaly[]> =>
    invoke<IAnomaly[]>("ai_get_anomalies"),
}
