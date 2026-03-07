/**
 * PharmaCare Pro — Billing Service
 *
 * All business logic for creating, managing, and printing bills.
 * Components never write to the database directly — they call this service.
 *
 * Copilot Instructions:
 * - createBill() must wrap all DB writes in a SQLite transaction
 *   (if anything fails, everything rolls back — no partial bills)
 * - When saving bill_items, decrement batch.quantity_sold for each item
 * - When saving bill_items, check batch.quantity_on_hand >= quantity sold
 *   (if not enough stock, throw an error with medicine name)
 * - After saving, update customer.outstanding_balance if payment mode is 'credit'
 * - After saving, add loyalty points to customer if applicable
 * - Write to audit_log after every bill creation/cancellation
 * - All monetary calculations must use integer arithmetic (paise) to avoid floating point errors
 */

import { invoke } from '@tauri-apps/api/core'
import type { ICartItem, IBill, IPayment, ICustomer } from '@/types'

interface CreateBillInput {
  customer_id?: number
  doctor_id?: number
  prescription_ref?: string
  items: ICartItem[]
  payments: IPaymentInput[]
  discount_amount?: number
  notes?: string
  created_by: number
}

interface IPaymentInput {
  amount: number
  payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'cheque'
  reference_no?: string
}

interface HoldBillInput {
  items: ICartItem[]
  customer?: ICustomer | null
  label?: string
}

export const billingService = {

  /**
   * Create a new bill and save to database.
   *
   * This is the most critical function in the entire app.
   * It runs inside a SQLite transaction — all or nothing.
   *
   * Steps (Copilot: implement in Rust command 'billing_create_bill'):
   * 1. Validate: all batch quantities are available
   * 2. Generate bill_number (format: POS-YYYYMM-NNNNN)
   * 3. Calculate totals (subtotal, GST, discount, round-off, net)
   * 4. INSERT into bills table
   * 5. INSERT into bill_items table (one row per item)
   * 6. UPDATE batches: quantity_sold += item.quantity
   * 7. INSERT into payments table (one row per payment)
   * 8. UPDATE customer outstanding_balance if credit payment
   * 9. UPDATE customer loyalty_points
   * 10. INSERT into audit_log
   * 11. Return the created bill ID
   *
   * @returns The new bill's database ID
   */
  createBill: async (input: CreateBillInput): Promise<number> => {
    return await invoke<number>('billing_create_bill', { input })
  },

  /**
   * Cancel an existing bill.
   *
   * Steps (Copilot: implement in Rust 'billing_cancel_bill'):
   * 1. Check bill status is 'active'
   * 2. Check user has permission to cancel (cashiers can only cancel within 1 hour)
   * 3. UPDATE bills.status = 'cancelled', set cancel_reason, cancelled_by, cancelled_at
   * 4. REVERSE batch quantities: quantity_sold -= item.quantity for each item
   * 5. REVERSE customer outstanding balance if payment was credit
   * 6. REVERSE loyalty points
   * 7. INSERT into audit_log with old_value snapshot
   *
   * @throws If bill is already cancelled or returned
   */
  cancelBill: async (billId: number, reason: string, userId: number): Promise<void> => {
    await invoke('billing_cancel_bill', { billId, reason, userId })
  },

  /**
   * Get a bill with all its items and payments.
   * Used for printing and viewing bill details.
   */
  getBill: async (billId: number): Promise<IBill> => {
    return await invoke<IBill>('billing_get_bill', { billId })
  },

  /**
   * List bills with filters (date range, customer, status).
   * Used in reports and bill history screen.
   *
   * Copilot: support pagination (page, page_size parameters)
   * Sort by bill_date DESC by default
   */
  listBills: async (filters: {
    from_date?: string
    to_date?: string
    customer_id?: number
    status?: string
    page?: number
    page_size?: number
  }): Promise<{ bills: IBill[]; total: number }> => {
    return await invoke('billing_list_bills', { filters })
  },

  /**
   * Save the current cart as a held bill.
   * The cashier can recall held bills at any time.
   *
   * Copilot: serialize cart to JSON, save to held_bills table
   * Show in the F5 held bills panel
   */
  holdBill: async (input: HoldBillInput): Promise<void> => {
    await invoke('billing_hold_bill', { input })
  },

  /**
   * Get all currently held bills.
   */
  getHeldBills: async (): Promise<Array<{
    id: number
    label: string
    item_count: number
    total: number
    created_at: string
  }>> => {
    return await invoke('billing_get_held_bills')
  },

  /**
   * Restore a held bill back into the cart.
   * Deletes the held bill record after restoring.
   */
  restoreHeldBill: async (heldBillId: number): Promise<ICartItem[]> => {
    return await invoke('billing_restore_held_bill', { heldBillId })
  },

  /**
   * Process a sales return.
   *
   * Copilot: validate original bill exists and is 'active'
   * Allow returning specific items only (not necessarily the whole bill)
   * Reverse stock and customer balance for returned items
   */
  createReturn: async (input: {
    original_bill_id: number
    items: Array<{ bill_item_id: number; quantity: number }>
    reason: string
    refund_mode: string
    created_by: number
  }): Promise<number> => {
    return await invoke('billing_create_return', { input })
  },

  /**
   * Get today's sales summary for the dashboard.
   * Returns: total sales, bill count, average bill value, payment breakdown.
   */
  getTodaySummary: async (): Promise<{
    total_revenue: number
    bill_count: number
    avg_bill_value: number
    cash_amount: number
    upi_amount: number
    card_amount: number
    credit_amount: number
  }> => {
    return await invoke('billing_get_today_summary')
  },
}
