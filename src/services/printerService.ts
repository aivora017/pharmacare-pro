/**
 * Printer service — thermal ESC/POS, normal A4, barcode ZPL.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IPrintJobItem {
  file_name: string
  size_bytes: number
  modified_at?: number
  extension: string
}

export interface IPrintJobListResponse {
  items: IPrintJobItem[]
  total: number
}

export const printerService = {
  listPrinters: async (): Promise<string[]> => invoke<string[]>('printer_list_printers'),
  printBill: async (billId: number, printerType: 'thermal' | 'normal'): Promise<void> =>
    invoke('printer_print_bill', { billId, printerType }),
  printLabels: async (labelData: unknown, printerName: string): Promise<void> =>
    invoke('printer_print_labels', { labelData, printerName }),
  testPrint: async (printerName: string, printerType: string): Promise<void> =>
    invoke('printer_test_print', { printerName, printerType }),
  listJobs: async (): Promise<IPrintJobListResponse> =>
    invoke<IPrintJobListResponse>('printer_list_jobs'),
  requeueJob: async (fileName: string, printerName: string): Promise<void> =>
    invoke('printer_requeue_job', { fileName, printerName }),
}
