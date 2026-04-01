import { invoke } from "@tauri-apps/api/core"
import type { IBill, ICartItem } from "@/types"

export interface CreateBillInput {
  customer_id?: number; doctor_id?: number; items: ICartItem[]
  payments: { amount: number; payment_mode: string; reference_no?: string }[]
  discount_amount?: number; notes?: string; created_by: number
}

export const billingService = {
  createBill:      async (input: CreateBillInput): Promise<number>   => invoke("billing_create_bill",        { input }),
  cancelBill:      async (billId: number, reason: string, userId: number): Promise<void> =>
    invoke("billing_cancel_bill", { billId, reason, userId }),
  getBill:         async (billId: number): Promise<IBill>            => invoke("billing_get_bill",            { billId }),
  listBills:       async (filters: Record<string, unknown>)          => invoke("billing_list_bills",          { filters }),
  holdBill:        async (input: unknown): Promise<void>             => invoke("billing_hold_bill",           { input }),
  getHeldBills:    async ()                                          => invoke("billing_get_held_bills"),
  restoreHeldBill: async (heldBillId: number): Promise<ICartItem[]> => invoke("billing_restore_held_bill",   { heldBillId }),
  getTodaySummary: async ()                                          => invoke("billing_get_today_summary"),
  createReturn:    async (originalBillId: number, items: unknown[], reason: string, userId: number): Promise<number> =>
    invoke("billing_create_return", { originalBillId, items, reason, userId }),
  listReturns:     async (limit = 50)                                => invoke("billing_list_returns",        { limit }),
}
