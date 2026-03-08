/**
 * Medicine Service - medicine master and batch management.
 */
import { invoke } from "@tauri-apps/api/core"
import type { IMedicine, IBatch } from "@/types"

export const medicineService = {
  search:             async (query: string, opts?: { in_stock_only?: boolean; category_id?: number }): Promise<IMedicine[]> =>
    invoke<IMedicine[]>("medicine_search", { query, ...opts }),
  get:                async (id: number): Promise<IMedicine> =>
    invoke<IMedicine>("medicine_get", { id }),
  getBatchByBarcode:  async (barcode: string): Promise<IBatch|null> =>
    invoke<IBatch|null>("medicine_get_batch_by_barcode", { barcode }),
  listBatches:        async (medicineId: number): Promise<IBatch[]> =>
    invoke<IBatch[]>("medicine_list_batches", { medicineId }),
  create:             async (data: Partial<IMedicine>, userId: number): Promise<number> =>
    invoke<number>("medicine_create", { data, userId }),
  update:             async (id: number, data: Partial<IMedicine>, userId: number): Promise<void> =>
    invoke("medicine_update", { id, data, userId }),
  delete:             async (id: number, userId: number): Promise<void> =>
    invoke("medicine_delete", { id, userId }),
  createBatch:        async (data: Partial<IBatch>, userId: number): Promise<number> =>
    invoke<number>("medicine_create_batch", { data, userId }),
  updateBatch:        async (batchId: number, data: Partial<IBatch>, userId: number): Promise<void> =>
    invoke("medicine_update_batch", { batchId, data, userId }),
}
