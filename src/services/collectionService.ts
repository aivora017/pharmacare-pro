import { invoke } from "@tauri-apps/api/core"

export interface OutstandingCustomer {
  id: number
  name: string
  phone?: string
  outstanding_balance: number
  last_bill_date?: string
  pending_bills: number
}

export const collectionService = {
  listOutstanding: () =>
    invoke<{ customers: OutstandingCustomer[]; count: number; total_outstanding: number }>(
      'collection_list_outstanding'
    ),

  record: (customerId: number, amount: number, paymentMode: string, referenceNo: string, notes: string, userId: number) =>
    invoke<number>('collection_record', { customerId, amount, paymentMode, referenceNo, notes, userId }),

  history: (customerId: number) =>
    invoke<{ history: any[]; total_collected: number }>('collection_history', { customerId }),

  dashboardExtended: () =>
    invoke<any>('dashboard_extended'),
}
