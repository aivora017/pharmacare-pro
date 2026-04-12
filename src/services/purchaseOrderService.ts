import { invoke } from "@tauri-apps/api/core"

export interface PurchaseOrderItem {
  id?: number
  medicine_id: number
  medicine_name: string
  quantity_ordered: number
  quantity_received?: number
  unit_price: number
  total_amount: number
}

export interface PurchaseOrder {
  id: number
  po_number: string
  supplier_id: number
  supplier_name: string
  supplier_phone?: string
  status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled'
  order_date: string
  expected_date?: string
  total_amount: number
  notes: string
  created_at: string
  items?: PurchaseOrderItem[]
}

export const purchaseOrderService = {
  list: (status?: string) =>
    invoke<{ orders: PurchaseOrder[]; count: number }>('po_list', { status: status ?? null }),

  get: (id: number) =>
    invoke<PurchaseOrder>('po_get', { id }),

  create: (data: Partial<PurchaseOrder> & { items: PurchaseOrderItem[] }, userId: number) =>
    invoke<number>('po_create', { data, userId }),

  updateStatus: (id: number, status: string, userId: number) =>
    invoke<void>('po_update_status', { id, status, userId }),

  autoGenerate: (userId: number) =>
    invoke<{ suggestions: any[]; count: number; message: string }>('po_auto_generate', { userId }),
}
