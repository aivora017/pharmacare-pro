/**
 * Barcode generation and label printing.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IBarcodeBulkResult {
  items: { batch_id: number; barcode: string }[]
  total: number
}

export const barcodeService = {
  generateForBatch: async (batchId: number, actorUserId: number): Promise<string> =>
    invoke<string>('barcode_generate_for_batch', { batchId, actorUserId }),
  generateBulk: async (batchIds: number[], actorUserId: number): Promise<IBarcodeBulkResult> =>
    invoke<IBarcodeBulkResult>('barcode_generate_bulk', { batchIds, actorUserId }),
  printLabels: async (labels: unknown, printerName: string, actorUserId: number): Promise<void> =>
    invoke('barcode_print_labels', { labels, printerName, actorUserId }),
}
