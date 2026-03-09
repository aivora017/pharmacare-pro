/**
 * Supplier and Purchase service.
 */
import { invoke } from '@tauri-apps/api/core'
import type { ISupplier, IPurchaseBill } from '@/types'

export interface IPurchaseBillCreateInput {
  bill_number: string
  supplier_id: number
  bill_date: string
  due_date?: string
  total_amount: number
  amount_paid?: number
  notes?: string
}

export interface IPurchaseOrderCreateInput {
  po_number: string
  supplier_id: number
  expected_by?: string
  notes?: string
  total_amount?: number
}

export interface IPurchaseReturnCreateInput {
  debit_note_no: string
  supplier_id: number
  return_date?: string
  reason?: string
  total_amount: number
  notes?: string
}

export const supplierService = {
  list: async (): Promise<ISupplier[]> => invoke<ISupplier[]>('purchase_list_suppliers'),
  create: async (data: Partial<ISupplier>, userId: number): Promise<number> =>
    invoke<number>('purchase_create_supplier', { data, userId }),
  update: async (id: number, data: Partial<ISupplier>, userId: number): Promise<void> =>
    invoke('purchase_update_supplier', { id, data, userId }),
}

export const purchaseService = {
  createBill: async (data: IPurchaseBillCreateInput, userId: number): Promise<number> =>
    invoke<number>('purchase_create_bill', { data, userId }),
  getBill: async (id: number): Promise<IPurchaseBill> =>
    invoke<IPurchaseBill>('purchase_get_bill', { id }),
  listBills: async (filters?: Record<string, unknown>) =>
    invoke('purchase_list_bills', { filters: filters ?? {} }),
  createPO: async (data: IPurchaseOrderCreateInput, userId: number): Promise<number> =>
    invoke<number>('purchase_create_po', { data, userId }),
  createReturn: async (data: IPurchaseReturnCreateInput, userId: number): Promise<number> =>
    invoke<number>('purchase_create_return', { data, userId }),
}
