/**
 * Inventory queries and stock adjustments.
 */
import { invoke } from "@tauri-apps/api/core"
import type { IMedicine, IBatch } from "@/types"

export const inventoryService = {
  getStock:       async (filters?: Record<string,unknown>) =>
    invoke("inventory_get_stock", { filters: filters ?? {} }),
  getLowStock:    async (): Promise<IMedicine[]> =>
    invoke<IMedicine[]>("inventory_get_low_stock"),
  getExpiryList:  async (withinDays = 90): Promise<IBatch[]> =>
    invoke<IBatch[]>("inventory_get_expiry_list", { withinDays }),
  adjustStock:    async (batchId: number, quantity: number, type: string, reason: string, userId: number): Promise<void> =>
    invoke("inventory_adjust_stock", { batchId, quantity, adjustmentType: type, reason, userId }),
}
