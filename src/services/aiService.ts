import { invoke } from "@tauri-apps/api/core"
import type { IBriefingAction } from "@/types"

export const aiService = {
  morningBriefing:  async (): Promise<{ actions: IBriefingAction[] }> => invoke("ai_morning_briefing"),
  demandForecast:   async () => invoke("ai_demand_forecast"),
  expiryRisks:      async () => invoke("ai_expiry_risks"),
  customerSegments: async () => invoke("ai_customer_segments"),
  abcXyz:           async () => invoke("ai_abc_xyz"),
  poSuggestions:    async () => invoke("ai_po_suggestions"),
  anomalies:        async () => invoke("ai_anomalies"),
  askPharmaCare:    async (question: string): Promise<string>          => invoke("ai_ask_pharmacare",    { question }),
  composeWhatsapp:  async (customerName: string, situation: string, language: string, tone: string): Promise<string> =>
    invoke("ai_compose_whatsapp", { customerName, situation, language, tone }),
  caNarration:      async (financialYear: string): Promise<string>     => invoke("ai_ca_narration",     { financialYear }),
  caChecks:         async (financialYear: string)                       => invoke("ai_ca_checks",        { financialYear }),
}
