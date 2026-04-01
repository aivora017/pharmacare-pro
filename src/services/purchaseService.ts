import { invoke } from "@tauri-apps/api/core"
import type { ISupplier } from "@/types"

export const supplierService = {
  list:   async (): Promise<ISupplier[]> => invoke("supplier_list"),
  create: async (data: Partial<ISupplier>, userId: number): Promise<number> =>
    invoke("supplier_create", { data, userId }),
  update: async (id: number, data: Partial<ISupplier>, userId: number): Promise<void> =>
    invoke("supplier_update", { id, data, userId }),
}

export const purchaseService = {
  listBills:          async (filters: Record<string, unknown>)   => invoke("purchase_list_bills",          { filters }),
  createBill:         async (data: Record<string, unknown>, userId: number): Promise<number> =>
    invoke("purchase_create_bill", { data, userId }),
  getBill:            async (id: number)                          => invoke("purchase_get_bill",            { id }),
  addBatchFromBill:   async (purchaseBillId: number, data: Record<string, unknown>, userId: number): Promise<number> =>
    invoke("purchase_add_batch_from_bill", { purchaseBillId, data, userId }),
}
