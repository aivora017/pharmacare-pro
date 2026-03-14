/**
 * Printer service — thermal ESC/POS, normal A4, barcode ZPL.
 */
import { invoke } from '@tauri-apps/api/core'

export interface IPrintJobItem {
  file_name: string
  size_bytes: number
  modified_at?: number
  extension: string
  printer_name?: string
  printer_type?: string
  status?: 'queued' | 'sent' | 'failed' | string
  retry_count?: number
  last_error?: string
  file_path?: string
  job_type?: string
}

export interface IPrintJobListResponse {
  items: IPrintJobItem[]
  total: number
}

export const printerService = {
  listPrinters: async (actorUserId: number): Promise<string[]> =>
    invoke<string[]>('printer_list_printers', { actorUserId }),
  printBill: async (
    billId: number,
    printerType: 'thermal' | 'normal',
    actorUserId: number,
    printerName?: string
  ): Promise<void> => invoke('printer_print_bill', { billId, printerType, printerName, actorUserId }),
  printLabels: async (labelData: unknown, printerName: string, actorUserId: number): Promise<void> =>
    invoke('printer_print_labels', { labelData, printerName, actorUserId }),
  testPrint: async (printerName: string, printerType: string, actorUserId: number): Promise<void> =>
    invoke('printer_test_print', { printerName, printerType, actorUserId }),
  listJobs: async (actorUserId: number): Promise<IPrintJobListResponse> =>
    invoke<IPrintJobListResponse>('printer_list_jobs', { actorUserId }),
  requeueJob: async (fileName: string, printerName: string, actorUserId: number): Promise<void> =>
    invoke('printer_requeue_job', { fileName, printerName, actorUserId }),
}
