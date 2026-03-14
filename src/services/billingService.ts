/**
 * Billing Service - all POS bill operations.
 * NEVER call invoke() from components — always go through this service.
 */
import { invoke } from '@tauri-apps/api/core'
import type { IBill, ICartItem, ICustomer } from '@/types'

export interface CreateBillInput {
  customer_id?: number
  doctor_id?: number
  prescription_ref?: string
  prescription_image?: string
  loyalty_points_redeemed?: number
  items: ICartItem[]
  payments: { amount: number; payment_mode: string; reference_no?: string }[]
  discount_amount?: number
  notes?: string
  created_by: number
}

export interface IHeldBillSummary {
  id: number
  label: string
  created_at: string
}

export interface ISaleReturnItemInput {
  bill_item_id?: number
  batch_id?: number
  quantity: number
}

export interface ISaleReturnSummary {
  id: number
  return_number: string
  original_bill_id: number
  original_bill_number: string
  total_amount: number
  reason: string
  return_date: string
  created_at: string
}

export const billingService = {
  createBill: async (input: CreateBillInput): Promise<number> =>
    invoke<number>('billing_create_bill', { input }),
  cancelBill: async (billId: number, reason: string, userId: number): Promise<void> =>
    invoke('billing_cancel_bill', { billId, reason, userId }),
  getBill: async (billId: number): Promise<IBill> => invoke<IBill>('billing_get_bill', { billId }),
  listBills: async (filters: Record<string, unknown>): Promise<{ bills: IBill[]; total: number }> =>
    invoke('billing_list_bills', { filters }),
  holdBill: async (data: {
    items: ICartItem[]
    customer?: Partial<ICustomer> | null
    label?: string
    created_by?: number
  }): Promise<void> => invoke('billing_hold_bill', { input: data }),
  getHeldBills: async (): Promise<IHeldBillSummary[]> => invoke('billing_get_held_bills'),
  restoreHeldBill: async (id: number): Promise<ICartItem[]> =>
    invoke('billing_restore_held_bill', { heldBillId: id }),
  createReturn: async (
    originalBillId: number,
    items: ISaleReturnItemInput[],
    reason: string,
    userId: number
  ): Promise<number> =>
    invoke<number>('billing_create_return', { originalBillId, items, reason, userId }),
  listReturns: async (limit = 20): Promise<ISaleReturnSummary[]> =>
    invoke<ISaleReturnSummary[]>('billing_list_returns', { limit }),
  getTodaySummary: async () => invoke('billing_get_today_summary'),
}
