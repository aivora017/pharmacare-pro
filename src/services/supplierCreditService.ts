import { invoke } from "@tauri-apps/api/core"

export interface SupplierCreditNote {
  id: number
  cn_number: string
  supplier_id: number
  supplier_name: string
  purchase_bill_number?: string
  cn_date: string
  reason: string
  total_amount: number
  status: 'pending' | 'applied' | 'rejected'
  notes: string
}

export interface SupplierCreditNoteItem {
  medicine_id?: number
  medicine_name: string
  batch_number: string
  quantity: number
  unit_price: number
  total_amount: number
}

export const supplierCreditService = {
  list: (supplierId?: number) =>
    invoke<{ credit_notes: SupplierCreditNote[]; count: number }>(
      'supplier_credit_list', { supplierId: supplierId ?? null }
    ),

  create: (data: any, userId: number) =>
    invoke<number>('supplier_credit_create', { data, userId }),

  apply: (id: number, userId: number) =>
    invoke<void>('supplier_credit_apply', { id, userId }),
}
