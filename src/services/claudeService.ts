/**
 * Claude AI Service (Tier 3 — internet required).
 * API key is stored in OS keychain; never exposed to frontend.
 * Only aggregated/anonymous data is sent — never patient PII.
 */
import { invoke } from "@tauri-apps/api/core"

export const claudeService = {
  /** Ask a question in plain English or Hindi about your pharmacy data. */
  askQuestion:        async (question: string): Promise<string> =>
    invoke<string>("ai_ask_pharmacare", { question }),
  /** Draft a personalised WhatsApp/SMS message for a situation. */
  composeMessage:     async (situation: string, customerName: string, details: Record<string,string>): Promise<string> =>
    invoke<string>("ai_compose_message", { situation, customerName, details }),
}
