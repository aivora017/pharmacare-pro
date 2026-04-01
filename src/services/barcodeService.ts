import { invoke } from "@tauri-apps/api/core"

export const barcodeService = {
  generate:     async (batchId: number): Promise<string> => invoke("barcode_generate",      { batchId }),
  generateBulk: async (batchIds: number[])                => invoke("barcode_generate_bulk", { batchIds }),
}
