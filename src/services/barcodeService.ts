/**
 * Barcode generation and label printing.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IBarcodeBulkResult {
  items: { batch_id: number; barcode: string }[]
  total: number
}

export const barcodeService = {
  generateForBatch: async (batchId: number): Promise<string> =>
    invoke<string>('barcode_generate_for_batch', { batchId }),
  generateBulk: async (batchIds: number[]): Promise<IBarcodeBulkResult> =>
    invoke<IBarcodeBulkResult>('barcode_generate_bulk', { batchIds }),
  printLabels: async (labels: unknown, printerName: string): Promise<void> =>
    invoke('barcode_print_labels', { labels, printerName }),
}
