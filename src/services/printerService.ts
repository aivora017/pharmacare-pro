/**
 * Printer service — thermal ESC/POS, normal A4, barcode ZPL.
 */
import { invoke } from "@tauri-apps/api/core"

export const printerService = {
  listPrinters:  async (): Promise<string[]> =>
    invoke<string[]>("printer_list_printers"),
  printBill:     async (billId: number, printerType: "thermal"|"normal"): Promise<void> =>
    invoke("printer_print_bill", { billId, printerType }),
  printLabels:   async (labelData: unknown, printerName: string): Promise<void> =>
    invoke("printer_print_labels", { labelData, printerName }),
  testPrint:     async (printerName: string, printerType: string): Promise<void> =>
    invoke("printer_test_print", { printerName, printerType }),
}
