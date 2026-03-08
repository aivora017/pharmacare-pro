/**
 * Supplier and Purchase service.
 */
import { invoke } from "@tauri-apps/api/core"
import type { ISupplier, IPurchaseBill } from "@/types"

export const supplierService = {
  list:          async (): Promise<ISupplier[]> =>
    invoke<ISupplier[]>("purchase_list_suppliers"),
  create:        async (data: Partial<ISupplier>, userId: number): Promise<number> =>
    invoke<number>("purchase_create_supplier", { data, userId }),
  update:        async (id: number, data: Partial<ISupplier>, userId: number): Promise<void> =>
    invoke("purchase_update_supplier", { id, data, userId }),
}

export const purchaseService = {
  createBill:    async (data: Record<string,unknown>, userId: number): Promise<number> =>
    invoke<number>("purchase_create_bill", { data, userId }),
  getBill:       async (id: number): Promise<IPurchaseBill> =>
    invoke<IPurchaseBill>("purchase_get_bill", { id }),
  listBills:     async (filters?: Record<string,unknown>) =>
    invoke("purchase_list_bills", { filters: filters ?? {} }),
  createPO:      async (data: Record<string,unknown>, userId: number): Promise<number> =>
    invoke<number>("purchase_create_po", { data, userId }),
}
