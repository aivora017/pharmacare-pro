import { invoke } from "@tauri-apps/api/core"

export const inventoryService = {
  getExpiryList:    async (withinDays = 90)                               => invoke("inventory_get_expiry_list", { withinDays }),
  getLowStock:      async ()                                              => invoke("inventory_get_low_stock"),
  adjustStock:      async (batchId: number, quantity: number, adjustmentType: string, reason: string, userId: number): Promise<void> =>
    invoke("inventory_adjust_stock", { batchId, quantity, adjustmentType, reason, userId }),
  getStock:         async (filters: Record<string, unknown> = {})        => invoke("inventory_get_stock",        { filters }),
  physicalCount:    async (batchId: number, actualQty: number, userId: number): Promise<void> =>
    invoke("inventory_physical_count", { batchId, actualQty, userId }),
}
